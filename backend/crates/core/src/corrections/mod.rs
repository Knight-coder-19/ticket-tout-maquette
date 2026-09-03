use crate::ids::{OperationId, UserId};
use crate::PgTx;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CorrectionError {
    #[error("original operation not found")]
    NotFound,
    #[error("cannot compensate a compensation (decision 4)")]
    CannotCompensateCompensation,
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

pub async fn compensate(
    tx: &mut PgTx<'_>,
    admin: UserId,
    original_operation_id: OperationId,
    reason: &str,
) -> Result<OperationId, CorrectionError> {
    todo!()
}
