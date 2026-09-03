//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// mod
//


use crate::directory::City;
use crate::ids::{AccountId, OperationId};
use crate::ledger::balance::ChainStatus;
use crate::ledger::OperationKind;
use crate::money::Money;
use chrono::{DateTime, Utc};
use sqlx::postgres::PgRow;
use sqlx::{PgConnection, PgPool, Row};
use thiserror::Error;
use uuid::Uuid;

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

#[derive(Debug, Clone, Copy)]
pub struct Period {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}


#[derive(Debug, Clone, Copy)]
pub struct EmployeeBalance {
    pub settled: Money,
    pub held: Money,
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

fn statement_line_from_row(row: &PgRow) -> Result<StatementLine, sqlx::Error>
{
    Ok(StatementLine {
        operation_id: row.try_get("id")?,
        kind: row.try_get("kind")?,
        amount: row.try_get("amount")?,
        incoming: row.try_get("incoming")?,
        counterparty: row.try_get("counterparty")?,
        occurred_at: row.try_get("occurred_at")?,
        reference: row.try_get("reference")?
    })
}

pub async fn employee_balance(
    conn: &mut PgConnection,
    account: AccountId,
) -> Result<EmployeeBalance, ReportingError> {
    let (settled, held) = sqlx::query_as::<_, (Money, Money)>(
        "SELECT balance_settled, balance_held FROM accounts WHERE id = $1",
    )
    .bind(account)
    .fetch_one(conn)
    .await?;

    Ok(EmployeeBalance {
        settled,
        held,
        available: settled.checked_sub(held).unwrap_or_else(Money::zero)
    })
}

pub async fn employee_statement(
    pool: &PgPool,
    account: AccountId,
    limit: i64,
    cursor: Option<&str>,
) -> Result<Vec<StatementLine>, sqlx::Error> {
    let cursor = cursor.and_then(|value| Uuid::parse_str(value).ok());
    let rows = sqlx::query(
        "SELECT o.id, o.kind, o.amount, o.occurred_at,
                (e.direction = 'credit') AS incoming,
                COALESCE(pt.trade_name, emp.legal_name, oa.system_code, '-') AS counterparty,
                t.reference
           FROM ledger_entries e
           JOIN ledger_operations o ON o.id = e.operation_id
           LEFT JOIN ledger_entries oe
                  ON oe.operation_id = o.id AND oe.account_id <> e.account_id
           LEFT JOIN accounts oa ON oa.id = oe.account_id
           LEFT JOIN payments pay ON pay.operation_id = o.id
           LEFT JOIN partners pt ON pt.id = pay.partner_id
           LEFT JOIN topups t ON t.operation_id = o.id
           LEFT JOIN employers emp ON emp.id = t.employer_id
          WHERE e.account_id = $1
            AND ($2::UUID IS NULL
                 OR ROW(o.occurred_at, o.id)
                    < (SELECT c.occurred_at, c.id
                         FROM ledger_operations c
                        WHERE c.id = $2::UUID))
          ORDER BY o.occurred_at DESC, o.id DESC
          LIMIT $3",
    )
    .bind(account)
    .bind(cursor)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    let mut lines = Vec::with_capacity(rows.len());

    for row in &rows {
        lines.push(statement_line_from_row(row)?);
    }
    Ok(lines)
}


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
    pub online_partners: OnlineVolume,
}

fn city_volume_from_row(row: &PgRow) -> Result<CityVolume, sqlx::Error>
{
    Ok(CityVolume {
        city: City {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            department: row.try_get("department")?
        },
        volume: row.try_get("volume")?,
        transaction_count: row.try_get("transaction_count")?
    })
}

