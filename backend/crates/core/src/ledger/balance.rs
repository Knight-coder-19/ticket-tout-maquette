//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// balance
//

use sqlx::{PgConnection, PgExecutor};

use super::{entry_hash, LedgerEntry, DIGEST_LEN, GENESIS_HASH};
use crate::ids::AccountId;
use crate::money::Money;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChainStatus {
    Intact,
    BrokenAt(i64),
}

impl ChainStatus {
    pub fn is_intact(self) -> bool
    {
        self == ChainStatus::Intact
    }
}

pub async fn recompute_balance<'e, E>(executor: E, id: AccountId) -> Result<i64, sqlx::Error>
where
    E: PgExecutor<'e>,
{
    sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)::BIGINT
           FROM ledger_entries
          WHERE account_id = $1",
    )
    .bind(id)
    .fetch_one(executor)
    .await
}

pub async fn recompute_held<'e, E>(executor: E, id: AccountId) -> Result<Money, sqlx::Error>
where
    E: PgExecutor<'e>,
{
    sqlx::query_scalar::<_, Money>(
        "SELECT COALESCE(SUM(amount), 0)::BIGINT
           FROM payment_tokens
          WHERE account_id = $1
            AND status = 'active'",
    )
    .bind(id)
    .fetch_one(executor)
    .await
}

pub async fn verify_chain(
    conn: &mut PgConnection,
    from_seq: i64,
) -> Result<ChainStatus, sqlx::Error>
{
    let anchor = sqlx::query_scalar::<_, Vec<u8>>(
        "SELECT hash FROM ledger_entries WHERE seq < $1 ORDER BY seq DESC LIMIT 1",
    )
    .bind(from_seq)
    .fetch_optional(&mut *conn)
    .await?;

    let mut previous: [u8; DIGEST_LEN] = match anchor {
        Some(bytes) => match super::digest_from_slice(&bytes) {
            Some(digest) => digest,
            None => return Ok(ChainStatus::BrokenAt(from_seq))
        },
        None => GENESIS_HASH
    };

    let entries = sqlx::query_as::<_, LedgerEntry>(
        "SELECT seq, operation_id, account_id, direction, amount, recorded_at, prev_hash, hash
           FROM ledger_entries
          WHERE seq >= $1
          ORDER BY seq",
    )
    .bind(from_seq)
    .fetch_all(conn)
    .await?;

    for entry in entries {
        if entry.prev_hash.as_slice() != previous.as_slice() {
            return Ok(ChainStatus::BrokenAt(entry.seq));
        }

        let expected = entry_hash(
            entry.seq,
            entry.operation_id,
            entry.account_id,
            entry.direction,
            entry.amount,
            entry.recorded_at,
            &previous,
        );

        if entry.hash.as_slice() != expected.as_slice() {
            return Ok(ChainStatus::BrokenAt(entry.seq));
        }
        previous = expected;
    }
    Ok(ChainStatus::Intact)
}
