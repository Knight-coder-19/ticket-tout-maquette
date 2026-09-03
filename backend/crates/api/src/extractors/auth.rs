use std::marker::PhantomData;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum_extra::extract::CookieJar;
use cartepro_core::error::CoreError;
use cartepro_core::identity::{self, AuthenticatedUser, UserRole};

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

impl<R: Role> AuthUser<R> {
    pub fn user(&self) -> &AuthenticatedUser {
        &self.0
    }
    pub fn into_inner(self) -> AuthenticatedUser {
        self.0
    }
}

async fn authenticate(state: &AppState, parts: &Parts) -> Result<AuthenticatedUser, ApiError> {
    let jar = CookieJar::from_headers(&parts.headers);
    let token = jar
        .get(SESSION_COOKIE)
        .map(|cookie| cookie.value().to_string())
        .ok_or_else(|| ApiError::from(CoreError::Unauthorized))?;

    let mut conn = state
        .db
        .acquire()
        .await
        .map_err(|error| ApiError::from(CoreError::Db(error)))?;

    identity::validate_session(&mut conn, &*state.clock, &token)
        .await
        .map_err(|error| ApiError::from(CoreError::from(error)))
}

impl<R: Role + Send> FromRequestParts<AppState> for AuthUser<R> {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let user = authenticate(state, parts).await?;
        if user.role != R::VALUE {
            return Err(ApiError::from(CoreError::Forbidden));
        }
        Ok(AuthUser(user, PhantomData))
    }
}

pub struct AnyUser(pub AuthenticatedUser);

impl FromRequestParts<AppState> for AnyUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        Ok(AnyUser(authenticate(state, parts).await?))
    }
}
