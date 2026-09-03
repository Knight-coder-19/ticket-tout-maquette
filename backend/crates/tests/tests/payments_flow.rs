mod common;

use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::SigningKey;
use sqlx::PgPool;

use cartepro_core::clock::{Clock, FixedClock};
use cartepro_core::config::CoreConfig;
use cartepro_core::crypto::{short_code, token_sig};
use cartepro_core::ids::{AccountId, Jti, PartnerId};
use cartepro_core::money::Money;
use cartepro_core::payments::{
    self, EntryMode, IssuedToken, PaymentError, Settlement, TokenRef, TokenStatus,
};
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

async fn authorize_on(
    pool: &PgPool,
    clock: &dyn Clock,
    account_id: AccountId,
    amount: Money,
) -> Result<IssuedToken, PaymentError>
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
    .await?;

    tx.commit().await.unwrap();
    Ok(issued)
}

async fn settle_on(
    pool: &PgPool,
    clock: &dyn Clock,
    partner: PartnerId,
    reference: &TokenRef,
    scanned_at: DateTime<Utc>,
) -> Result<Settlement, PaymentError>
{
    let mut tx = pool.begin().await.unwrap();
    let settlement =
        payments::settle(&mut tx, clock, &config(), partner, reference, scanned_at).await?;

    tx.commit().await.unwrap();
    Ok(settlement)
}

async fn cancel_on(
    pool: &PgPool,
    clock: &dyn Clock,
    account_id: AccountId,
    jti: Jti,
) -> Result<(), PaymentError>
{
    let mut tx = pool.begin().await.unwrap();

    payments::settle::cancel(&mut tx, clock, account_id, jti).await?;
    tx.commit().await.unwrap();
    Ok(())
}

