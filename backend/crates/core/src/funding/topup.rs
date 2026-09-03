//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// topup
//

use super::{repo, FundingError, Topup};
use crate::clock::Clock;
use crate::ids::{AccountId, EmployerId, UserId};
use crate::ledger::{self, OperationKind, PgTransaction, Posting};
use crate::money::Money;

pub const ISSUANCE_ACCOUNT: &str = "MINISTRY_ISSUANCE";

pub async fn topup(
    tx: &mut PgTransaction<'_>,
    clock: &dyn Clock,
    admin: UserId,
    employer_id: EmployerId,
    account_id: AccountId,
    amount: Money,
    reference: Option<&str>,
) -> Result<Topup, FundingError>
{
    ledger::lock_chain(tx).await?;

    if let Some(reference) = reference {
        let existing = repo::find_topup_by_reference(&mut *tx, employer_id, reference).await?;

        if let Some(existing) = existing {
            return Ok(existing);
        }
    }

    let issuance = match ledger::repo::system_account(&mut *tx, ISSUANCE_ACCOUNT).await? {
        Some(issuance) => issuance,
        None => return Err(FundingError::SystemAccountMissing(ISSUANCE_ACCOUNT))
    };

    ledger::lock_account(tx, issuance).await?;
    let target = ledger::lock_account(tx, account_id).await?;

    if target.is_system() {
        return Err(FundingError::SystemAccountCredited);
    }
    if !target.is_active() {
        return Err(FundingError::AccountInactive);
    }

    let operation = ledger::post_operation(
        tx,
        OperationKind::Topup,
        Posting {
            debit: issuance,
            credit: account_id,
            amount,
            occurred_at: clock.now(),
            memo: None,
            created_by: Some(admin),
            operation_id: None,
            recorded_at: None
        },
    )
    .await?;

    let topup =
        repo::insert_topup(&mut *tx, operation.id, None, employer_id, account_id, reference)
            .await?;

    Ok(topup)
}
