use super::DirectoryError;
use crate::clock::Clock;
use crate::config::CoreConfig;
use crate::ids::EmploymentLinkId;
use crate::PgTx;

pub async fn end_employment(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    config: &CoreConfig,
    link_id: EmploymentLinkId,
) -> Result<(), DirectoryError> {
    todo!()
}
