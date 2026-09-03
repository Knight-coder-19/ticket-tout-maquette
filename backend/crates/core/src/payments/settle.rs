//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// settle
//

use chrono::{DateTime, Utc};
use sqlx::PgConnection;

use super::{repo, PaymentError, Settlement, TokenRef, TokenStatus};
use crate::clock::Clock;
use crate::config::CoreConfig;
use crate::crypto::short_code;
use crate::ids::{AccountId, Jti, PartnerId};
use crate::ledger::{self, OperationKind, PgTransaction, Posting};
use crate::partners;

pub async fn settle(
    tx: &mut PgTransaction<'_>,
    clock: &dyn Clock,
    config: &CoreConfig,
    partner: PartnerId,
    reference: &TokenRef,
    scanned_at: DateTime<Utc>,
) -> Result<Settlement, PaymentError>
{
    let jti = resolve(&mut *tx, reference).await?;

    if let Some(settlement) = repo::find_settlement_by_jti(&mut *tx, jti).await? {
        if settlement.payment.partner_id == partner {
            return Ok(settlement);
        }
        return Err(PaymentError::TokenAlreadyUsed);
    }

    if clock.now() - scanned_at > config.resync_max_age {
        return Err(PaymentError::ResyncTooLate);
    }

    ledger::lock_chain(tx).await?;

    let token = match repo::lock_token(&mut *tx, jti).await? {
        Some(token) => token,
        None => return Err(PaymentError::UnknownToken)
    };
    let account = ledger::lock_account(tx, token.account_id).await?;

    match token.status {
        TokenStatus::Active => (),
        TokenStatus::Consumed => return existing_settlement(&mut *tx, jti, partner).await,
        TokenStatus::Expired => return Err(PaymentError::TokenExpired),
        TokenStatus::Cancelled => return Err(PaymentError::TokenCancelled)
    }
    if token.expires_at <= clock.now() {
        return Err(PaymentError::TokenExpired);
    }
    if !account.is_active() {
        return Err(PaymentError::AccountInactive);
    }

    let partner_account = match partners::repo::approved_account(tx, partner).await {
        Ok(partner_account) => partner_account,
        _ => return Err(PaymentError::PartnerNotApproved)
    };

    ledger::release_hold(tx, token.account_id, token.amount).await?;

    let operation = ledger::post_operation(
        tx,
        OperationKind::Payment,
        Posting {
            debit: token.account_id,
            credit: partner_account,
            amount: token.amount,
            occurred_at: scanned_at,
            memo: None,
            created_by: None
        },
    )
    .await?;

    repo::consume_token(&mut *tx, jti, scanned_at).await?;
    let payment = repo::insert_payment(
        &mut *tx,
        operation.id,
        jti,
        partner,
        token.account_id,
        reference.entry_mode(),
        scanned_at,
    )
    .await?;

    Ok(Settlement { payment, amount: token.amount })
}

pub async fn cancel(
    tx: &mut PgTransaction<'_>,
    clock: &dyn Clock,
    account_id: AccountId,
    jti: Jti,
) -> Result<(), PaymentError>
{
    let token = match repo::lock_token(&mut *tx, jti).await? {
        Some(token) => token,
        None => return Err(PaymentError::UnknownToken)
    };

    if token.account_id != account_id {
        return Err(PaymentError::UnknownToken);
    }
    match token.status {
        TokenStatus::Active => (),
        TokenStatus::Consumed => return Err(PaymentError::TokenAlreadyUsed),
        TokenStatus::Expired => return Err(PaymentError::TokenExpired),
        TokenStatus::Cancelled => return Ok(())
    }

    repo::cancel_token(&mut *tx, jti, clock.now()).await?;
    ledger::release_hold(tx, token.account_id, token.amount).await?;
    Ok(())
}

async fn existing_settlement(
    conn: &mut PgConnection,
    jti: Jti,
    partner: PartnerId,
) -> Result<Settlement, PaymentError>
{
    match repo::find_settlement_by_jti(conn, jti).await? {
        Some(settlement) if settlement.payment.partner_id == partner => Ok(settlement),
        _ => Err(PaymentError::TokenAlreadyUsed)
    }
}

async fn resolve(conn: &mut PgConnection, reference: &TokenRef) -> Result<Jti, PaymentError>
{
    let code = match reference {
        TokenRef::Jti(jti) => return Ok(*jti),
        TokenRef::ShortCode(code) => short_code::normalize(code)
    };

    if !short_code::is_valid(&code) {
        return Err(PaymentError::UnknownToken);
    }
    match repo::find_jti_by_short_code(conn, &code).await? {
        Some(jti) => Ok(jti),
        None => Err(PaymentError::UnknownToken)
    }
}
