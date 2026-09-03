// Hold the topups and topup_batches queries, including the file-fingerprint lookup. No business rule here.
// Priority: P1

use sqlx::postgres::PgRow;
use sqlx::{PgConnection, Row};

use super::Topup;
use crate::ids::{AccountId, BatchId, EmployerId, OperationId};

const TOPUP_COLUMNS: &str = "t.operation_id, t.batch_id, t.employer_id, t.to_account,
     o.amount, t.reference";

fn topup_from_row(row: &PgRow) -> Result<Topup, sqlx::Error>
{
    Ok(Topup {
        operation_id: row.try_get("operation_id")?,
        batch_id: row.try_get("batch_id")?,
        employer_id: row.try_get("employer_id")?,
        to_account: row.try_get("to_account")?,
        amount: row.try_get("amount")?,
        reference: row.try_get("reference")?
    })
}

pub async fn find_topup_by_reference(
    conn: &mut PgConnection,
    employer_id: EmployerId,
    reference: &str,
) -> Result<Option<Topup>, sqlx::Error>
{
    let statement = format!(
        "SELECT {TOPUP_COLUMNS}
           FROM topups t
           JOIN ledger_operations o ON o.id = t.operation_id
          WHERE t.employer_id = $1
            AND t.reference = $2"
    );
    let row = sqlx::query(&statement)
        .bind(employer_id)
        .bind(reference)
        .fetch_optional(conn)
        .await?;

    match row {
        Some(row) => Ok(Some(topup_from_row(&row)?)),
        None => Ok(None)
    }
}

pub async fn insert_topup(
    conn: &mut PgConnection,
    operation_id: OperationId,
    batch_id: Option<BatchId>,
    employer_id: EmployerId,
    to_account: AccountId,
    reference: Option<&str>,
) -> Result<Topup, sqlx::Error>
{
    let statement = format!(
        "WITH t AS (
             INSERT INTO topups (operation_id, batch_id, employer_id, to_account, reference)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING operation_id, batch_id, employer_id, to_account, reference
         )
         SELECT {TOPUP_COLUMNS}
           FROM t
           JOIN ledger_operations o ON o.id = t.operation_id"
    );
    let row = sqlx::query(&statement)
        .bind(operation_id)
        .bind(batch_id)
        .bind(employer_id)
        .bind(to_account)
        .bind(reference)
        .fetch_one(conn)
        .await?;

    topup_from_row(&row)
}
