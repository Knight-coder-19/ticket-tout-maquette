use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};

use cartepro_core::directory;
use cartepro_core::error::CoreError;
use cartepro_core::identity::AuthenticatedUser;
use cartepro_core::ids::{AccountId, Jti};
use cartepro_core::ledger;
use cartepro_core::partners::highlights;
use cartepro_core::payments;
use cartepro_core::reporting;

use crate::dto::catalog::CatalogItem;
use crate::dto::employee::{
    AuthorizeRequest, BalanceResponse, EmployeeTransaction, EmployeeTransactionList,
    IssuedTokenResponse, MinisterPick,
};
use crate::error::ApiError;
use crate::extractors::auth::{AuthUser, Employee};
use crate::extractors::pagination::Pagination;
use crate::extractors::validated::ValidatedJson;
use crate::state::AppState;

const ISSUER: &str = "cartepro";

pub fn routes() -> Router<AppState>
{
    Router::new()
        .route("/me/balance", get(balance))
        .route("/me/transactions", get(transactions))
        .route("/me/minister-picks", get(minister_picks))
        .route("/me/payment-tokens", post(authorize_token))
        .route("/me/payment-tokens/{jti}", axum::routing::delete(cancel_token))
}

async fn balance(
    AuthUser(user, _): AuthUser<Employee>,
    State(app): State<AppState>,
) -> Result<Json<BalanceResponse>, ApiError>
{
    let account_id = account_of(&app, user).await?;

    payments::expire_stale_tokens(&app.db, &*app.clock, payments::expire::DEFAULT_BATCH).await?;

    let mut conn = app.db.acquire().await?;
    let account = match ledger::repo::find_account(&mut conn, account_id).await? {
        Some(account) => account,
        None => return Err(CoreError::Internal.into())
    };

    Ok(Json(BalanceResponse::try_from(&account)?))
}

async fn transactions(
    AuthUser(user, _): AuthUser<Employee>,
    State(app): State<AppState>,
    pagination: Pagination,
) -> Result<Json<EmployeeTransactionList>, ApiError>
{
    let account_id = account_of(&app, user).await?;
    let limit = i64::from(pagination.limit);
    let lines = reporting::employee_statement(
        &app.db,
        account_id,
        limit,
        pagination.cursor.as_deref(),
    )
    .await?;

    let next_cursor = match lines.len() as i64 == limit {
        true => lines.last().map(|line| line.operation_id.to_string()),
        false => None
    };
    let items = lines.iter().map(EmployeeTransaction::from).collect();

    Ok(Json(EmployeeTransactionList { items, next_cursor }))
}

async fn minister_picks(
    AuthUser(_, _): AuthUser<Employee>,
    State(app): State<AppState>,
) -> Result<Json<Vec<MinisterPick>>, ApiError>
{
    let picks = highlights::minister_picks(&app.db).await?;
    let items = picks
        .iter()
        .map(|pick| MinisterPick {
            partner: CatalogItem::from(&pick.partner),
            position: pick.position
        })
        .collect();

    Ok(Json(items))
}

async fn authorize_token(
    AuthUser(user, _): AuthUser<Employee>,
    State(app): State<AppState>,
    ValidatedJson(body): ValidatedJson<AuthorizeRequest>,
) -> Result<(StatusCode, Json<IssuedTokenResponse>), ApiError>
{
    let account_id = account_of(&app, user).await?;
    let mut tx = app.db.begin().await?;

    let issued = payments::authorize(
        &mut tx,
        &*app.clock,
        &app.config,
        &app.signing_key,
        ISSUER,
        account_id,
        body.amount,
    )
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(IssuedTokenResponse::from(issued))))
}

async fn cancel_token(
    AuthUser(user, _): AuthUser<Employee>,
    State(app): State<AppState>,
    Path(jti): Path<Jti>,
) -> Result<StatusCode, ApiError>
{
    let account_id = account_of(&app, user).await?;
    let mut tx = app.db.begin().await?;

    payments::cancel(&mut tx, &*app.clock, account_id, jti).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn account_of(app: &AppState, user: AuthenticatedUser) -> Result<AccountId, ApiError>
{
    let mut conn = app.db.acquire().await?;
    let found = directory::repo::find_employee_by_user(&mut conn, user.id).await?;

    let employee = match found {
        Some(employee) => employee,
        None => return Err(CoreError::Forbidden.into())
    };
    let account = directory::employees::active_account(&mut conn, employee.id).await?;

    Ok(account)
}
