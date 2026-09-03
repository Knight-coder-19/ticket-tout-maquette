#![allow(dead_code)]

use cartepro_core::ids::{AccountId, Jti, OperationId, PartnerId, UserId};
use cartepro_core::ledger::{self, OperationKind, Posting};
use cartepro_core::money::Money;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub const ISSUANCE: &str = "MINISTRY_ISSUANCE";

pub struct Employee {
    pub user: UserId,
    pub employee: Uuid,
    pub account: AccountId,
}

pub struct Partner {
    pub user: UserId,
    pub partner: PartnerId,
    pub account: AccountId,
}

pub fn euros(text: &str) -> Money
{
    Money::parse_euros(text).unwrap()
}

pub fn at(text: &str) -> DateTime<Utc>
{
    DateTime::parse_from_rfc3339(text).unwrap().with_timezone(&Utc)
}

pub fn epoch() -> DateTime<Utc>
{
    at("2026-03-01T09:00:00Z")
}

pub async fn system_account(pool: &PgPool, code: &str) -> AccountId
{
    sqlx::query_scalar::<_, AccountId>("SELECT id FROM accounts WHERE system_code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .unwrap()
}

pub async fn account(pool: &PgPool, id: AccountId) -> (i64, i64)
{
    sqlx::query_as::<_, (i64, i64)>(
        "SELECT balance_settled, balance_held FROM accounts WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .unwrap()
}

pub async fn make_employer(pool: &PgPool, legal_name: &str) -> Uuid
{
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO employers (legal_name) VALUES ($1) RETURNING id",
    )
    .bind(legal_name)
    .fetch_one(pool)
    .await
    .unwrap()
}

pub async fn make_employee(pool: &PgPool, email: &str) -> Employee
{
    let user = sqlx::query_scalar::<_, UserId>(
        "INSERT INTO users (email, password_hash, role)
         VALUES ($1, 'not-a-real-hash', 'employee')
         RETURNING id",
    )
    .bind(email)
    .fetch_one(pool)
    .await
    .unwrap();

    let employee = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO employees (user_id, last_name, first_name)
         VALUES ($1, 'Martin', 'Claire')
         RETURNING id",
    )
    .bind(user)
    .fetch_one(pool)
    .await
    .unwrap();

    let account = sqlx::query_scalar::<_, AccountId>(
        "INSERT INTO accounts (owner_type, owner_id) VALUES ('employee', $1) RETURNING id",
    )
    .bind(employee)
    .fetch_one(pool)
    .await
    .unwrap();

    Employee { user, employee, account }
}

pub async fn link_employment(
    pool: &PgPool,
    employee: &Employee,
    employer: Uuid,
    employer_ref: &str,
) -> Uuid
{
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO employment_links (employee_id, employer_id, employer_ref, account_id, started_at)
         VALUES ($1, $2, $3, $4, DATE '2026-01-05')
         RETURNING id",
    )
    .bind(employee.employee)
    .bind(employer)
    .bind(employer_ref)
    .bind(employee.account)
    .fetch_one(pool)
    .await
    .unwrap()
}

pub async fn end_employment(pool: &PgPool, link: Uuid)
{
    sqlx::query(
        "UPDATE employment_links
            SET status = 'ended', ended_at = DATE '2026-06-30'
          WHERE id = $1",
    )
    .bind(link)
    .execute(pool)
    .await
    .unwrap();
}

