//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// authorize
//

use chrono::{DateTime, Utc};
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use sqlx::PgConnection;

use super::{repo, PaymentError};
use crate::clock::Clock;
use crate::config::CoreConfig;
use crate::crypto::short_code;
use crate::crypto::token_sig::{self, TokenPayload};
use crate::ids::{AccountId, Jti};
use crate::ledger::{self, LedgerError, PgTransaction};
use crate::money::Money;

const CODE_ATTEMPTS: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IssuedToken {
    pub jti: Jti,
    pub short_code: String,
    pub amount: Money,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub qr: String,
}

pub async fn authorize(
    tx: &mut PgTransaction<'_>,
    clock: &dyn Clock,
    config: &CoreConfig,
    signing_key: &SigningKey,
    issuer: &str,
    account_id: AccountId,
    amount: Money,
) -> Result<IssuedToken, PaymentError>
{
    let account = ledger::lock_account(tx, account_id).await?;

    if !account.is_active() {
        return Err(PaymentError::AccountInactive);
    }

    match ledger::place_hold(tx, account_id, amount).await {
        Ok(()) => (),
        Err(LedgerError::InsufficientFunds(_)) => return Err(PaymentError::InsufficientFunds),
        Err(error) => return Err(PaymentError::Ledger(error))
    }

    let jti = Jti::new();
    let issued_at = clock.now();
    let expires_at = issued_at + config.token_ttl;
    let code = draw_short_code(&mut *tx).await?;

    repo::insert_token(&mut *tx, jti, account_id, amount, &code, issued_at, expires_at).await?;

    let payload = TokenPayload::new(jti, amount, expires_at, issuer);

    Ok(IssuedToken {
        jti,
        short_code: code,
        amount,
        issued_at,
        expires_at,
        qr: token_sig::sign(&payload, signing_key)
    })
}

async fn draw_short_code(conn: &mut PgConnection) -> Result<String, PaymentError>
{
    for _ in 0..CODE_ATTEMPTS {
        let code = short_code::generate(&mut OsRng);

        if !repo::short_code_in_use(conn, &code).await? {
            return Ok(code);
        }
    }
    Err(PaymentError::ShortCodeUnavailable)
}