pub async fn national_dashboard(
    conn: &mut PgConnection,
    period: Period,
) -> Result<NationalDashboard, ReportingError> {
    let (total_volume, transaction_count) = sqlx::query_as::<_, (Money, i64)>(
        "SELECT COALESCE(SUM(o.amount), 0)::BIGINT AS volume,
                COUNT(*)::BIGINT                   AS transaction_count
           FROM payments p
           JOIN ledger_operations o ON o.id = p.operation_id
          WHERE ($1::TIMESTAMPTZ IS NULL OR p.scanned_at >= $1)
            AND ($2::TIMESTAMPTZ IS NULL OR p.scanned_at < $2)",
    )
    .bind(period.from)
    .bind(period.to)
    .fetch_one(&mut *conn)
    .await?;

    let (active_partners, pending_partners, active_employees) =
        sqlx::query_as::<_, (i64, i64, i64)>(
            "SELECT (SELECT COUNT(*) FROM partners WHERE status = 'approved')::BIGINT,
                    (SELECT COUNT(*) FROM partners WHERE status = 'pending')::BIGINT,
                    (SELECT COUNT(DISTINCT employee_id)
                       FROM employment_links WHERE status = 'active')::BIGINT",
        )
        .fetch_one(&mut *conn)
        .await?;

    let rows = sqlx::query(
        "SELECT c.id, c.name, c.department,
                COALESCE(SUM(o.amount), 0)::BIGINT AS volume,
                COUNT(*)::BIGINT                   AS transaction_count
           FROM payments p
           JOIN ledger_operations o ON o.id = p.operation_id
           JOIN partners pt ON pt.id = p.partner_id
           JOIN cities c ON c.id = pt.city_id
          WHERE ($1::TIMESTAMPTZ IS NULL OR p.scanned_at >= $1)
            AND ($2::TIMESTAMPTZ IS NULL OR p.scanned_at < $2)
          GROUP BY c.id, c.name, c.department
          ORDER BY volume DESC, c.name",
    )
    .bind(period.from)
    .bind(period.to)
    .fetch_all(&mut *conn)
    .await?;
    let mut by_city = Vec::with_capacity(rows.len());

    for row in &rows {
        by_city.push(city_volume_from_row(row)?);
    }

    let (online_volume, online_count) = sqlx::query_as::<_, (Money, i64)>(
        "SELECT COALESCE(SUM(o.amount), 0)::BIGINT AS volume,
                COUNT(*)::BIGINT                   AS transaction_count
           FROM payments p
           JOIN ledger_operations o ON o.id = p.operation_id
           JOIN partners pt ON pt.id = p.partner_id
          WHERE pt.city_id IS NULL
            AND ($1::TIMESTAMPTZ IS NULL OR p.scanned_at >= $1)
            AND ($2::TIMESTAMPTZ IS NULL OR p.scanned_at < $2)",
    )
    .bind(period.from)
    .bind(period.to)
    .fetch_one(&mut *conn)
    .await?;

    Ok(NationalDashboard {
        total_volume,
        transaction_count,
        active_partners,
        pending_partners,
        active_employees,
        by_city,
        online_partners: OnlineVolume { volume: online_volume, transaction_count: online_count }
    })
}

pub async fn verify_chain(
    conn: &mut PgConnection,
    from_seq: i64,
) -> Result<ChainVerification, ReportingError> {
    let checked_entries =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*)::BIGINT FROM ledger_entries WHERE seq >= $1")
            .bind(from_seq)
            .fetch_one(&mut *conn)
            .await?;

    let verification = match crate::ledger::balance::verify_chain(conn, from_seq).await? {
        ChainStatus::Intact => ChainVerification {
            valid: true,
            checked_entries,
            first_invalid_seq: None
        },
        ChainStatus::BrokenAt(seq) => ChainVerification {
            valid: false,
            checked_entries,
            first_invalid_seq: Some(seq)
        }
    };

    Ok(verification)
}

#[derive(Debug, Clone, Copy)]
pub struct ChainVerification {
    pub valid: bool,
    pub checked_entries: i64,
    pub first_invalid_seq: Option<i64>,
}