pub async fn make_partner(pool: &PgPool, email: &str, trade_name: &str) -> Partner
{
    let user = sqlx::query_scalar::<_, UserId>(
        "INSERT INTO users (email, password_hash, role)
         VALUES ($1, 'not-a-real-hash', 'partner')
         RETURNING id",
    )
    .bind(email)
    .fetch_one(pool)
    .await
    .unwrap();

    let account = sqlx::query_scalar::<_, AccountId>(
        "INSERT INTO accounts (owner_type, owner_id) VALUES ('partner', $1) RETURNING id",
    )
    .bind(user)
    .fetch_one(pool)
    .await
    .unwrap();

    let partner = sqlx::query_scalar::<_, PartnerId>(
        "INSERT INTO partners (user_id, account_id, legal_name, trade_name, category, city_id, status)
         VALUES ($1, $2, $3, $3, 'restaurant', (SELECT id FROM cities ORDER BY name LIMIT 1), 'approved')
         RETURNING id",
    )
    .bind(user)
    .bind(account)
    .bind(trade_name)
    .fetch_one(pool)
    .await
    .unwrap();

    sqlx::query("UPDATE accounts SET owner_id = $2 WHERE id = $1")
        .bind(account)
        .bind(partner)
        .execute(pool)
        .await
        .unwrap();

    Partner { user, partner, account }
}

pub async fn credit(pool: &PgPool, account: AccountId, amount: Money) -> OperationId
{
    let issuance = system_account(pool, ISSUANCE).await;
    let mut tx = pool.begin().await.unwrap();

    ledger::lock_chain(&mut tx).await.unwrap();
    ledger::lock_account(&mut tx, issuance).await.unwrap();
    ledger::lock_account(&mut tx, account).await.unwrap();

    let operation = ledger::post_operation(
        &mut tx,
        OperationKind::Topup,
        Posting {
            debit: issuance,
            credit: account,
            amount,
            occurred_at: epoch(),
            memo: None,
            created_by: None,
            operation_id: None,
            recorded_at: None,
        },
    )
    .await
    .unwrap();

    tx.commit().await.unwrap();
    operation.id
}

pub async fn issue_token(
    pool: &PgPool,
    account: AccountId,
    amount: Money,
    issued_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
) -> Jti
{
    let jti = Jti::new();
    let short_code = jti.to_string()[..8].to_uppercase();
    let mut tx = pool.begin().await.unwrap();

    ledger::place_hold(&mut tx, account, amount).await.unwrap();
    sqlx::query(
        "INSERT INTO payment_tokens (jti, account_id, amount, short_code, issued_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(jti)
    .bind(account)
    .bind(amount)
    .bind(&short_code)
    .bind(issued_at)
    .bind(expires_at)
    .execute(&mut *tx)
    .await
    .unwrap();

    tx.commit().await.unwrap();
    jti
}

pub async fn token_amount(pool: &PgPool, jti: Jti) -> (AccountId, Money)
{
    sqlx::query_as::<_, (AccountId, Money)>(
        "SELECT account_id, amount FROM payment_tokens WHERE jti = $1",
    )
    .bind(jti)
    .fetch_one(pool)
    .await
    .unwrap()
}

pub async fn settle_token(
    pool: &PgPool,
    jti: Jti,
    partner: &Partner,
    scanned_at: DateTime<Utc>,
) -> OperationId
{
    let (account, amount) = token_amount(pool, jti).await;
    let mut tx = pool.begin().await.unwrap();

    ledger::lock_chain(&mut tx).await.unwrap();
    ledger::lock_account(&mut tx, account).await.unwrap();
    ledger::lock_account(&mut tx, partner.account).await.unwrap();
    ledger::release_hold(&mut tx, account, amount).await.unwrap();

    let operation = ledger::post_operation(
        &mut tx,
        OperationKind::Payment,
        Posting {
            debit: account,
            credit: partner.account,
            amount,
            occurred_at: scanned_at,
            memo: None,
            created_by: None,
            operation_id: None,
            recorded_at: None,
        },
    )
    .await
    .unwrap();

    sqlx::query(
        "UPDATE payment_tokens SET status = 'consumed', resolved_at = $2 WHERE jti = $1",
    )
    .bind(jti)
    .bind(scanned_at)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO payments (operation_id, token_jti, partner_id, from_account, entry_mode, scanned_at)
         VALUES ($1, $2, $3, $4, 'qr_scan', $5)",
    )
    .bind(operation.id)
    .bind(jti)
    .bind(partner.partner)
    .bind(account)
    .bind(scanned_at)
    .execute(&mut *tx)
    .await
    .unwrap();

    tx.commit().await.unwrap();
    operation.id
}
