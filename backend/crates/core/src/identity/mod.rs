pub mod login;
pub mod repo;
pub mod session;

pub use login::{login, LoginContext};
pub use session::{create_session, revoke_all_for_user, revoke_session, validate_session};

use crate::ids::UserId;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Employee,
    Partner,
    Admin,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "user_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum UserStatus {
    Active,
    Suspended,
    Closed,
}

#[derive(Debug, Clone, Copy)]
pub struct AuthenticatedUser {
    pub id: UserId,
    pub role: UserRole,
    pub status: UserStatus,
}

#[derive(Debug, Clone)]
pub struct SessionToken(pub String);

#[derive(Debug, Error)]
pub enum IdentityError {
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("account is not active")]
    AccountInactive,
    #[error("session not found or expired")]
    SessionInvalid,
    #[error(transparent)]
    Password(#[from] crate::crypto::password::PasswordError),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl From<IdentityError> for crate::error::CoreError {
    fn from(err: IdentityError) -> Self {
        use crate::error::CoreError;
        match err {
            IdentityError::InvalidCredentials | IdentityError::SessionInvalid => {
                CoreError::Unauthorized
            }
            IdentityError::AccountInactive => CoreError::AccountInactive,
            IdentityError::Db(e) => CoreError::Db(e),
            IdentityError::Password(_) => CoreError::Internal,
        }
    }
}
