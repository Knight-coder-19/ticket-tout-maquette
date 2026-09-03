//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// repo
//

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};

use super::{EntryMode, PartnerActivity, PartnerTotals, Payment, PaymentToken, Settlement};
use crate::ids::{AccountId, Jti, OperationId, PartnerId};
use crate::money::Money;

const TOKEN_COLUMNS: &str =
    "jti, account_id, amount, short_code, status, issued_at, expires_at, resolved_at";

const PAYMENT_COLUMNS: &str =
    "operation_id, token_jti, partner_id, from_account, entry_mode, scanned_at, synced_at";

const QUALIFIED_PAYMENT_COLUMNS: &str =
    "p.operation_id, p.token_jti, p.partner_id, p.from_account, p.entry_mode, p.scanned_at,
     p.synced_at";

pub async fn insert_token(
    conn: &mut PgConnection,
    jti: Jti,
    account_id: AccountId,
    amount: Money,
    short_code: &str,
    issued_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
) -> Result<(), sqlx::Error>
{
    sqlx::query(
        "INSERT INTO payment_tokens
             (jti, account_id, amount, short_code, issued_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(jti)
    .bind(account_id)
    .bind(amount)
    .bind(short_code)
    .bind(issued_at)
    .bind(expires_at)
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn short_code_in_use(
    conn: &mut PgConnection,
    short_code: &str,
) -> Result<bool, sqlx::Error>
{
    let found = sqlx::query_scalar::<_, i32>(
        "SELECT 1 FROM payment_tokens WHERE short_code = $1 AND status = 'active'",
    )
    .bind(short_code)
    .fetch_optional(conn)
    .await?;

    Ok(found.is_some())
}

pub async fn lock_token(
    conn: &mut PgConnection,
    jti: Jti,
) -> Result<Option<PaymentToken>, sqlx::Error>
{
    let statement =
        format!("SELECT {TOKEN_COLUMNS} FROM payment_tokens WHERE jti = $1 FOR UPDATE");

    sqlx::query_as::<_, PaymentToken>(&statement)
        .bind(jti)
        .fetch_optional(conn)
        .await
}

pub async fn find_token(
    conn: &mut PgConnection,
    jti: Jti,
) -> Result<Option<PaymentToken>, sqlx::Error>
{
    let statement = format!("SELECT {TOKEN_COLUMNS} FROM payment_tokens WHERE jti = $1");

    sqlx::query_as::<_, PaymentToken>(&statement)
        .bind(jti)
        .fetch_optional(conn)
        .await
}

pub async fn find_jti_by_short_code(
    conn: &mut PgConnection,
    short_code: &str,
) -> Result<Option<Jti>, sqlx::Error>
{
    sqlx::query_scalar::<_, Jti>(
        "SELECT jti FROM payment_tokens
          WHERE short_code = $1
          ORDER BY issued_at DESC
          LIMIT 1",
    )
    .bind(short_code)
    .fetch_optional(conn)
    .await
}

pub async fn consume_token(
    conn: &mut PgConnection,
    jti: Jti,
    resolved_at: DateTime<Utc>,
) -> Result<bool, sqlx::Error>
{
    let affected = sqlx::query(
        "UPDATE payment_tokens
            SET status = 'consumed', resolved_at = $2
          WHERE jti = $1
            AND status IN ('active', 'expired')",
    )
    .bind(jti)
    .bind(resolved_at)
    .execute(conn)
    .await?
    .rows_affected();

    Ok(affected == 1)
}

pub async fn cancel_token(
    conn: &mut PgConnection,
    jti: Jti,
    resolved_at: DateTime<Utc>,
) -> Result<bool, sqlx::Error>
{
    resolve_token(conn, jti, "cancelled", resolved_at).await
}

pub async fn expire_token(
    conn: &mut PgConnection,
    jti: Jti,
    resolved_at: DateTime<Utc>,
) -> Result<bool, sqlx::Error>
{
    resolve_token(conn, jti, "expired", resolved_at).await
}

async fn resolve_token(
    conn: &mut PgConnection,
    jti: Jti,
    status: &str,
    resolved_at: DateTime<Utc>,
) -> Result<bool, sqlx::Error>
{
    let affected = sqlx::query(
        "UPDATE payment_tokens
            SET status = $2::token_status, resolved_at = $3
          WHERE jti = $1
            AND status = 'active'",
    )
    .bind(jti)
    .bind(status)
    .bind(resolved_at)
    .execute(conn)
    .await?
    .rows_affected();

    Ok(affected == 1)
}

pub async fn stale_tokens(
    pool: &PgPool,
    now: DateTime<Utc>,
    limit: i64,
) -> Result<Vec<PaymentToken>, sqlx::Error>
{
    let statement = format!(
        "SELECT {TOKEN_COLUMNS} FROM payment_tokens
          WHERE status = 'active'
            AND expires_at <= $1
          ORDER BY expires_at
          LIMIT $2"
    );

    sqlx::query_as::<_, PaymentToken>(&statement)
        .bind(now)
        .bind(limit)
        .fetch_all(pool)
        .await
}

pub async fn find_payment_by_jti(
    conn: &mut PgConnection,
    jti: Jti,
) -> Result<Option<Payment>, sqlx::Error>
{
    let statement = format!("SELECT {PAYMENT_COLUMNS} FROM payments WHERE token_jti = $1");

    sqlx::query_as::<_, Payment>(&statement)
        .bind(jti)
        .fetch_optional(conn)
        .await
}

pub async fn insert_payment(
    conn: &mut PgConnection,
    operation_id: OperationId,
    jti: Jti,
    partner: PartnerId,
    from_account: AccountId,
    entry_mode: EntryMode,
    scanned_at: DateTime<Utc>,
) -> Result<Payment, sqlx::Error>
{
    let statement = format!(
        "INSERT INTO payments
             (operation_id, token_jti, partner_id, from_account, entry_mode, scanned_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING {PAYMENT_COLUMNS}"
    );

    sqlx::query_as::<_, Payment>(&statement)
        .bind(operation_id)
        .bind(jti)
        .bind(partner)
        .bind(from_account)
        .bind(entry_mode)
        .bind(scanned_at)
        .fetch_one(conn)
        .await
}

pub async fn operation_amount(
    conn: &mut PgConnection,
    operation_id: OperationId,
) -> Result<Money, sqlx::Error>
{
    sqlx::query_scalar::<_, Money>("SELECT amount FROM ledger_operations WHERE id = $1")
        .bind(operation_id)
        .fetch_one(conn)
        .await
}

pub async fn find_settlement_by_jti(
    conn: &mut PgConnection,
    jti: Jti,
) -> Result<Option<Settlement>, sqlx::Error>
{
    let payment = match find_payment_by_jti(&mut *conn, jti).await? {
        Some(payment) => payment,
        None => return Ok(None)
    };
    let amount = operation_amount(conn, payment.operation_id).await?;

    Ok(Some(Settlement { payment, amount }))
}

pub async fn list_partner_settlements(
    pool: &PgPool,
    partner: PartnerId,
    limit: i64,
) -> Result<Vec<Settlement>, sqlx::Error>
{
    let statement = format!(
        "SELECT {QUALIFIED_PAYMENT_COLUMNS}, o.amount
           FROM payments p
           JOIN ledger_operations o ON o.id = p.operation_id
          WHERE p.partner_id = $1
          ORDER BY p.scanned_at DESC
          LIMIT $2"
    );

    sqlx::query_as::<_, Settlement>(&statement)
        .bind(partner)
        .bind(limit)
        .fetch_all(pool)
        .await
}

pub async fn partner_totals(
    pool: &PgPool,
    partner: PartnerId,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<PartnerTotals, sqlx::Error>
{
    sqlx::query_as::<_, PartnerTotals>(
        "SELECT COALESCE(SUM(o.amount), 0)::BIGINT AS total_received,
                COUNT(*)::BIGINT                   AS transaction_count
           FROM payments p
           JOIN ledger_operations o ON o.id = p.operation_id
          WHERE p.partner_id = $1
            AND p.scanned_at >= $2
            AND p.scanned_at < $3",
    )
    .bind(partner)
    .bind(from)
    .bind(to)
    .fetch_one(pool)
    .await
}

pub async fn list_partner_activity(
    pool: &PgPool,
    partner: PartnerId,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    limit: i64,
) -> Result<Vec<PartnerActivity>, sqlx::Error>
{
    let statement = format!(
        "SELECT {QUALIFIED_PAYMENT_COLUMNS}, o.amount,
                COALESCE(left(e.first_name, 1) || '. ' || left(e.last_name, 1) || '.', '-')
                    AS customer_label
           FROM payments p
           JOIN ledger_operations o ON o.id = p.operation_id
           LEFT JOIN accounts a ON a.id = p.from_account
           LEFT JOIN employees e ON e.id = a.owner_id
          WHERE p.partner_id = $1
            AND p.scanned_at >= $2
            AND p.scanned_at < $3
          ORDER BY p.scanned_at DESC
          LIMIT $4"
    );

    sqlx::query_as::<_, PartnerActivity>(&statement)
        .bind(partner)
        .bind(from)
        .bind(to)
        .bind(limit)
        .fetch_all(pool)
        .await
}
