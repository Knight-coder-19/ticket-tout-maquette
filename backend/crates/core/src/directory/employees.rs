use super::{repo, DirectoryError, Employee, EmploymentLink};
use crate::clock::Clock;
use crate::identity::UserRole;
use crate::ids::*;
use crate::PgTx;
use chrono::NaiveDate;
use sqlx::PgConnection;

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

#[derive(Debug, Clone)]
pub struct CreatedEmployee {
    pub employee: Employee,
    pub account_id: AccountId,
    pub link: EmploymentLink,
}

pub async fn create_employee_with_account(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    new: NewEmployee<'_>,
) -> Result<CreatedEmployee, DirectoryError> {
    let now = clock.now();

    let user_id =
        repo::insert_user(tx, new.email, new.password_hash, UserRole::Employee, now).await?;
    let employee =
        repo::insert_employee(tx, user_id, new.last_name, new.first_name, new.phone, now).await?;
    let account_id = repo::insert_account_for_employee(tx, employee.id, now).await?;

    let link = match repo::insert_employment_link(
        tx,
        employee.id,
        new.employer_id,
        new.employer_ref,
        account_id,
        new.started_at,
        now,
    )
    .await
    {
        Ok(link) => link,
        Err(sqlx::Error::Database(db)) if db.is_unique_violation() => {
            return Err(match db.constraint() {
                Some("uq_employer_ref") => DirectoryError::EmployerRefTaken,
                _ => DirectoryError::DuplicateActiveEmployment,
            })
        }
        Err(error) => return Err(error.into()),
    };

    Ok(CreatedEmployee {
        employee,
        account_id,
        link,
    })
}

pub async fn resolve_account_by_ref(
    conn: &mut PgConnection,
    employer: EmployerId,
    employer_ref: &str,
) -> Result<AccountId, DirectoryError> {
    repo::find_active_link_by_ref(conn, employer, employer_ref)
        .await?
        .map(|link| link.account_id)
        .ok_or(DirectoryError::UnknownEmployerRef)
}

pub async fn active_account(
    conn: &mut PgConnection,
    employee: EmployeeId,
) -> Result<AccountId, DirectoryError> {
    repo::find_active_link_by_employee(conn, employee)
        .await?
        .map(|link| link.account_id)
        .ok_or(DirectoryError::NoAccount)
}
