mod common;

use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::SigningKey;
use sqlx::PgPool;

use cartepro_core::clock::{Clock, FixedClock};
use cartepro_core::config::CoreConfig;
use cartepro_core::ids::{AccountId, Jti, PartnerId};
use cartepro_core::money::Money;
use cartepro_core::payments::{self, IssuedToken, PaymentError, Settlement, TokenRef};
use common::{account, credit, epoch, euros, make_employee, make_partner};

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

fn signing_key() -> SigningKey
{
    SigningKey::from_bytes(&[7u8; 32])
}

struct QueuedScan {
    reference: TokenRef,
    scanned_at: DateTime<Utc>
}

impl QueuedScan {
    fn new(jti: Jti, scanned_at: DateTime<Utc>) -> Self
    {
        QueuedScan { reference: TokenRef::Jti(jti), scanned_at }
    }
}

async fn authorize_on(
    pool: &PgPool,
    clock: &dyn Clock,
    account_id: AccountId,
    amount: Money,
) -> IssuedToken
{
    let mut tx = pool.begin().await.unwrap();
    let issued = payments::authorize(
        &mut tx,
        clock,
        &config(),
        &signing_key(),
        ISSUER,
        account_id,
        amount,
    )
    .await
    .unwrap();

    tx.commit().await.unwrap();
    issued
}

async fn replay_line(
    pool: &PgPool,
    clock: &dyn Clock,
    partner: PartnerId,
    line: &QueuedScan,
) -> Result<Settlement, PaymentError>
{
    let mut tx = pool.begin().await?;
    let settlement = payments::settle(
        &mut tx,
        clock,
        &config(),
        partner,
        &line.reference,
        line.scanned_at,
    )
    .await?;

    tx.commit().await?;
    Ok(settlement)
}

async fn replay_queue(
    pool: &PgPool,
    clock: &dyn Clock,
    partner: PartnerId,
    queue: &[QueuedScan],
) -> Vec<Result<Settlement, PaymentError>>
{
    let mut results = Vec::with_capacity(queue.len());

    for line in queue {
        results.push(replay_line(pool, clock, partner, line).await);
    }
    results
}

fn codes(results: &[Result<Settlement, PaymentError>]) -> Vec<&'static str>
{
    results
        .iter()
        .map(|result| match result {
            Ok(_) => "SETTLED",
            Err(error) => error.code()
        })
        .collect()
}

fn operations(results: &[Result<Settlement, PaymentError>]) -> Vec<String>
{
    results
        .iter()
        .map(|result| result.as_ref().unwrap().payment.operation_id.to_string())
        .collect()
}

