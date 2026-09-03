mod common;

use sqlx::PgPool;

use cartepro_core::clock::{Clock, FixedClock};
use cartepro_core::funding::{self, FundingError, Topup};
use cartepro_core::ids::{AccountId, EmployerId, UserId};
use cartepro_core::money::Money;
use common::{account, epoch, euros, make_employee, make_employer, system_account, ISSUANCE};

async fn make_admin(pool: &PgPool, email: &str) -> UserId
{
    sqlx::query_scalar::<_, UserId>(
        "INSERT INTO users (email, password_hash, role)
         VALUES ($1, 'not-a-real-hash', 'admin')
         RETURNING id",
    )
    .bind(email)
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn set_account_status(pool: &PgPool, account_id: AccountId, status: &str)
{
    sqlx::query("UPDATE accounts SET status = $2::account_status WHERE id = $1")
        .bind(account_id)
        .bind(status)
        .execute(pool)
        .await
        .unwrap();
}

async fn topup_count(pool: &PgPool) -> i64
{
    sqlx::query_scalar::<_, i64>("SELECT count(*) FROM topups")
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn topup_on(
    pool: &PgPool,
    clock: &dyn Clock,
    admin: UserId,
    employer: EmployerId,
    account_id: AccountId,
    amount: Money,
    reference: Option<&str>,
) -> Result<Topup, FundingError>
{
    let mut tx = pool.begin().await?;
    let topup = funding::topup::topup(
        &mut tx,
        clock,
        admin,
        employer,
        account_id,
        amount,
        reference,
    )
    .await?;

    tx.commit().await?;
    Ok(topup)
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_topup_credits_the_employee_and_debits_the_issuance_account(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let admin = make_admin(&pool, "admin@example.test").await;
    let employer = EmployerId::from(make_employer(&pool, "Ministere de la Sante").await);
    let employee = make_employee(&pool, "claire@example.test").await;
    let issuance = system_account(&pool, ISSUANCE).await;

    let topup = topup_on(
        &pool,
        &clock,
        admin,
        employer,
        employee.account,
        euros("120.00"),
        Some("PAY-2026-03"),
    )
    .await
    .unwrap();

    assert_eq!(topup.to_account, employee.account);
    assert_eq!(topup.employer_id, employer);
    assert_eq!(topup.amount, euros("120.00"));
    assert_eq!(topup.reference.as_deref(), Some("PAY-2026-03"));
    assert_eq!(
        account(&pool, employee.account).await,
        (12000, 0),
        "the employee is credited and nothing is reserved by a topup"
    );
    assert_eq!(
        account(&pool, issuance).await,
        (-12000, 0),
        "the issuance account carries the counterpart, negative by design"
    );
    assert_eq!(topup_count(&pool).await, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_same_reference_replayed_does_not_credit_twice(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let admin = make_admin(&pool, "admin@example.test").await;
    let employer = EmployerId::from(make_employer(&pool, "Ministere de la Sante").await);
    let employee = make_employee(&pool, "claire@example.test").await;

    let first = topup_on(
        &pool,
        &clock,
        admin,
        employer,
        employee.account,
        euros("120.00"),
        Some("PAY-2026-03"),
    )
    .await
    .unwrap();

    let second = topup_on(
        &pool,
        &clock,
        admin,
        employer,
        employee.account,
        euros("120.00"),
        Some("PAY-2026-03"),
    )
    .await
    .unwrap();

    assert_eq!(
        second.operation_id, first.operation_id,
        "the replay hands back the topup already recorded, it does not post a second one"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (12000, 0),
        "a reference replayed by a retrying payroll run credits the employee once"
    );
    assert_eq!(topup_count(&pool).await, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_suspended_account_cannot_be_topped_up(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let admin = make_admin(&pool, "admin@example.test").await;
    let employer = EmployerId::from(make_employer(&pool, "Ministere de la Sante").await);
    let employee = make_employee(&pool, "claire@example.test").await;

    set_account_status(&pool, employee.account, "suspended").await;

    let error = topup_on(
        &pool,
        &clock,
        admin,
        employer,
        employee.account,
        euros("120.00"),
        None,
    )
    .await
    .unwrap_err();

    assert!(
        matches!(error, FundingError::AccountInactive),
        "a suspended account is refused before any entry is written"
    );
    assert_eq!(account(&pool, employee.account).await, (0, 0));
    assert_eq!(topup_count(&pool).await, 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_system_account_cannot_be_credited_by_a_topup(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let admin = make_admin(&pool, "admin@example.test").await;
    let employer = EmployerId::from(make_employer(&pool, "Ministere de la Sante").await);
    let issuance = system_account(&pool, ISSUANCE).await;

    let error = topup_on(&pool, &clock, admin, employer, issuance, euros("120.00"), None)
        .await
        .unwrap_err();

    assert!(
        matches!(error, FundingError::SystemAccountCredited),
        "the issuance account is a source, crediting it would mint money out of nowhere"
    );
    assert_eq!(account(&pool, issuance).await, (0, 0));
    assert_eq!(topup_count(&pool).await, 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn two_topups_without_a_reference_both_apply(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let admin = make_admin(&pool, "admin@example.test").await;
    let employer = EmployerId::from(make_employer(&pool, "Ministere de la Sante").await);
    let employee = make_employee(&pool, "claire@example.test").await;

    topup_on(&pool, &clock, admin, employer, employee.account, euros("40.00"), None)
        .await
        .unwrap();

    topup_on(&pool, &clock, admin, employer, employee.account, euros("25.00"), None)
        .await
        .unwrap();

    assert_eq!(
        account(&pool, employee.account).await,
        (6500, 0),
        "without a reference there is nothing to deduplicate on, both credits apply"
    );
    assert_eq!(topup_count(&pool).await, 2);
}
