//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// repo
//

use chrono::{DateTime, Utc};
use sqlx::PgConnection;

use super::{Account, EntryDirection, LedgerOperation, OperationKind, Posting, DIGEST_LEN};
use crate::ids::{AccountId, OperationId};
use crate::money::Money;

const ACCOUNT_COLUMNS: &str = "id, owner_type, owner_id, system_code, payment_handle,
     balance_settled, balance_held, status, version, opened_at, closed_at";

pub async fn advisory_chain_lock(conn: &mut PgConnection, key: i64) -> Result<(), sqlx::Error>
{
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(key)
        .execute(conn)
        .await?;
    Ok(())
}
pub async fn find_account(
    conn: &mut PgConnection,
    id: AccountId,
) -> Result<Option<Account>, sqlx::Error>
{
    let statement = format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE id = $1");

    sqlx::query_as::<_, Account>(&statement)
        .bind(id)
        .fetch_optional(conn)
        .await
}

pub async fn select_account_for_update(
    conn: &mut PgConnection,
    id: AccountId,
) -> Result<Option<Account>, sqlx::Error>
{
    let statement = format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE id = $1 FOR UPDATE");

    sqlx::query_as::<_, Account>(&statement)
        .bind(id)
        .fetch_optional(conn)
        .await
}

pub async fn system_account(
    conn: &mut PgConnection,
    code: &str,
) -> Result<Option<AccountId>, sqlx::Error>
{
    sqlx::query_scalar::<_, AccountId>("SELECT id FROM accounts WHERE system_code = $1")
        .bind(code)
        .fetch_optional(conn)
        .await
}

pub async fn insert_operation(
    conn: &mut PgConnection,
    kind: OperationKind,
    posting: &Posting,
) -> Result<LedgerOperation, sqlx::Error>
{
    sqlx::query_as::<_, LedgerOperation>(
        "INSERT INTO ledger_operations
             (id, kind, amount, memo, created_by, occurred_at, recorded_at)
         VALUES (COALESCE($1::UUID, gen_random_uuid()), $2, $3, $4, $5, $6,
                 COALESCE($7::TIMESTAMPTZ, now()))
         RETURNING id, kind, amount, memo, created_by, occurred_at, recorded_at",
    )
    .bind(posting.operation_id)
    .bind(kind)
    .bind(posting.amount)
    .bind(posting.memo.as_deref())
    .bind(posting.created_by)
    .bind(posting.occurred_at)
    .bind(posting.recorded_at)
    .fetch_one(conn)
    .await
}

pub async fn next_entry_seq(conn: &mut PgConnection) -> Result<i64, sqlx::Error>
{
    sqlx::query_scalar::<_, i64>(
        "SELECT nextval(pg_get_serial_sequence('ledger_entries', 'seq'))",
    )
    .fetch_one(conn)
    .await
}

pub async fn last_entry_hash(
    conn: &mut PgConnection,
) -> Result<Option<(i64, Vec<u8>)>, sqlx::Error>
{
    sqlx::query_as::<_, (i64, Vec<u8>)>(
        "SELECT seq, hash FROM ledger_entries ORDER BY seq DESC LIMIT 1",
    )
    .fetch_optional(conn)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_entry(
    conn: &mut PgConnection,
    seq: i64,
    operation_id: OperationId,
    account_id: AccountId,
    direction: EntryDirection,
    amount: Money,
    recorded_at: DateTime<Utc>,
    prev_hash: &[u8; DIGEST_LEN],
    hash: &[u8; DIGEST_LEN],
) -> Result<(), sqlx::Error>
{
    sqlx::query(
        "INSERT INTO ledger_entries
             (seq, operation_id, account_id, direction, amount, recorded_at, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(seq)
    .bind(operation_id)
    .bind(account_id)
    .bind(direction)
    .bind(amount)
    .bind(recorded_at)
    .bind(prev_hash.as_slice())
    .bind(hash.as_slice())
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn adjust_settled(
    conn: &mut PgConnection,
    id: AccountId,
    delta: i64,
) -> Result<bool, sqlx::Error>
{
    let affected = sqlx::query(
        "UPDATE accounts
            SET balance_settled = balance_settled + $2,
                version = version + 1
          WHERE id = $1
            AND (owner_type = 'system' OR balance_settled + $2 >= balance_held)",
    )
    .bind(id)
    .bind(delta)
    .execute(conn)
    .await?
    .rows_affected();

    Ok(affected == 1)
}

pub async fn add_hold(
    conn: &mut PgConnection,
    id: AccountId,
    amount: Money,
) -> Result<bool, sqlx::Error>
{
    let affected = sqlx::query(
        "UPDATE accounts
            SET balance_held = balance_held + $2,
                version = version + 1
          WHERE id = $1
            AND status = 'active'
            AND (owner_type = 'system' OR balance_settled - balance_held >= $2)",
    )
    .bind(id)
    .bind(amount)
    .execute(conn)
    .await?
    .rows_affected();

    Ok(affected == 1)
}

pub async fn remove_hold(
    conn: &mut PgConnection,
    id: AccountId,
    amount: Money,
) -> Result<bool, sqlx::Error>
{
    let affected = sqlx::query(
        "UPDATE accounts
            SET balance_held = balance_held - $2,
                version = version + 1
          WHERE id = $1
            AND balance_held >= $2",
    )
    .bind(id)
    .bind(amount)
    .execute(conn)
    .await?
    .rows_affected();

    Ok(affected == 1)
}
