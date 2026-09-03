use super::{Employee, Employer, EmploymentLink};
use crate::identity::{UserRole, UserStatus};
use crate::ids::*;
use crate::PgTx;
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgConnection;

const EMPLOYEE_COLUMNS: &str = "id, user_id, last_name, first_name, phone, created_at";
const EMPLOYER_COLUMNS: &str =
    "id, legal_name, ifu, contact_email::text AS contact_email, contact_phone, status, created_at";
const LINK_COLUMNS: &str = "id, employee_id, employer_id, employer_ref, account_id, status,
     started_at, ended_at, created_at";

pub async fn insert_user(
    tx: &mut PgTx<'_>,
    email: &str,
    password_hash: &str,
    role: UserRole,
    now: DateTime<Utc>,
) -> Result<UserId, sqlx::Error> {
    sqlx::query_scalar::<_, UserId>(
        "INSERT INTO users (email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING id",
    )
    .bind(email)
    .bind(password_hash)
    .bind(role)
    .bind(now)
    .fetch_one(&mut **tx)
    .await
}

pub async fn insert_employee(
    tx: &mut PgTx<'_>,
    user_id: UserId,
    last_name: &str,
    first_name: &str,
    phone: Option<&str>,
    now: DateTime<Utc>,
) -> Result<Employee, sqlx::Error> {
    let statement = format!(
        "INSERT INTO employees (id, user_id, last_name, first_name, phone, created_at)
         VALUES ($1, $1, $2, $3, $4, $5)
         RETURNING {EMPLOYEE_COLUMNS}"
    );
    sqlx::query_as::<_, Employee>(&statement)
        .bind(user_id)
        .bind(last_name)
        .bind(first_name)
        .bind(phone)
        .bind(now)
        .fetch_one(&mut **tx)
        .await
}

pub async fn insert_account_for_employee(
    tx: &mut PgTx<'_>,
    employee_id: EmployeeId,
    now: DateTime<Utc>,
) -> Result<AccountId, sqlx::Error> {
    sqlx::query_scalar::<_, AccountId>(
        "INSERT INTO accounts (owner_type, owner_id, opened_at)
         VALUES ('employee'::account_owner, $1, $2)
         RETURNING id",
    )
    .bind(employee_id)
    .bind(now)
    .fetch_one(&mut **tx)
    .await
}

pub async fn insert_employment_link(
    tx: &mut PgTx<'_>,
    employee_id: EmployeeId,
    employer_id: EmployerId,
    employer_ref: &str,
    account_id: AccountId,
    started_at: NaiveDate,
    now: DateTime<Utc>,
) -> Result<EmploymentLink, sqlx::Error> {
    let statement = format!(
        "INSERT INTO employment_links
             (employee_id, employer_id, employer_ref, account_id, started_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING {LINK_COLUMNS}"
    );
    sqlx::query_as::<_, EmploymentLink>(&statement)
        .bind(employee_id)
        .bind(employer_id)
        .bind(employer_ref)
        .bind(account_id)
        .bind(started_at)
        .bind(now)
        .fetch_one(&mut **tx)
        .await
}

pub async fn insert_employer(
    tx: &mut PgTx<'_>,
    legal_name: &str,
    ifu: Option<&str>,
    contact_email: Option<&str>,
    contact_phone: Option<&str>,
    now: DateTime<Utc>,
) -> Result<Employer, sqlx::Error> {
    let statement = format!(
        "INSERT INTO employers (legal_name, ifu, contact_email, contact_phone, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING {EMPLOYER_COLUMNS}"
    );
    sqlx::query_as::<_, Employer>(&statement)
        .bind(legal_name)
        .bind(ifu)
        .bind(contact_email)
        .bind(contact_phone)
        .bind(now)
        .fetch_one(&mut **tx)
        .await
}

pub async fn update_employer(
    tx: &mut PgTx<'_>,
    id: EmployerId,
    legal_name: &str,
    ifu: Option<&str>,
    contact_email: Option<&str>,
    contact_phone: Option<&str>,
    status: UserStatus,
) -> Result<Employer, sqlx::Error> {
    let statement = format!(
        "UPDATE employers
         SET legal_name = $2, ifu = $3, contact_email = $4, contact_phone = $5, status = $6
         WHERE id = $1
         RETURNING {EMPLOYER_COLUMNS}"
    );
    sqlx::query_as::<_, Employer>(&statement)
        .bind(id)
        .bind(legal_name)
        .bind(ifu)
        .bind(contact_email)
        .bind(contact_phone)
        .bind(status)
        .fetch_one(&mut **tx)
        .await
}

pub async fn find_employer(
    conn: &mut PgConnection,
    id: EmployerId,
) -> Result<Option<Employer>, sqlx::Error> {
    let statement = format!("SELECT {EMPLOYER_COLUMNS} FROM employers WHERE id = $1");
    sqlx::query_as::<_, Employer>(&statement)
        .bind(id)
        .fetch_optional(conn)
        .await
}

pub async fn list_employers(conn: &mut PgConnection) -> Result<Vec<Employer>, sqlx::Error> {
    let statement = format!("SELECT {EMPLOYER_COLUMNS} FROM employers ORDER BY legal_name, id");
    sqlx::query_as::<_, Employer>(&statement).fetch_all(conn).await
}

pub async fn find_employee_by_user(
    conn: &mut PgConnection,
    user_id: UserId,
) -> Result<Option<Employee>, sqlx::Error> {
    let statement = format!("SELECT {EMPLOYEE_COLUMNS} FROM employees WHERE user_id = $1");
    sqlx::query_as::<_, Employee>(&statement)
        .bind(user_id)
        .fetch_optional(conn)
        .await
}

pub async fn find_active_link_by_ref(
    conn: &mut PgConnection,
    employer_id: EmployerId,
    employer_ref: &str,
) -> Result<Option<EmploymentLink>, sqlx::Error> {
    let statement = format!(
        "SELECT {LINK_COLUMNS} FROM employment_links
         WHERE employer_id = $1 AND employer_ref = $2 AND status = 'active'"
    );
    sqlx::query_as::<_, EmploymentLink>(&statement)
        .bind(employer_id)
        .bind(employer_ref)
        .fetch_optional(conn)
        .await
}

pub async fn find_active_link_by_employee(
    conn: &mut PgConnection,
    employee_id: EmployeeId,
) -> Result<Option<EmploymentLink>, sqlx::Error> {
    let statement = format!(
        "SELECT {LINK_COLUMNS} FROM employment_links
         WHERE employee_id = $1 AND status = 'active'"
    );
    sqlx::query_as::<_, EmploymentLink>(&statement)
        .bind(employee_id)
        .fetch_optional(conn)
        .await
}
