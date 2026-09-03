use anyhow::{Context, Result};
use sqlx::PgPool;
use uuid::Uuid;

use cartepro_core::crypto::password;
use cartepro_core::ids::{AccountId, EmployeeId, EmployerId, PartnerId, UserId};

use crate::data::{EMPLOYEES, EMPLOYERS, PARTNERS};
use crate::ids;

pub struct Employee {
    pub id: EmployeeId,
    pub account: AccountId,
    pub employer: EmployerId,
}

pub struct Partner {
    pub id: PartnerId,
}

pub struct World {
    pub admin: UserId,
    pub employers: Vec<EmployerId>,
    pub employees: Vec<Employee>,
    pub partners: Vec<Partner>,
}

async fn city_id(pool: &PgPool, name: &str, department: &str) -> Result<Uuid>
{
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM cities WHERE name = $1 AND department = $2")
        .bind(name)
        .bind(department)
        .fetch_one(pool)
        .await
        .with_context(|| format!("city {name} ({department}) is missing from the reference data"))
}

async fn insert_user(
    pool: &PgPool,
    id: Uuid,
    email: &str,
    hash: &str,
    role: &str,
) -> Result<UserId>
{
    sqlx::query("INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4::user_role)")
        .bind(id)
        .bind(email)
        .bind(hash)
        .bind(role)
        .execute(pool)
        .await?;
    Ok(UserId::from(id))
}

async fn create_admin(pool: &PgPool, email: &str, plain: &str) -> Result<UserId>
{
    let hash = password::hash_password(plain).map_err(|_| anyhow::anyhow!("hashing failed"))?;

    insert_user(pool, ids::stable("admin", email), email, &hash, "admin").await
}

async fn create_employers(pool: &PgPool) -> Result<Vec<EmployerId>>
{
    let mut created = Vec::with_capacity(EMPLOYERS.len());

    for (index, (legal_name, ifu)) in EMPLOYERS.iter().enumerate() {
        let id = ids::indexed("employer", index);

        sqlx::query("INSERT INTO employers (id, legal_name, ifu) VALUES ($1, $2, $3)")
            .bind(id)
            .bind(legal_name)
            .bind(ifu)
            .execute(pool)
            .await?;
        created.push(EmployerId::from(id));
    }
    Ok(created)
}

async fn create_employees(pool: &PgPool, employers: &[EmployerId]) -> Result<Vec<Employee>>
{
    let hash = password::hash_password("cartepro-demo").map_err(|_| anyhow::anyhow!("hashing failed"))?;
    let mut created = Vec::with_capacity(EMPLOYEES.len());

    for (index, (first_name, last_name)) in EMPLOYEES.iter().enumerate() {
        let employer = employers[index % employers.len()];
        let email = format!("{}.{}@agent.gouv.test", first_name, last_name)
            .to_lowercase()
            .replace(['é', 'è', 'ê'], "e")
            .replace('î', "i")
            .replace('ï', "i")
            .replace('ô', "o")
            .replace('ç', "c")
            .replace(' ', "-");

        let user = insert_user(pool, ids::indexed("user-employee", index), &email, &hash, "employee").await?;
        let employee = ids::indexed("employee", index);
        let account = ids::indexed("account-employee", index);

        sqlx::query(
            "INSERT INTO employees (id, user_id, last_name, first_name) VALUES ($1, $2, $3, $4)",
        )
        .bind(employee)
        .bind(user)
        .bind(last_name)
        .bind(first_name)
        .execute(pool)
        .await?;

        sqlx::query(
            "INSERT INTO accounts (id, owner_type, owner_id) VALUES ($1, 'employee', $2)",
        )
        .bind(account)
        .bind(employee)
        .execute(pool)
        .await?;

        sqlx::query(
            "INSERT INTO employment_links (id, employee_id, employer_id, employer_ref, account_id, started_at)
             VALUES ($1, $2, $3, $4, $5, DATE '2026-01-05')",
        )
        .bind(ids::indexed("employment", index))
        .bind(employee)
        .bind(employer)
        .bind(format!("AG-{:04}", index + 1))
        .bind(account)
        .execute(pool)
        .await?;

        created.push(Employee {
            id: EmployeeId::from(employee),
            account: AccountId::from(account),
            employer
        });
    }
    Ok(created)
}

async fn create_partners(pool: &PgPool, reviewer: UserId) -> Result<Vec<Partner>>
{
    let hash = password::hash_password("cartepro-demo").map_err(|_| anyhow::anyhow!("hashing failed"))?;
    let mut created = Vec::with_capacity(PARTNERS.len());

    for (index, spec) in PARTNERS.iter().enumerate() {
        let email = format!("contact{}@{}.test", index + 1, spec.category);
        let user = insert_user(pool, ids::indexed("user-partner", index), &email, &hash, "partner").await?;
        let account = ids::indexed("account-partner", index);
        let partner = ids::indexed("partner", index);
        let city = city_id(pool, spec.city, spec.department).await?;

        sqlx::query("INSERT INTO accounts (id, owner_type, owner_id) VALUES ($1, 'partner', $2)")
            .bind(account)
            .bind(partner)
            .execute(pool)
            .await?;

        sqlx::query(
            "INSERT INTO partners
                 (id, user_id, account_id, legal_name, trade_name, category, city_id,
                  status, submitted_at, reviewed_by, reviewed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved',
                     TIMESTAMPTZ '2026-02-10T10:00:00Z', $8, TIMESTAMPTZ '2026-02-14T14:00:00Z')",
        )
        .bind(partner)
        .bind(user)
        .bind(account)
        .bind(spec.legal_name)
        .bind(spec.trade_name)
        .bind(spec.category)
        .bind(city)
        .bind(reviewer)
        .execute(pool)
        .await?;

        created.push(Partner { id: PartnerId::from(partner) });
    }
    Ok(created)
}

pub async fn build(pool: &PgPool, admin_email: &str, admin_password: &str) -> Result<World>
{
    let admin = create_admin(pool, admin_email, admin_password).await?;
    let employers = create_employers(pool).await?;
    let employees = create_employees(pool, &employers).await?;
    let partners = create_partners(pool, admin).await?;

    Ok(World { admin, employers, employees, partners })
}