async fn payment_count(pool: &PgPool) -> i64
{
    sqlx::query_scalar::<_, i64>("SELECT count(*) FROM payments")
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_queue_collected_offline_settles_line_by_line_when_the_till_reconnects(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let first = authorize_on(&pool, &clock, employee.account, euros("12.50")).await;
    let second = authorize_on(&pool, &clock, employee.account, euros("7.30")).await;
    let third = authorize_on(&pool, &clock, employee.account, euros("4.20")).await;

    let queue = vec![
        QueuedScan::new(first.jti, epoch() + Duration::seconds(30)),
        QueuedScan::new(second.jti, epoch() + Duration::seconds(90)),
        QueuedScan::new(third.jti, epoch() + Duration::seconds(150)),
    ];

    clock.advance(Duration::hours(6));

    let results = replay_queue(&pool, &clock, partner.partner, &queue).await;

    assert_eq!(
        codes(&results),
        vec!["SETTLED", "SETTLED", "SETTLED"],
        "a queue scanned while the till was offline settles in full once it reconnects"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (7600, 0),
        "the three amounts leave the employee and no reservation survives the replay"
    );
    assert_eq!(
        account(&pool, partner.account).await,
        (2400, 0),
        "the partner is credited with the sum of the queue"
    );
    assert_eq!(payment_count(&pool).await, 3);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_failing_line_does_not_bring_down_the_rest_of_the_queue(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let valid = authorize_on(&pool, &clock, employee.account, euros("10.00")).await;
    let late = authorize_on(&pool, &clock, employee.account, euros("5.00")).await;

    let queue = vec![
        QueuedScan::new(Jti::new(), epoch() + Duration::seconds(20)),
        QueuedScan::new(valid.jti, epoch() + Duration::seconds(40)),
        QueuedScan::new(late.jti, epoch() + Duration::seconds(600)),
    ];

    clock.advance(Duration::hours(2));

    let results = replay_queue(&pool, &clock, partner.partner, &queue).await;

    assert_eq!(
        codes(&results),
        vec!["TOKEN_NOT_FOUND", "SETTLED", "TOKEN_EXPIRED"],
        "each line carries its own outcome and a failure never aborts the batch"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (9000, 500),
        "only the accepted line moves money, the refused token keeps its reservation"
    );
    assert_eq!(account(&pool, partner.account).await, (1000, 0));
    assert_eq!(payment_count(&pool).await, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn replaying_the_same_queue_twice_does_not_debit_twice(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let first = authorize_on(&pool, &clock, employee.account, euros("12.50")).await;
    let second = authorize_on(&pool, &clock, employee.account, euros("7.30")).await;

    let queue = vec![
        QueuedScan::new(first.jti, epoch() + Duration::seconds(30)),
        QueuedScan::new(second.jti, epoch() + Duration::seconds(90)),
    ];

    clock.advance(Duration::hours(2));

    let first_pass = replay_queue(&pool, &clock, partner.partner, &queue).await;
    let second_pass = replay_queue(&pool, &clock, partner.partner, &queue).await;

    assert_eq!(codes(&first_pass), vec!["SETTLED", "SETTLED"]);
    assert_eq!(
        codes(&second_pass),
        vec!["SETTLED", "SETTLED"],
        "a till that never received the answer replays its queue and is told it succeeded"
    );
    assert_eq!(
        operations(&second_pass),
        operations(&first_pass),
        "the second pass hands back the payments already recorded, not new ones"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (8020, 0),
        "the employee is debited once for the whole queue, whatever the number of replays"
    );
    assert_eq!(account(&pool, partner.account).await, (1980, 0));
    assert_eq!(payment_count(&pool).await, 2);
}

#[sqlx::test(migrations = "../../migrations")]
async fn two_tills_replaying_the_same_scan_settle_it_only_once(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let first_till = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;
    let second_till = make_partner(&pool, "le-comptoir@example.test", "Le Comptoir").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("20.00")).await;
    let queue = vec![QueuedScan::new(issued.jti, epoch() + Duration::seconds(30))];

    clock.advance(Duration::hours(1));

    let first_results = replay_queue(&pool, &clock, first_till.partner, &queue).await;
    let second_results = replay_queue(&pool, &clock, second_till.partner, &queue).await;

    assert_eq!(codes(&first_results), vec!["SETTLED"]);
    assert_eq!(
        codes(&second_results),
        vec!["TOKEN_ALREADY_USED"],
        "a token replayed from another till is refused, the two queues cannot both win"
    );
    assert_eq!(account(&pool, first_till.account).await, (2000, 0));
    assert_eq!(
        account(&pool, second_till.account).await,
        (0, 0),
        "the losing till receives nothing"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (8000, 0),
        "the employee is debited once even though the scan was presented twice"
    );
    assert_eq!(payment_count(&pool).await, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_queue_older_than_the_resync_window_is_refused_and_the_funds_come_back(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("30.00")).await;
    let queue = vec![QueuedScan::new(issued.jti, epoch() + Duration::seconds(60))];

    clock.advance(Duration::hours(80));

    let results = replay_queue(&pool, &clock, partner.partner, &queue).await;

    assert_eq!(
        codes(&results),
        vec!["RESYNC_TOO_LATE"],
        "a queue that comes back past resync_max_age is refused whatever the scan time says"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (10000, 3000),
        "the refusal alone leaves the reservation in place"
    );

    let released = payments::expire_stale_tokens(&pool, &clock, payments::expire::DEFAULT_BATCH)
        .await
        .unwrap();

    assert_eq!(released, 1);
    assert_eq!(
        account(&pool, employee.account).await,
        (10000, 0),
        "the sweep gives the money back, a refused queue never strands the funds"
    );
    assert_eq!(account(&pool, partner.account).await, (0, 0));
    assert_eq!(payment_count(&pool).await, 0);
}
