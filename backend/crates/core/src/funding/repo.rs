// Hold the topups and topup_batches queries, including the file-fingerprint lookup. No business rule here.
// Priority: P1

use super::Topup;
use crate::ids::{AccountId, BatchId, EmployerId, OperationId};
use sqlx::PgConnection;

pub async fn find_topup_by_reference(
    conn: &mut PgConnection,
    employer_id: EmployerId,
    reference: &str,
) -> Result<Option<Topup>, sqlx::Error> {
    todo!()
}

pub async fn insert_topup(
    conn: &mut PgConnection,
    operation_id: OperationId,
    batch_id: Option<BatchId>,
    employer_id: EmployerId,
    to_account: AccountId,
    reference: Option<&str>,
) -> Result<Topup, sqlx::Error> {
    todo!()
}
