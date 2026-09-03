use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};

use cartepro_core::error::CoreError;
use cartepro_core::identity::AuthenticatedUser;
use cartepro_core::ids::PartnerId;
use cartepro_core::partners;
use cartepro_core::payments::{self, PaymentError, Settlement, TokenRef};

use crate::dto::partner::{
    BatchSettleRequest, BatchSettleResponse, BatchSettleResult, PartnerSummary, PartnerTransaction,
    PartnerTransactionList, PaymentResponse, PeriodQuery, SettleRequest,
};
use crate::error::ApiError;
use crate::extractors::auth::{AuthUser, Partner};
use crate::extractors::pagination::Pagination;
use crate::extractors::validated::ValidatedJson;
use crate::state::AppState;

pub fn routes() -> Router<AppState>
{
    Router::new()
        .route("/partner/summary", get(summary))
        .route("/partner/transactions", get(transactions))
        .route("/partner/payments", post(settle_payment))
        .route("/partner/payments/batch", post(settle_batch))
}

async fn summary(
    AuthUser(user, _): AuthUser<Partner>,
    State(app): State<AppState>,
    Query(period): Query<PeriodQuery>,
) -> Result<Json<PartnerSummary>, ApiError>
{
    let partner = partner_of(&app, user).await?;
    let (from, to) = period.resolve(app.clock.now());
    let totals = payments::repo::partner_totals(&app.db, partner.id, from, to).await?;

    Ok(Json(PartnerSummary {
        total_received: totals.total_received,
        transaction_count: totals.transaction_count,
        period_from: from,
        period_to: to,
        is_official_partner: partner.is_official_partner()
    }))
}

async fn transactions(
    AuthUser(user, _): AuthUser<Partner>,
    State(app): State<AppState>,
    Query(period): Query<PeriodQuery>,
    pagination: Pagination,
) -> Result<Json<PartnerTransactionList>, ApiError>
{
    let partner = partner_of(&app, user).await?.id;
    let (from, to) = period.resolve(app.clock.now());
    let limit = i64::from(pagination.limit);
    let activity = payments::repo::list_partner_activity(&app.db, partner, from, to, limit).await?;

    let next_cursor = match activity.len() as i64 == limit {
        true => activity.last().map(|line| line.settlement.payment.operation_id.to_string()),
        false => None
    };
    let items = activity.iter().map(PartnerTransaction::from).collect();

    Ok(Json(PartnerTransactionList { items, next_cursor }))
}

async fn settle_payment(
    AuthUser(user, _): AuthUser<Partner>,
    State(app): State<AppState>,
    ValidatedJson(body): ValidatedJson<SettleRequest>,
) -> Result<Json<PaymentResponse>, ApiError>
{
    let partner = partner_of(&app, user).await?.id;
    let reference = match body.token_ref() {
        Some(reference) => reference,
        None => return Err(PaymentError::UnknownToken.into())
    };
    let settlement = settle_one(&app, partner, &reference, body.scanned_at).await?;

    Ok(Json(PaymentResponse::from(&settlement)))
}

async fn settle_batch(
    AuthUser(user, _): AuthUser<Partner>,
    State(app): State<AppState>,
    ValidatedJson(body): ValidatedJson<BatchSettleRequest>,
) -> Result<Json<BatchSettleResponse>, ApiError>
{
    let partner = partner_of(&app, user).await?.id;
    let mut results = Vec::with_capacity(body.items.len());

    for item in &body.items {
        results.push(settle_line(&app, partner, item).await);
    }

    Ok(Json(BatchSettleResponse { results }))
}

async fn settle_line(app: &AppState, partner: PartnerId, item: &SettleRequest)
    -> BatchSettleResult
{
    let reference = match item.token_ref() {
        Some(reference) => reference,
        None => return BatchSettleResult::failed(item.jti, "VALIDATION_FAILED")
    };

    match settle_one(app, partner, &reference, item.scanned_at).await {
        Ok(settlement) => BatchSettleResult::settled(PaymentResponse::from(&settlement)),
        Err(error) => BatchSettleResult::failed(item.jti, error.code())
    }
}

async fn settle_one(
    app: &AppState,
    partner: PartnerId,
    reference: &TokenRef,
    scanned_at: DateTime<Utc>,
) -> Result<Settlement, PaymentError>
{
    let mut tx = app.db.begin().await?;
    let settlement = payments::settle(
        &mut tx,
        &*app.clock,
        &app.config,
        partner,
        reference,
        scanned_at,
    )
    .await?;

    tx.commit().await?;
    Ok(settlement)
}

async fn partner_of(app: &AppState, user: AuthenticatedUser)
    -> Result<partners::Partner, ApiError>
{
    let mut conn = app.db.acquire().await?;
    let found = partners::repo::find_partner_by_user(&mut conn, user.id).await?;

    match found {
        Some(partner) => Ok(partner),
        None => Err(CoreError::Forbidden.into())
    }
}
