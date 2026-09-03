//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// expire
//

use sqlx::PgPool;

use super::{repo, PaymentError};
use crate::clock::Clock;

pub const DEFAULT_BATCH: i64 = 200;

pub async fn expire_stale_tokens(
    pool: &PgPool,
    clock: &dyn Clock,
    limit: i64,
) -> Result<u64, PaymentError>
{
    let now = clock.now();
    let stale = repo::stale_tokens(pool, now, limit).await?;
    let mut released = 0;

    for token in stale {
        let mut tx = pool.begin().await?;

        if repo::expire_token(&mut tx, token.jti, now).await? {
            crate::ledger::release_hold(&mut tx, token.account_id, token.amount).await?;
            released += 1;
        }
        tx.commit().await?;
    }
    Ok(released)
}
