// Read-only only, never an INSERT. Aggregate on occurred_at.
// A1: the national dashboard needs a separate online_partners block, otherwise the sum of by_city
// no longer equals total_volume. Priority: P2

use crate::directory::City;
use crate::ids::{AccountId, OperationId, PartnerId};
use crate::ledger::OperationKind;
use crate::money::Money;
use crate::payments::EntryMode;
use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReportingError {
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl From<ReportingError> for crate::error::CoreError {
    fn from(err: ReportingError) -> Self {
        match err {
            ReportingError::Db(e) => crate::error::CoreError::Db(e),
        }
    }
}

/// Time window of a report. Both bounds optional.
#[derive(Debug, Clone, Copy)]
pub struct Period {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

// ── Employee ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
pub struct EmployeeBalance {
    pub settled: Money,
    pub held: Money,
    /// `settled - held`. The number shown large.
    pub available: Money,
}

#[derive(Debug, Clone)]
pub struct StatementLine {
    pub operation_id: OperationId,
    pub kind: OperationKind,
    pub amount: Money,
    pub incoming: bool,
    pub counterparty: String,
    pub occurred_at: DateTime<Utc>,
    pub reference: Option<String>,
}

pub async fn employee_balance(
    conn: &mut PgConnection,
    account: AccountId,
) -> Result<EmployeeBalance, ReportingError> {
    todo!()
}

pub async fn employee_statement(
    pool: &PgPool,
    account: AccountId,
    limit: i64,
    cursor: Option<&str>,
) -> Result<Vec<StatementLine>, sqlx::Error> {
    todo!()
}

// ── Partner ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct PartnerSummary {
    /// Cumulative amount received — NOT a balance (decision 9).
    pub total_received: Money,
    pub transaction_count: i64,
    pub period_from: DateTime<Utc>,
    pub period_to: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct PartnerTxRow {
    pub operation_id: OperationId,
    pub amount: Money,
    pub entry_mode: EntryMode,
    /// = `scanned_at`.
    pub occurred_at: DateTime<Utc>,
    pub synced_at: DateTime<Utc>,
    /// "K. A." — never the full name.
    pub customer_label: String,
}

pub async fn partner_summary(
    conn: &mut PgConnection,
    partner: PartnerId,
    period: Period,
) -> Result<PartnerSummary, ReportingError> {
    todo!()
}

pub async fn partner_transactions(
    conn: &mut PgConnection,
    partner: PartnerId,
    period: Period,
    cursor: Option<(DateTime<Utc>, OperationId)>,
    limit: u32,
) -> Result<Vec<PartnerTxRow>, ReportingError> {
    todo!()
}

// ── National dashboard ─────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct CityVolume {
    pub city: City,
    pub volume: Money,
    pub transaction_count: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct OnlineVolume {
    pub volume: Money,
    pub transaction_count: i64,
}

#[derive(Debug, Clone)]
pub struct NationalDashboard {
    pub total_volume: Money,
    pub transaction_count: i64,
    pub active_partners: i64,
    pub pending_partners: i64,
    pub active_employees: i64,
    pub by_city: Vec<CityVolume>,
    /// A1 — without this block the volume of partners with no city disappears
    /// and `sum(by_city) != total_volume`.
    pub online_partners: OnlineVolume,
}

pub async fn national_dashboard(
    conn: &mut PgConnection,
    period: Period,
) -> Result<NationalDashboard, ReportingError> {
    todo!()
}

/// Replay the hash chain. Backs `GET /admin/audit/verify`.
pub async fn verify_chain(
    conn: &mut PgConnection,
    from_seq: i64,
) -> Result<ChainVerification, ReportingError> {
    todo!()
}

#[derive(Debug, Clone, Copy)]
pub struct ChainVerification {
    pub valid: bool,
    pub checked_entries: i64,
    pub first_invalid_seq: Option<i64>,
}
