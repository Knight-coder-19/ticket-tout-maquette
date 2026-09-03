// Define ApiError with IntoResponse following the mapping table, emitting { error, message, request_id }.
// The front reacts on `error`, never on `message`, and Db(_) becomes 500 INTERNAL, no SQL detail leaked.
// Priority: P0

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use cartepro_core::directory::DirectoryError;
use cartepro_core::error::CoreError;
use cartepro_core::money::InvalidMoneyError;
use cartepro_core::partners::PartnerError;
use cartepro_core::payments::PaymentError;
use serde::Serialize;

/// The single error body of the API. `request_id` injected by the middleware.
#[derive(Debug, Serialize)]
pub struct ErrorBody {
    /// Stable code, e.g. `TOKEN_EXPIRED`. SCREAMING_SNAKE, never renamed.
    pub error: &'static str,
    /// Human message. Never meant for code, never an SQL detail.
    pub message: String,
    pub request_id: String,
}

/// HTTP wrapper for business errors. `From<CoreError>` does all the translation.
#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self { status, code, message: message.into() }
    }

    /// Generic 500. The detail is logged, never returned.
    pub fn internal() -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL", "internal error")
    }

    pub fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "UNAUTHORIZED", "authentication required")
    }

    pub fn forbidden() -> Self {
        Self::new(StatusCode::FORBIDDEN, "FORBIDDEN", "forbidden")
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        // The real request_id is re-injected by the request_id middleware;
        // this is a fallback value.
        let body = ErrorBody {
            error: self.code,
            message: self.message,
            request_id: String::new(),
        };
        (self.status, Json(body)).into_response()
    }
}

/// CoreError → HTTP translation (table in `file-guide.md` §4.1 and `data-dictionary.md` §6).
impl From<CoreError> for ApiError {
    fn from(err: CoreError) -> Self {
        let (status, code): (StatusCode, &'static str) = match &err {
            CoreError::Unauthorized => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED"),
            CoreError::Forbidden => (StatusCode::FORBIDDEN, "FORBIDDEN"),
            CoreError::TokenNotFound => (StatusCode::NOT_FOUND, "TOKEN_NOT_FOUND"),
            CoreError::TokenExpired => (StatusCode::GONE, "TOKEN_EXPIRED"),
            CoreError::TokenAlreadyUsed => (StatusCode::CONFLICT, "TOKEN_ALREADY_USED"),
            CoreError::InsufficientFunds => {
                (StatusCode::UNPROCESSABLE_ENTITY, "INSUFFICIENT_FUNDS")
            }
            CoreError::PartnerNotApproved => (StatusCode::FORBIDDEN, "PARTNER_NOT_APPROVED"),
            CoreError::AccountInactive => (StatusCode::FORBIDDEN, "ACCOUNT_INACTIVE"),
            CoreError::DuplicateBatch => (StatusCode::CONFLICT, "DUPLICATE_BATCH"),
            CoreError::BatchHasErrors => (StatusCode::UNPROCESSABLE_ENTITY, "BATCH_HAS_ERRORS"),
            CoreError::HighlightNotEligible => {
                (StatusCode::UNPROCESSABLE_ENTITY, "HIGHLIGHT_NOT_ELIGIBLE")
            }
            CoreError::HighlightDuplicate => (StatusCode::CONFLICT, "HIGHLIGHT_DUPLICATE"),
            CoreError::ResyncTooLate => (StatusCode::UNPROCESSABLE_ENTITY, "RESYNC_TOO_LATE"),
            CoreError::Money(_) => (StatusCode::UNPROCESSABLE_ENTITY, "VALIDATION_FAILED"),
            CoreError::Internal | CoreError::Db(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL")
            }
        };

        let message = match &err {
            CoreError::Internal | CoreError::Db(_) => "internal error".to_string(),
            other => other.to_string(),
        };
        ApiError { status, code, message }
    }
}

/// `?` on a bare sqlx error in a handler → 500, no leak.
impl From<sqlx::Error> for ApiError {
    fn from(_: sqlx::Error) -> Self {
        ApiError::internal()
    }
}

impl From<InvalidMoneyError> for ApiError {
    fn from(err: InvalidMoneyError) -> Self {
        ApiError::from(CoreError::from(err))
    }
}

impl From<PaymentError> for ApiError {
    fn from(err: PaymentError) -> Self {
        let status = match &err {
            PaymentError::UnknownToken => StatusCode::NOT_FOUND,
            PaymentError::TokenExpired => StatusCode::GONE,
            PaymentError::TokenAlreadyUsed | PaymentError::TokenCancelled => StatusCode::CONFLICT,
            PaymentError::PartnerNotApproved | PaymentError::AccountInactive => {
                StatusCode::FORBIDDEN
            }
            PaymentError::InsufficientFunds | PaymentError::ResyncTooLate => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            PaymentError::ShortCodeUnavailable
            | PaymentError::Ledger(_)
            | PaymentError::Db(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let message = match &err {
            PaymentError::ShortCodeUnavailable
            | PaymentError::Ledger(_)
            | PaymentError::Db(_) => "internal error".to_string(),
            other => other.to_string(),
        };
        ApiError { status, code: err.code(), message }
    }
}

impl From<PartnerError> for ApiError {
    fn from(err: PartnerError) -> Self {
        ApiError::from(CoreError::from(err))
    }
}

impl From<DirectoryError> for ApiError {
    fn from(err: DirectoryError) -> Self {
        ApiError::from(CoreError::from(err))
    }
}
