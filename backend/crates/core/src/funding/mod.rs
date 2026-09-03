// Declare Topup, TopupBatch, BatchStatus and FundingError, and re-export topup and batch.
// topup.rs belongs to Sèdjro (money path); batch.rs / csv.rs are cut for the sprint (documented).
// Priority: P1

pub mod batch;
pub mod csv;
pub mod repo;
pub mod topup;

// Sèdjro fills `topup.rs` and uncomments: pub use topup::topup;

use crate::ids::*;
use crate::money::Money;
use chrono::{DateTime, Utc};
use thiserror::Error;

/// Postgres ENUM `batch_status`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "batch_status", rename_all = "snake_case")]
pub enum BatchStatus {
    Draft,
    Validated,
    Rejected,
}

#[derive(Debug, Clone)]
pub struct Topup {
    pub operation_id: OperationId,
    pub batch_id: Option<BatchId>,
    pub employer_id: EmployerId,
    pub to_account: AccountId,
    pub amount: Money,
    pub reference: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TopupBatch {
    pub id: BatchId,
    pub employer_id: EmployerId,
    pub file_name: String,
    pub line_count: i32,
    pub total_amount: Money,
    pub status: BatchStatus,
    pub uploaded_by: UserId,
    pub uploaded_at: DateTime<Utc>,
    pub validated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Error)]
pub enum FundingError {
    #[error("this file has already been imported")]
    DuplicateBatch,
    #[error("batch has line errors and cannot be validated")]
    BatchHasErrors,
    #[error("system account {0} is not provisioned")]
    SystemAccountMissing(&'static str),
    #[error("a system account cannot be credited by a topup")]
    SystemAccountCredited,
    #[error("target account is not active")]
    AccountInactive,
    #[error(transparent)]
    Ledger(#[from] crate::ledger::LedgerError),
    #[error(transparent)]
    Directory(#[from] crate::directory::DirectoryError),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl From<FundingError> for crate::error::CoreError {
    fn from(err: FundingError) -> Self {
        use crate::error::CoreError;
        match err {
            FundingError::DuplicateBatch => CoreError::DuplicateBatch,
            FundingError::BatchHasErrors => CoreError::BatchHasErrors,
            FundingError::AccountInactive => CoreError::AccountInactive,
            FundingError::SystemAccountMissing(_) | FundingError::SystemAccountCredited => {
                CoreError::Internal
            }
            FundingError::Ledger(e) => e.into(),
            FundingError::Directory(e) => e.into(),
            FundingError::Db(e) => CoreError::Db(e),
        }
    }
}