async fn token_status(pool: &PgPool, jti: Jti) -> TokenStatus
{
    sqlx::query_scalar::<_, TokenStatus>("SELECT status FROM payment_tokens WHERE jti = $1")
        .bind(jti)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn payment_count(pool: &PgPool) -> i64
{
    sqlx::query_scalar::<_, i64>("SELECT count(*) FROM payments")
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

async fn set_partner_status(pool: &PgPool, partner: PartnerId, status: &str)
{
    sqlx::query("UPDATE partners SET status = $2::partner_status WHERE id = $1")
        .bind(partner)
        .bind(status)
        .execute(pool)
        .await
        .unwrap();
}

fn typed_by_hand(stored: &str) -> String
{
    format!("{} ", short_code::format_for_display(stored).to_lowercase().replace('-', " "))
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_scanned_token_moves_the_money_to_the_partner(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("12.50"))
        .await
        .unwrap();

    assert_eq!(
        account(&pool, employee.account).await,
        (10000, 1250),
        "issuing a token reserves the funds without moving them"
    );

    let settled = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(issued.jti),
        clock.now(),
    )
    .await
    .unwrap();

    assert_eq!(settled.payment.token_jti, issued.jti);
    assert_eq!(settled.payment.partner_id, partner.partner);
    assert_eq!(settled.payment.from_account, employee.account);
    assert_eq!(settled.payment.entry_mode, EntryMode::QrScan);
    assert_eq!(
        settled.amount,
        euros("12.50"),
        "the settlement carries the amount, which the payment row does not hold"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (8750, 0),
        "settling debits the employee and clears the hold"
    );
    assert_eq!(
        account(&pool, partner.account).await,
        (1250, 0),
        "the partner is credited with the exact token amount"
    );
    assert_eq!(token_status(&pool, issued.jti).await, TokenStatus::Consumed);
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_issued_qr_carries_a_signature_we_can_verify(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;

    credit(&pool, employee.account, euros("50.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("3.99"))
        .await
        .unwrap();

    let payload = token_sig::verify(&issued.qr, &signing_key().verifying_key()).unwrap();

    assert_eq!(payload.jti, issued.jti);
    assert_eq!(payload.amount().unwrap(), euros("3.99"));
    assert_eq!(payload.iss, ISSUER);
    assert_eq!(payload.expires_at().unwrap(), issued.expires_at);
    assert!(short_code::is_valid(&issued.short_code), "the stored code is canonical");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_token_cannot_be_issued_above_the_available_balance(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;

    credit(&pool, employee.account, euros("20.00")).await;

    let refused = authorize_on(&pool, &clock, employee.account, euros("25.00")).await;

    assert!(
        matches!(refused, Err(PaymentError::InsufficientFunds)),
        "expected InsufficientFunds, got {refused:?}"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (2000, 0),
        "a refused authorisation reserves nothing"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_reserved_amount_is_not_available_for_a_second_token(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;

    credit(&pool, employee.account, euros("20.00")).await;
    authorize_on(&pool, &clock, employee.account, euros("15.00"))
        .await
        .unwrap();

    let refused = authorize_on(&pool, &clock, employee.account, euros("10.00")).await;

    assert!(
        matches!(refused, Err(PaymentError::InsufficientFunds)),
        "expected InsufficientFunds, got {refused:?}"
    );
    assert_eq!(account(&pool, employee.account).await, (2000, 1500));
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_token_covering_the_whole_balance_can_be_settled(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("100.00"))
        .await
        .unwrap();

    assert_eq!(account(&pool, employee.account).await, (10000, 10000));

    settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(issued.jti),
        clock.now(),
    )
    .await
    .unwrap();

    assert_eq!(
        account(&pool, employee.account).await,
        (0, 0),
        "releasing the hold must precede the debit, or held_within_settled rejects it"
    );
    assert_eq!(account(&pool, partner.account).await, (10000, 0));
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_same_partner_settling_twice_gets_the_same_payment(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("24.90"))
        .await
        .unwrap();
    let reference = TokenRef::Jti(issued.jti);

    let first = settle_on(&pool, &clock, partner.partner, &reference, clock.now())
        .await
        .unwrap();
    let balances = account(&pool, employee.account).await;

    let second = settle_on(&pool, &clock, partner.partner, &reference, clock.now())
        .await
        .unwrap();

    assert_eq!(first.payment.operation_id, second.payment.operation_id);
    assert_eq!(
        second.amount,
        euros("24.90"),
        "the replayed settlement reads the amount back from the ledger operation"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        balances,
        "replaying a settlement must not move money a second time"
    );
    assert_eq!(payment_count(&pool).await, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn another_partner_cannot_settle_a_consumed_token(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let paul = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;
    let ada = make_partner(&pool, "chez-ada@example.test", "Chez Ada").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("24.90"))
        .await
        .unwrap();
    let reference = TokenRef::Jti(issued.jti);

    settle_on(&pool, &clock, paul.partner, &reference, clock.now())
        .await
        .unwrap();

    let refused = settle_on(&pool, &clock, ada.partner, &reference, clock.now()).await;

    assert!(
        matches!(refused, Err(PaymentError::TokenAlreadyUsed)),
        "expected TokenAlreadyUsed, got {refused:?}"
    );
    assert_eq!(account(&pool, ada.account).await, (0, 0));
    assert_eq!(payment_count(&pool).await, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_short_code_typed_by_hand_settles_the_payment(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("7.30"))
        .await
        .unwrap();

    let settled = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::ShortCode(typed_by_hand(&issued.short_code)),
        clock.now(),
    )
    .await
    .unwrap();

    assert_eq!(settled.payment.token_jti, issued.jti);
    assert_eq!(settled.amount, euros("7.30"));
    assert_eq!(
        settled.payment.entry_mode,
        EntryMode::ShortCode,
        "the entry mode records how the token was presented"
    );
    assert_eq!(account(&pool, partner.account).await, (730, 0));
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_unknown_short_code_is_refused(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    let unknown = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::ShortCode("ZZZZ-ZZZZ".to_string()),
        clock.now(),
    )
    .await;

    assert!(
        matches!(unknown, Err(PaymentError::UnknownToken)),
        "expected UnknownToken, got {unknown:?}"
    );

    let nonsense = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::ShortCode("hello".to_string()),
        clock.now(),
    )
    .await;

    assert!(
        matches!(nonsense, Err(PaymentError::UnknownToken)),
        "a malformed code is rejected before touching the database, got {nonsense:?}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_expired_token_is_refused(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("12.50"))
        .await
        .unwrap();

    clock.advance(Duration::seconds(301));

    let refused = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(issued.jti),
        clock.now(),
    )
    .await;

    assert!(
        matches!(refused, Err(PaymentError::TokenExpired)),
        "expected TokenExpired, got {refused:?}"
    );
    assert_eq!(
        account(&pool, employee.account).await,
        (10000, 1250),
        "refusing an expired token does not release the hold, the sweep does"
    );
    assert_eq!(payment_count(&pool).await, 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_resync_window_does_not_extend_the_token_lifetime(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("12.50"))
        .await
        .unwrap();
    let scanned_at = clock.now() + Duration::seconds(60);

    clock.advance(Duration::hours(2));

    let refused = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(issued.jti),
        scanned_at,
    )
    .await;

    assert!(
        matches!(refused, Err(PaymentError::TokenExpired)),
        "expected TokenExpired, got {refused:?}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_resync_past_the_allowed_delay_is_refused(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("12.50"))
        .await
        .unwrap();
    let scanned_at = clock.now();

    clock.advance(Duration::hours(73));

    let refused = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(issued.jti),
        scanned_at,
    )
    .await;

    assert!(
        matches!(refused, Err(PaymentError::ResyncTooLate)),
        "expected ResyncTooLate, got {refused:?}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn cancelling_a_token_gives_the_money_back(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("30.00"))
        .await
        .unwrap();

    assert_eq!(account(&pool, employee.account).await, (10000, 3000));

    cancel_on(&pool, &clock, employee.account, issued.jti)
        .await
        .unwrap();

    assert_eq!(
        account(&pool, employee.account).await,
        (10000, 0),
        "cancelling releases the whole reservation"
    );
    assert_eq!(token_status(&pool, issued.jti).await, TokenStatus::Cancelled);

    authorize_on(&pool, &clock, employee.account, euros("100.00"))
        .await
        .unwrap();
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_cancelled_token_cannot_be_settled(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("12.50"))
        .await
        .unwrap();

    cancel_on(&pool, &clock, employee.account, issued.jti)
        .await
        .unwrap();

    let refused = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(issued.jti),
        clock.now(),
    )
    .await;

    assert!(
        matches!(refused, Err(PaymentError::TokenCancelled)),
        "expected TokenCancelled, got {refused:?}"
    );
    assert_eq!(payment_count(&pool).await, 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn only_the_owner_can_cancel_a_token(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let claire = make_employee(&pool, "claire@example.test").await;
    let ines = make_employee(&pool, "ines@example.test").await;

    credit(&pool, claire.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, claire.account, euros("12.50"))
        .await
        .unwrap();

    let refused = cancel_on(&pool, &clock, ines.account, issued.jti).await;

    assert!(
        matches!(refused, Err(PaymentError::UnknownToken)),
        "a token belonging to someone else is simply unknown, got {refused:?}"
    );
    assert_eq!(token_status(&pool, issued.jti).await, TokenStatus::Active);
    assert_eq!(account(&pool, claire.account).await, (10000, 1250));
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_partner_that_is_not_approved_receives_nothing(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;
    set_partner_status(&pool, partner.partner, "suspended").await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("12.50"))
        .await
        .unwrap();

    let refused = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(issued.jti),
        clock.now(),
    )
    .await;

    assert!(
        matches!(refused, Err(PaymentError::PartnerNotApproved)),
        "expected PartnerNotApproved, got {refused:?}"
    );
    assert_eq!(account(&pool, partner.account).await, (0, 0));
    assert_eq!(
        account(&pool, employee.account).await,
        (10000, 1250),
        "a refused settlement leaves the reservation in place"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_closed_account_cannot_settle_its_pending_token(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let issued = authorize_on(&pool, &clock, employee.account, euros("12.50"))
        .await
        .unwrap();

    set_account_status(&pool, employee.account, "closed").await;

    let refused = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(issued.jti),
        clock.now(),
    )
    .await;

    assert!(
        matches!(refused, Err(PaymentError::AccountInactive)),
        "expected AccountInactive, got {refused:?}"
    );
    assert_eq!(payment_count(&pool).await, 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_suspended_account_cannot_issue_a_token(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;

    credit(&pool, employee.account, euros("100.00")).await;
    set_account_status(&pool, employee.account, "suspended").await;

    let refused = authorize_on(&pool, &clock, employee.account, euros("12.50")).await;

    assert!(
        matches!(refused, Err(PaymentError::AccountInactive)),
        "expected AccountInactive, got {refused:?}"
    );
    assert_eq!(account(&pool, employee.account).await, (10000, 0));
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_sweep_expires_stale_tokens_and_frees_the_funds(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let stale = authorize_on(&pool, &clock, employee.account, euros("30.00"))
        .await
        .unwrap();

    clock.advance(Duration::seconds(301));

    let fresh = authorize_on(&pool, &clock, employee.account, euros("10.00"))
        .await
        .unwrap();
    let swept = payments::expire_stale_tokens(&pool, &clock, payments::expire::DEFAULT_BATCH)
        .await
        .unwrap();

    assert_eq!(swept, 1, "only the stale token is swept");
    assert_eq!(token_status(&pool, stale.jti).await, TokenStatus::Expired);
    assert_eq!(token_status(&pool, fresh.jti).await, TokenStatus::Active);
    assert_eq!(
        account(&pool, employee.account).await,
        (10000, 1000),
        "the expired reservation is released, the fresh one is kept"
    );

    let refused = settle_on(
        &pool,
        &clock,
        partner.partner,
        &TokenRef::Jti(stale.jti),
        clock.now(),
    )
    .await;

    assert!(
        matches!(refused, Err(PaymentError::TokenExpired)),
        "expected TokenExpired, got {refused:?}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_partner_reads_back_its_settlements_with_their_amounts(pool: PgPool)
{
    let clock = FixedClock::new(epoch());
    let employee = make_employee(&pool, "claire@example.test").await;
    let paul = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;
    let ada = make_partner(&pool, "chez-ada@example.test", "Chez Ada").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let first = authorize_on(&pool, &clock, employee.account, euros("4.20"))
        .await
        .unwrap();

    settle_on(&pool, &clock, paul.partner, &TokenRef::Jti(first.jti), clock.now())
        .await
        .unwrap();
    clock.advance(Duration::seconds(60));

    let second = authorize_on(&pool, &clock, employee.account, euros("18.00"))
        .await
        .unwrap();

    settle_on(&pool, &clock, paul.partner, &TokenRef::Jti(second.jti), clock.now())
        .await
        .unwrap();

    let third = authorize_on(&pool, &clock, employee.account, euros("9.99"))
        .await
        .unwrap();

    settle_on(&pool, &clock, ada.partner, &TokenRef::Jti(third.jti), clock.now())
        .await
        .unwrap();

    let listed = payments::repo::list_partner_settlements(&pool, paul.partner, 10)
        .await
        .unwrap();

    assert_eq!(listed.len(), 2, "the settlements of another partner are not listed");
    assert_eq!(listed[0].payment.token_jti, second.jti, "most recent first");
    assert_eq!(listed[0].amount, euros("18.00"));
    assert_eq!(listed[1].amount, euros("4.20"));
}
