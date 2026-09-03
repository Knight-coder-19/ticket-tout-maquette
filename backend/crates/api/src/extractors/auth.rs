use std::marker::PhantomData;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum_extra::extract::CookieJar;
use cartepro_core::error::CoreError;
use cartepro_core::identity::{AuthenticatedUser, UserRole, UserStatus};
use cartepro_core::ids::{EmployeeId, PartnerId, UserId};

use crate::error::ApiError;
use crate::state::AppState;

pub const SESSION_COOKIE: &str = "session";

pub trait Role {
    const VALUE: UserRole;
}

pub struct Employee;
pub struct Partner;
pub struct Admin;

impl Role for Employee {
    const VALUE: UserRole = UserRole::Employee;
}

impl Role for Partner {
    const VALUE: UserRole = UserRole::Partner;
}

impl Role for Admin {
    const VALUE: UserRole = UserRole::Admin;
}

pub struct AuthUser<R: Role>(pub AuthenticatedUser, pub PhantomData<R>);

impl From<AuthenticatedUser> for EmployeeId {
    fn from(user: AuthenticatedUser) -> Self
    {
        EmployeeId::from(user.id.as_uuid())
    }
}

impl From<AuthenticatedUser> for PartnerId {
    fn from(user: AuthenticatedUser) -> Self
    {
        PartnerId::from(user.id.as_uuid())
    }
}

async fn find_session_user(
    state: &AppState,
    token: &str,
) -> Result<Option<AuthenticatedUser>, sqlx::Error>
{
    let found = sqlx::query_as::<_, (UserId, UserRole, UserStatus)>(
        "SELECT u.id, u.role, u.status FROM sessions s \
         JOIN users u ON u.id = s.user_id \
         WHERE s.token_hash = digest($1, 'sha256') \
           AND s.revoked_at IS NULL \
           AND s.expires_at > $2",
    )
    .bind(token)
    .bind(state.clock.now())
    .fetch_optional(&state.db)
    .await?;

    match found {
        Some((id, role, status)) => Ok(Some(AuthenticatedUser { id, role, status })),
        None => Ok(None)
    }
}

impl<R: Role + Send> FromRequestParts<AppState> for AuthUser<R> {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection>
    {
        let jar = CookieJar::from_headers(&parts.headers);

        let token = match jar.get(SESSION_COOKIE) {
            Some(cookie) => cookie.value().to_string(),
            None => return Err(ApiError::from(CoreError::Unauthorized))
        };

        let found = match find_session_user(state, &token).await {
            Ok(found) => found,
            Err(error) => return Err(ApiError::from(CoreError::Db(error)))
        };

        let user = match found {
            Some(user) => user,
            None => return Err(ApiError::from(CoreError::Unauthorized))
        };

        if user.status != UserStatus::Active {
            return Err(ApiError::from(CoreError::AccountInactive));
        }

        if user.role != R::VALUE {
            return Err(ApiError::from(CoreError::Forbidden));
        }
        Ok(AuthUser(user, PhantomData))
    }
}
