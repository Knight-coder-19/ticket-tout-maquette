mod data;
mod ids;
mod timeline;
mod world;

use std::env;
use std::fs;
use std::path::PathBuf;

use anyhow::{bail, Context, Result};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use chrono::Duration;
use ed25519_dalek::SigningKey;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

use cartepro_core::clock::FixedClock;
use cartepro_core::config::CoreConfig;
use cartepro_core::funding;
use cartepro_core::ids::AttemptId;
use cartepro_core::money::Money;
use cartepro_core::payments::{
    self, export, AttemptOutcome, NewAttempt, PaymentError, TokenRef,
};

use timeline::Event;

const ISSUER: &str = "cartepro";

fn config() -> CoreConfig
{
    CoreConfig {
        token_ttl: Duration::seconds(300),
        resync_max_age: Duration::hours(72),
        closure_grace: Duration::days(30),
        public_cache: Duration::seconds(300)
    }
}

fn signing_key() -> Result<SigningKey>
{
    let raw = env::var("TOKEN_SIGNING_KEY").context("TOKEN_SIGNING_KEY is not set")?;
    let bytes = STANDARD.decode(raw.trim()).context("TOKEN_SIGNING_KEY is not valid base64")?;
    let bytes: [u8; 32] = bytes
        .try_into()
        .map_err(|_| anyhow::anyhow!("TOKEN_SIGNING_KEY must decode to exactly 32 bytes"))?;

    Ok(SigningKey::from_bytes(&bytes))
}

async fn refuse_to_run_on_a_populated_database(pool: &PgPool) -> Result<()>
{
    let users = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM users")
        .fetch_one(pool)
        .await?;

    match users {
        0 => Ok(()),
        _ => bail!(
            "the database already holds {users} users; the seed only runs on an empty database, \
             see README section 3"
        )
    }
}

async fn print_zero_balance_case(pool: &PgPool) -> Result<()>
{
    let account = ids::indexed("account-employee", 0);
    let (first_name, last_name) = data::EMPLOYEES[0];

    let (credited, credits) = sqlx::query_as::<_, (i64, i64)>(
        "SELECT COALESCE(SUM(amount), 0)::BIGINT, COUNT(*)::BIGINT
           FROM ledger_entries WHERE account_id = $1 AND direction = 'credit'",
    )
    .bind(account)
    .fetch_one(pool)
    .await?;

    let (debited, debits) = sqlx::query_as::<_, (i64, i64)>(
        "SELECT COALESCE(SUM(amount), 0)::BIGINT, COUNT(*)::BIGINT
           FROM ledger_entries WHERE account_id = $1 AND direction = 'debit'",
    )
    .bind(account)
    .fetch_one(pool)
    .await?;

    let stored = sqlx::query_scalar::<_, i64>("SELECT balance_settled FROM accounts WHERE id = $1")
        .bind(account)
        .fetch_one(pool)
        .await?;

    println!();
    println!("Worked example — {first_name} {last_name} (AG-0001)");
    println!("  Top-ups : {credits} operations, {} EUR credited", Money::try_new(credited)?);
    println!("  Debits  : {debits} payments, {} EUR debited", Money::try_new(debited)?);
    println!(
        "  Balance : {} - {} = {} EUR recomputed, {} EUR stored on the account",
        Money::try_new(credited)?,
        Money::try_new(debited)?,
        Money::try_new(credited - debited)?,
        Money::try_new(stored)?
    );

    match credited - debited == stored {
        true => Ok(()),
        false => bail!("the stored balance and the ledger disagree, invariant I2 is broken")
    }
}

async fn run() -> Result<()>
{
    dotenvy::dotenv().ok();

    let url = env::var("DATABASE_URL").context("DATABASE_URL is not set")?;
    let admin_email = env::var("SEED_ADMIN_EMAIL").unwrap_or_else(|_| "admin@cartepro.test".into());
    let admin_password =
        env::var("SEED_ADMIN_PASSWORD").context("SEED_ADMIN_PASSWORD is not set")?;
    let target: PathBuf = env::args()
        .nth(1)
        .unwrap_or_else(|| "transactions.csv".into())
        .into();

    let pool = PgPoolOptions::new().max_connections(4).connect(&url).await?;

    refuse_to_run_on_a_populated_database(&pool).await?;

    let key = signing_key()?;
    let config = config();
    let world = world::build(&pool, &admin_email, &admin_password).await?;

    println!(
        "Seeded {} employees, {} partners, {} employers.",
        world.employees.len(),
        world.partners.len(),
        world.employers.len()
    );

    let events = timeline::build();
    let mut settled = 0_usize;
    let mut refused = 0_usize;
    let mut index = 0_usize;

    for event in events {
        match event {
            Event::Topup(topup) => {
                let employee = &world.employees[topup.employee];
                let clock = FixedClock::new(topup.at);
                let mut tx = pool.begin().await?;

                funding::topup::topup(
                    &mut tx,
                    &clock,
                    world.admin,
                    employee.employer,
                    employee.account,
                    Money::try_new(topup.amount)?,
                    Some(&topup.reference),
                )
                .await?;
                tx.commit().await?;
            }
            Event::Attempt(attempt) => {
                let employee = &world.employees[attempt.employee];
                let partner = &world.partners[attempt.partner];
                let clock = FixedClock::new(attempt.at);
                let amount = Money::try_new(attempt.amount)?;
                let mut tx = pool.begin().await?;
                let issued = payments::authorize(
                    &mut tx,
                    &clock,
                    &config,
                    &key,
                    ISSUER,
                    employee.account,
                    amount,
                )
                .await;

                let outcome = match issued {
                    Err(PaymentError::InsufficientFunds) => {
                        tx.rollback().await?;
                        refused += 1;
                        (AttemptOutcome::InsufficientFunds, None)
                    }
                    Err(error) => return Err(error.into()),
                    Ok(token) => {
                        tx.commit().await?;

                        let mut tx = pool.begin().await?;
                        let settlement = payments::settle(
                            &mut tx,
                            &clock,
                            &config,
                            partner.id,
                            &TokenRef::Jti(token.jti),
                            attempt.at,
                        )
                        .await?;

                        tx.commit().await?;
                        settled += 1;
                        (AttemptOutcome::Settled, Some(settlement.payment.operation_id))
                    }
                };

                if attempt.expect_refusal && outcome.0 != AttemptOutcome::InsufficientFunds {
                    bail!(
                        "attempt {index} was planned as a refusal but the funds were available; \
                         the timeline and the ledger disagree"
                    );
                }

                let mut conn = pool.acquire().await?;

                payments::repo::insert_attempt(
                    &mut conn,
                    &NewAttempt {
                        id: AttemptId::from(ids::indexed("attempt", index)),
                        employee_id: employee.id,
                        partner_id: partner.id,
                        amount,
                        outcome: outcome.0,
                        operation_id: outcome.1,
                        occurred_at: attempt.at,
                        recorded_at: Some(attempt.at)
                    },
                )
                .await?;
                index += 1;
            }
        }
    }

    println!("Recorded {index} transactions: {settled} settled, {refused} refused.");

    let rows = payments::repo::list_transactions(&pool).await?;

    fs::write(&target, export::to_csv(&rows))?;
    println!("Wrote {} rows to {}.", rows.len(), target.display());

    print_zero_balance_case(&pool).await?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()>
{
    run().await
}
