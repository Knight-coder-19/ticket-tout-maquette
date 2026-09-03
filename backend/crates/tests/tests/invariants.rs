mod common;

use cartepro_core::ids::AccountId;
use cartepro_core::ledger::balance::{recompute_balance, recompute_held, verify_chain, ChainStatus};
use cartepro_core::ledger::{self, LedgerError, OperationKind, Posting};
use common::{at, credit, euros, issue_token, make_employee, make_employer, make_partner};
use common::{account, end_employment, link_employment, settle_token, system_account, ISSUANCE};
use sqlx::PgPool;
use uuid::Uuid;

async fn a_settled_payment(pool: &PgPool)
{
    let employee = make_employee(pool, "claire@example.test").await;
    let partner = make_partner(pool, "chez-paul@example.test", "Chez Paul").await;

    credit(pool, employee.account, euros("100.00")).await;

    let jti = issue_token(
        pool,
        employee.account,
        euros("24.90"),
        at("2026-03-01T12:00:00Z"),
        at("2026-03-01T12:05:00Z"),
    )
    .await;

    settle_token(pool, jti, &partner, at("2026-03-01T12:01:00Z")).await;
}

#[sqlx::test(migrations = "../../migrations")]
async fn i1_every_operation_is_balanced(pool: PgPool)
{
    a_settled_payment(&pool).await;

    let unbalanced = sqlx::query_scalar::<_, Uuid>(
        "SELECT o.id
           FROM ledger_operations o
           JOIN ledger_entries e ON e.operation_id = o.id
          GROUP BY o.id, o.amount
         HAVING sum(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END) <> o.amount
             OR sum(CASE WHEN e.direction = 'debit'  THEN e.amount ELSE 0 END) <> o.amount
             OR count(*) < 2",
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert!(unbalanced.is_empty(), "unbalanced operations: {unbalanced:?}");

    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(SUM(balance_settled), 0)::BIGINT FROM accounts",
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(total, 0, "the sum of every balance must be exactly zero");
}

#[sqlx::test(migrations = "../../migrations")]
async fn i2_cached_balances_mirror_the_ledger(pool: PgPool)
{
    a_settled_payment(&pool).await;

    let accounts = sqlx::query_scalar::<_, AccountId>("SELECT id FROM accounts")
        .fetch_all(&pool)
        .await
        .unwrap();

    for id in accounts {
        let (settled, _) = account(&pool, id).await;
        let replayed = recompute_balance(&pool, id).await.unwrap();

        assert_eq!(settled, replayed, "cached balance of {id} drifted from the ledger");
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn i3_user_accounts_never_go_negative(pool: PgPool)
{
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("50.00")).await;

    let mut tx = pool.begin().await.unwrap();
    ledger::lock_chain(&mut tx).await.unwrap();

    let overdraft = ledger::post_operation(
        &mut tx,
        OperationKind::Payment,
        Posting {
            debit: employee.account,
            credit: partner.account,
            amount: euros("80.00"),
            occurred_at: at("2026-03-01T12:00:00Z"),
            memo: None,
            created_by: None,
            operation_id: None,
            recorded_at: None,
        },
    )
    .await;

    assert!(
        matches!(overdraft, Err(LedgerError::InsufficientFunds(id)) if id == employee.account),
        "spending more than the balance must be refused, got {overdraft:?}"
    );
    tx.rollback().await.unwrap();

    let (settled, held) = account(&pool, employee.account).await;
    assert_eq!(settled, euros("50.00").cents());
    assert_eq!(held, 0);

    let issuance = system_account(&pool, ISSUANCE).await;
    let (issued, _) = account(&pool, issuance).await;

    assert_eq!(issued, -euros("50.00").cents(), "the issuance account carries the total issued");
}

#[sqlx::test(migrations = "../../migrations")]
async fn i4_held_matches_the_active_tokens(pool: PgPool)
{
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let first = issue_token(
        &pool,
        employee.account,
        euros("30.00"),
        at("2026-03-01T12:00:00Z"),
        at("2026-03-01T12:05:00Z"),
    )
    .await;
    issue_token(
        &pool,
        employee.account,
        euros("20.00"),
        at("2026-03-01T12:00:00Z"),
        at("2026-03-01T12:05:00Z"),
    )
    .await;

    let (_, held) = account(&pool, employee.account).await;
    assert_eq!(held, euros("50.00").cents());
    assert_eq!(recompute_held(&pool, employee.account).await.unwrap(), euros("50.00"));

    settle_token(&pool, first, &partner, at("2026-03-01T12:01:00Z")).await;

    let (settled, held) = account(&pool, employee.account).await;
    assert_eq!(settled, euros("70.00").cents());
    assert_eq!(held, euros("20.00").cents());
    assert_eq!(recompute_held(&pool, employee.account).await.unwrap(), euros("20.00"));
}

#[sqlx::test(migrations = "../../migrations")]
async fn i5_the_hash_chain_is_continuous_and_verifiable(pool: PgPool)
{
    a_settled_payment(&pool).await;

    let mut conn = pool.acquire().await.unwrap();
    assert_eq!(verify_chain(&mut conn, 1).await.unwrap(), ChainStatus::Intact);

    let genesis = sqlx::query_scalar::<_, Vec<u8>>(
        "SELECT prev_hash FROM ledger_entries ORDER BY seq LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(genesis, vec![0u8; 32], "the first entry must chain onto GENESIS_HASH");

    let tampered = sqlx::query_scalar::<_, i64>("SELECT MIN(seq) FROM ledger_entries")
        .fetch_one(&pool)
        .await
        .unwrap();

    sqlx::query("ALTER TABLE ledger_entries DISABLE TRIGGER USER")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE ledger_entries SET amount = amount + 1 WHERE seq = $1")
        .bind(tampered)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("ALTER TABLE ledger_entries ENABLE TRIGGER USER")
        .execute(&pool)
        .await
        .unwrap();

    let mut conn = pool.acquire().await.unwrap();
    assert_eq!(
        verify_chain(&mut conn, 1).await.unwrap(),
        ChainStatus::BrokenAt(tampered),
        "a rewritten entry must be reported at its own seq"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn i6_a_token_is_settled_only_once(pool: PgPool)
{
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;
    let other = make_partner(&pool, "le-bistrot@example.test", "Le Bistrot").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let jti = issue_token(
        &pool,
        employee.account,
        euros("24.90"),
        at("2026-03-01T12:00:00Z"),
        at("2026-03-01T12:05:00Z"),
    )
    .await;
    settle_token(&pool, jti, &partner, at("2026-03-01T12:01:00Z")).await;

    let mut tx = pool.begin().await.unwrap();
    ledger::lock_chain(&mut tx).await.unwrap();

    let second = ledger::post_operation(
        &mut tx,
        OperationKind::Payment,
        Posting {
            debit: employee.account,
            credit: other.account,
            amount: euros("24.90"),
            occurred_at: at("2026-03-01T12:02:00Z"),
            memo: None,
            created_by: None,
            operation_id: None,
            recorded_at: None,
        },
    )
    .await
    .unwrap();

    let replay = sqlx::query(
        "INSERT INTO payments (operation_id, token_jti, partner_id, from_account, entry_mode, scanned_at)
         VALUES ($1, $2, $3, $4, 'qr_scan', $5)",
    )
    .bind(second.id)
    .bind(jti)
    .bind(other.partner)
    .bind(employee.account)
    .bind(at("2026-03-01T12:02:00Z"))
    .execute(&mut *tx)
    .await;

    assert!(replay.is_err(), "a second payment on the same token must be refused");
    tx.rollback().await.unwrap();

    let settled = sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM payments WHERE token_jti = $1",
    )
    .bind(jti)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(settled, 1);

    let orphans = sqlx::query_scalar::<_, Uuid>(
        "SELECT t.jti
           FROM payment_tokens t
           LEFT JOIN payments p ON p.token_jti = t.jti
          WHERE (t.status = 'consumed' AND p.token_jti IS NULL)
             OR (t.status <> 'consumed' AND p.token_jti IS NOT NULL)
             OR (t.status <> 'active' AND t.resolved_at IS NULL)",
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert!(orphans.is_empty(), "tokens out of step with their payment: {orphans:?}");
}

#[sqlx::test(migrations = "../../migrations")]
async fn i7_an_expired_token_is_never_settled(pool: PgPool)
{
    let employee = make_employee(&pool, "claire@example.test").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    credit(&pool, employee.account, euros("100.00")).await;

    let inside = issue_token(
        &pool,
        employee.account,
        euros("10.00"),
        at("2026-03-01T12:00:00Z"),
        at("2026-03-01T12:05:00Z"),
    )
    .await;
    settle_token(&pool, inside, &partner, at("2026-03-01T12:04:59Z")).await;

    assert!(settled_after_expiry(&pool).await.is_empty());

    let outside = issue_token(
        &pool,
        employee.account,
        euros("10.00"),
        at("2026-03-01T13:00:00Z"),
        at("2026-03-01T13:05:00Z"),
    )
    .await;
    settle_token(&pool, outside, &partner, at("2026-03-01T13:05:01Z")).await;

    assert_eq!(
        settled_after_expiry(&pool).await,
        vec![outside.as_uuid()],
        "a payment settled past the expiry must be detected"
    );
}

async fn settled_after_expiry(pool: &PgPool) -> Vec<Uuid>
{
    sqlx::query_scalar::<_, Uuid>(
        "SELECT p.token_jti
           FROM payments p
           JOIN payment_tokens t ON t.jti = p.token_jti
          WHERE p.scanned_at >= t.expires_at
          ORDER BY p.scanned_at",
    )
    .fetch_all(pool)
    .await
    .unwrap()
}

#[sqlx::test(migrations = "../../migrations")]
async fn i8_the_ledger_and_the_audit_are_append_only(pool: PgPool)
{
    a_settled_payment(&pool).await;

    let update_entry = sqlx::query("UPDATE ledger_entries SET amount = amount + 1")
        .execute(&pool)
        .await;
    let delete_entry = sqlx::query("DELETE FROM ledger_entries").execute(&pool).await;
    let update_operation = sqlx::query("UPDATE ledger_operations SET memo = 'rewritten'")
        .execute(&pool)
        .await;
    let delete_operation = sqlx::query("DELETE FROM ledger_operations").execute(&pool).await;

    assert!(update_entry.is_err(), "UPDATE on ledger_entries must fail");
    assert!(delete_entry.is_err(), "DELETE on ledger_entries must fail");
    assert!(update_operation.is_err(), "UPDATE on ledger_operations must fail");
    assert!(delete_operation.is_err(), "DELETE on ledger_operations must fail");

    sqlx::query(
        "INSERT INTO audit_log (action, entity_type, entity_id)
         VALUES ('partner.approve', 'partner', gen_random_uuid())",
    )
    .execute(&pool)
    .await
    .unwrap();

    let update_audit = sqlx::query("UPDATE audit_log SET action = 'rewritten'")
        .execute(&pool)
        .await;
    let delete_audit = sqlx::query("DELETE FROM audit_log").execute(&pool).await;

    assert!(update_audit.is_err(), "UPDATE on audit_log must fail");
    assert!(delete_audit.is_err(), "DELETE on audit_log must fail");
}

#[sqlx::test(migrations = "../../migrations")]
async fn i9_rows_are_marked_never_removed(pool: PgPool)
{
    let employee = make_employee(&pool, "claire@example.test").await;
    let employer = make_employer(&pool, "Ministere de la Fonction Publique").await;
    let partner = make_partner(&pool, "chez-paul@example.test", "Chez Paul").await;

    let first = link_employment(&pool, &employee, employer, "MAT-0001").await;
    end_employment(&pool, first).await;
    link_employment(&pool, &employee, employer, "MAT-0001").await;

    let links = sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM employment_links WHERE employee_id = $1",
    )
    .bind(employee.employee)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(links, 2, "ending a link keeps the historic row and frees the slot");

    let admin = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO users (email, password_hash, role)
         VALUES ('admin@example.test', 'not-a-real-hash', 'admin')
         RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let highlight = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO partner_highlights (partner_id, placement, position, created_by)
         VALUES ($1, 'minister_pick', 1, $2)
         RETURNING id",
    )
    .bind(partner.partner)
    .bind(admin)
    .fetch_one(&pool)
    .await
    .unwrap();

    sqlx::query("UPDATE partner_highlights SET removed_at = now() WHERE id = $1")
        .bind(highlight)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO partner_highlights (partner_id, placement, position, created_by)
         VALUES ($1, 'minister_pick', 1, $2)",
    )
    .bind(partner.partner)
    .bind(admin)
    .execute(&pool)
    .await
    .unwrap();

    let highlights = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM partner_highlights")
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(highlights, 2, "removing a highlight keeps the historic row");
}
