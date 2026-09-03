//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// ledger
//

pub mod balance;
pub mod hash;
pub mod repo;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, Postgres, Transaction};
use uuid::Uuid;

use crate::error::CoreError;
use crate::ids::{AccountId, OperationId, UserId};
use crate::money::Money;

pub use hash::{digest_from_slice, entry_hash, DIGEST_LEN, GENESIS_HASH};

pub type PgTransaction<'a> = Transaction<'a, Postgres>;

const CHAIN_LOCK_KEY: i64 = 42;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "entry_direction", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum EntryDirection {
    Debit,
    Credit,
}

impl EntryDirection {
    pub fn as_byte(self) -> u8
    {
        match self {
            EntryDirection::Debit => 0,
            EntryDirection::Credit => 1
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "operation_kind", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OperationKind {
    Topup,
    Payment,
    Compensation,
    ClosureForfeit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "account_owner", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum AccountOwner {
    Employee,
    Partner,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "account_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum AccountStatus {
    Active,
    Suspended,
    Closed,
}

#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct Account {
    pub id: AccountId,
    pub owner_type: AccountOwner,
    pub owner_id: Option<Uuid>,
    pub system_code: Option<String>,
    pub payment_handle: Option<String>,
    pub balance_settled: i64,
    pub balance_held: i64,
    pub status: AccountStatus,
    pub version: i64,
    pub opened_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
}

impl Account {
    pub fn is_system(&self) -> bool
    {
        self.owner_type == AccountOwner::System
    }

    pub fn is_active(&self) -> bool
    {
        self.status == AccountStatus::Active
    }

    pub fn available_cents(&self) -> i64
    {
        self.balance_settled - self.balance_held
    }

    pub fn can_cover(&self, amount: Money) -> bool
    {
        self.is_system() || self.available_cents() >= amount.cents()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct LedgerOperation {
    pub id: OperationId,
    pub kind: OperationKind,
    pub amount: Money,
    pub memo: Option<String>,
    pub created_by: Option<UserId>,
    pub occurred_at: DateTime<Utc>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct LedgerEntry {
    pub seq: i64,
    pub operation_id: OperationId,
    pub account_id: AccountId,
    pub direction: EntryDirection,
    pub amount: Money,
    pub recorded_at: DateTime<Utc>,
    pub prev_hash: Vec<u8>,
    pub hash: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Posting {
    pub debit: AccountId,
    pub credit: AccountId,
    pub amount: Money,
    pub occurred_at: DateTime<Utc>,
    pub memo: Option<String>,
    pub created_by: Option<UserId>,
    pub operation_id: Option<OperationId>,
    pub recorded_at: Option<DateTime<Utc>>,
}

#[derive(Debug, thiserror::Error)]
pub enum LedgerError {
    #[error("debit and credit accounts must differ")]
    SelfTransfer,

    #[error("operation amount must be strictly positive")]
    NonPositiveAmount,

    #[error("account {0} does not exist")]
    AccountNotFound(AccountId),

    #[error("account {0} is not active")]
    AccountInactive(AccountId),

    #[error("insufficient available balance on account {0}")]
    InsufficientFunds(AccountId),

    #[error("released amount exceeds the funds held on account {0}")]
    ReleaseExceedsHold(AccountId),

    #[error("ledger entry {0} carries a hash that is not 32 bytes long")]
    CorruptedHash(i64),

    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl From<LedgerError> for CoreError {
    fn from(error: LedgerError) -> Self
    {
        match error {
            LedgerError::InsufficientFunds(_) => CoreError::InsufficientFunds,
            LedgerError::AccountInactive(_) => CoreError::AccountInactive,
            LedgerError::Db(error) => CoreError::Db(error),
            _ => CoreError::Internal
        }
    }
}

pub async fn lock_chain(tx: &mut PgTransaction<'_>) -> Result<(), LedgerError>
{
    repo::advisory_chain_lock(&mut *tx, CHAIN_LOCK_KEY).await?;
    Ok(())
}

pub async fn lock_account(
    tx: &mut PgTransaction<'_>,
    id: AccountId,
) -> Result<Account, LedgerError>
{
    match repo::select_account_for_update(&mut *tx, id).await? {
        Some(account) => Ok(account),
        None => Err(LedgerError::AccountNotFound(id))
    }
}

pub async fn post_operation(
    tx: &mut PgTransaction<'_>,
    kind: OperationKind,
    posting: Posting,
) -> Result<LedgerOperation, LedgerError>
{
    if posting.debit == posting.credit {
        return Err(LedgerError::SelfTransfer);
    }
    if !posting.amount.is_positive() {
        return Err(LedgerError::NonPositiveAmount);
    }

    let operation = repo::insert_operation(&mut *tx, kind, &posting).await?;
    let mut previous = last_hash(&mut *tx).await?;
    let sides = [
        (posting.debit, EntryDirection::Debit),
        (posting.credit, EntryDirection::Credit),
    ];

    for (account_id, direction) in sides {
        let seq = repo::next_entry_seq(&mut *tx).await?;
        let digest = entry_hash(
            seq,
            operation.id,
            account_id,
            direction,
            operation.amount,
            operation.recorded_at,
            &previous,
        );

        repo::insert_entry(
            &mut *tx,
            seq,
            operation.id,
            account_id,
            direction,
            operation.amount,
            operation.recorded_at,
            &previous,
            &digest,
        )
        .await?;
        previous = digest;
    }

    apply_settled(&mut *tx, posting.debit, -operation.amount.cents()).await?;
    apply_settled(&mut *tx, posting.credit, operation.amount.cents()).await?;
    Ok(operation)
}

pub async fn place_hold(
    tx: &mut PgTransaction<'_>,
    id: AccountId,
    amount: Money,
) -> Result<(), LedgerError>
{
    if !amount.is_positive() {
        return Err(LedgerError::NonPositiveAmount);
    }
    if repo::add_hold(&mut *tx, id, amount).await? {
        return Ok(());
    }
    match repo::find_account(&mut *tx, id).await? {
        Some(_) => Err(LedgerError::InsufficientFunds(id)),
        None => Err(LedgerError::AccountNotFound(id))
    }
}

pub async fn release_hold(
    tx: &mut PgTransaction<'_>,
    id: AccountId,
    amount: Money,
) -> Result<(), LedgerError>
{
    if !amount.is_positive() {
        return Err(LedgerError::NonPositiveAmount);
    }
    if repo::remove_hold(&mut *tx, id, amount).await? {
        return Ok(());
    }
    match repo::find_account(&mut *tx, id).await? {
        Some(_) => Err(LedgerError::ReleaseExceedsHold(id)),
        None => Err(LedgerError::AccountNotFound(id))
    }
}

async fn last_hash(conn: &mut PgConnection) -> Result<[u8; DIGEST_LEN], LedgerError>
{
    match repo::last_entry_hash(conn).await? {
        None => Ok(GENESIS_HASH),
        Some((seq, bytes)) => match digest_from_slice(&bytes) {
            Some(digest) => Ok(digest),
            None => Err(LedgerError::CorruptedHash(seq))
        }
    }
}

async fn apply_settled(
    conn: &mut PgConnection,
    id: AccountId,
    delta: i64,
) -> Result<(), LedgerError>
{
    if repo::adjust_settled(conn, id, delta).await? {
        return Ok(());
    }
    match repo::find_account(conn, id).await? {
        Some(_) => Err(LedgerError::InsufficientFunds(id)),
        None => Err(LedgerError::AccountNotFound(id))
    }
}
