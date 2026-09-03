//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// payments
//

pub mod authorize;
pub mod expire;
pub mod repo;
pub mod settle;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};

use crate::ids::{AccountId, Jti, OperationId, PartnerId};
use crate::ledger::LedgerError;
use crate::money::Money;

pub use authorize::{authorize, IssuedToken};
pub use expire::expire_stale_tokens;
pub use settle::{cancel, settle};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "token_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum TokenStatus {
    Active,
    Consumed,
    Expired,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "entry_mode", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EntryMode {
    QrScan,
    ShortCode,
}

#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct PaymentToken {
    pub jti: Jti,
    pub account_id: AccountId,
    pub amount: Money,
    pub short_code: String,
    pub status: TokenStatus,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct Payment {
    pub operation_id: OperationId,
    pub token_jti: Jti,
    pub partner_id: PartnerId,
    pub from_account: AccountId,
    pub entry_mode: EntryMode,
    pub scanned_at: DateTime<Utc>,
    pub synced_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Settlement {
    pub payment: Payment,
    pub amount: Money,
}

impl<'r> FromRow<'r, PgRow> for Settlement {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error>
    {
        Ok(Settlement {
            payment: Payment::from_row(row)?,
            amount: row.try_get("amount")?
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartnerActivity {
    pub settlement: Settlement,
    pub customer_label: String,
}

impl<'r> FromRow<'r, PgRow> for PartnerActivity {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error>
    {
        Ok(PartnerActivity {
            settlement: Settlement::from_row(row)?,
            customer_label: row.try_get("customer_label")?
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::FromRow)]
pub struct PartnerTotals {
    pub total_received: Money,
    pub transaction_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TokenRef {
    Jti(Jti),
    ShortCode(String),
}

impl TokenRef {
    pub fn entry_mode(&self) -> EntryMode
    {
        match self {
            TokenRef::Jti(_) => EntryMode::QrScan,
            TokenRef::ShortCode(_) => EntryMode::ShortCode
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PaymentError {
    #[error("unknown payment token")]
    UnknownToken,

    #[error("payment token has expired")]
    TokenExpired,

    #[error("payment token was already consumed")]
    TokenAlreadyUsed,

    #[error("payment token was cancelled")]
    TokenCancelled,

    #[error("partner is not approved")]
    PartnerNotApproved,

    #[error("account is suspended or closed")]
    AccountInactive,

    #[error("insufficient available balance")]
    InsufficientFunds,

    #[error("resynchronisation past the allowed delay")]
    ResyncTooLate,

    #[error("no short code available")]
    ShortCodeUnavailable,

    #[error(transparent)]
    Ledger(#[from] LedgerError),

    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl PaymentError {
    pub fn code(&self) -> &'static str
    {
        match self {
            PaymentError::UnknownToken => "TOKEN_NOT_FOUND",
            PaymentError::TokenExpired => "TOKEN_EXPIRED",
            PaymentError::TokenAlreadyUsed => "TOKEN_ALREADY_USED",
            PaymentError::TokenCancelled => "TOKEN_ALREADY_USED",
            PaymentError::PartnerNotApproved => "PARTNER_NOT_APPROVED",
            PaymentError::AccountInactive => "ACCOUNT_INACTIVE",
            PaymentError::InsufficientFunds => "INSUFFICIENT_FUNDS",
            PaymentError::ResyncTooLate => "RESYNC_TOO_LATE",
            _ => "INTERNAL"
        }
    }
}
