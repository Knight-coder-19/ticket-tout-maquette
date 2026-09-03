// Implement create_employee_with_account inserting users, employees, accounts then employment_links in that order
// because of the FK cycle, and resolve_account_by_ref used by the SIRH API and the CSV import.
// Priority: P1

use super::DirectoryError;
use crate::ids::*;
use crate::PgTx;
use chrono::NaiveDate;
use sqlx::PgConnection;

/// Input data to create an employee attached to an employer.
#[derive(Debug, Clone)]
pub struct NewEmployee<'a> {
    pub email: &'a str,
    pub password_hash: &'a str,
    pub last_name: &'a str,
    pub first_name: &'a str,
    pub phone: Option<&'a str>,
    pub employer_id: EmployerId,
    pub employer_ref: &'a str,
    pub started_at: NaiveDate,
}

/// Result: the created identifiers.
#[derive(Debug, Clone, Copy)]
pub struct CreatedEmployee {
    pub user_id: UserId,
    pub employee_id: EmployeeId,
    pub account_id: AccountId,
    pub link_id: EmploymentLinkId,
}

/// Create `users` → `employees` → `accounts` → `employment_links`, IN THAT ORDER
/// (FK cycle: the account carries the employee, the link carries the account).
/// Fails with `DuplicateActiveEmployment` if the partial index `uq_active_employment` bites.
pub async fn create_employee_with_account(
    tx: &mut PgTx<'_>,
    new: NewEmployee<'_>,
) -> Result<CreatedEmployee, DirectoryError> {
    todo!()
}

/// Resolve staff number (employer_ref) → account. CONTRACT with Sèdjro (topup and SIRH).
/// Returns `UnknownEmployerRef` when the (employer, employer_ref) pair does not exist
/// or when the link is not `active`.
pub async fn resolve_account_by_ref(
    conn: &mut PgConnection,
    employer: EmployerId,
    employer_ref: &str,
) -> Result<AccountId, DirectoryError> {
    todo!()
}

pub async fn active_account(
    conn: &mut PgConnection,
    employee: EmployeeId,
) -> Result<AccountId, DirectoryError> {
    todo!()
}
