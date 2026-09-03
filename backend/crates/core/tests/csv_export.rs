use chrono::{DateTime, Utc};
use uuid::Uuid;

use cartepro_core::ids::{AttemptId, EmployeeId, OperationId, PartnerId};
use cartepro_core::money::Money;
use cartepro_core::payments::export;
use cartepro_core::payments::{AttemptOutcome, PaymentAttempt};

fn at(text: &str) -> DateTime<Utc>
{
    DateTime::parse_from_rfc3339(text).unwrap().with_timezone(&Utc)
}

fn uuid(text: &str) -> Uuid
{
    Uuid::parse_str(text).unwrap()
}

fn settled() -> PaymentAttempt
{
    PaymentAttempt {
        id: AttemptId::from(uuid("11111111-1111-4111-8111-111111111111")),
        employee_id: EmployeeId::from(uuid("22222222-2222-4222-8222-222222222222")),
        partner_id: PartnerId::from(uuid("33333333-3333-4333-8333-333333333333")),
        amount: Money::parse_euros("12.50").unwrap(),
        outcome: AttemptOutcome::Settled,
        operation_id: Some(OperationId::from(uuid("44444444-4444-4444-8444-444444444444"))),
        occurred_at: at("2026-06-05T09:00:00Z"),
        recorded_at: at("2026-06-05T09:00:01Z")
    }
}

fn refused() -> PaymentAttempt
{
    PaymentAttempt {
        id: AttemptId::from(uuid("55555555-5555-4555-8555-555555555555")),
        employee_id: EmployeeId::from(uuid("22222222-2222-4222-8222-222222222222")),
        partner_id: PartnerId::from(uuid("66666666-6666-4666-8666-666666666666")),
        amount: Money::parse_euros("40.00").unwrap(),
        outcome: AttemptOutcome::InsufficientFunds,
        operation_id: None,
        occurred_at: at("2026-06-05T18:30:00Z"),
        recorded_at: at("2026-06-05T18:30:00Z")
    }
}

#[test]
fn the_header_matches_the_published_contract()
{
    assert_eq!(
        export::HEADER,
        "id;date_iso8601;employee_id;partner_id;amount_cents;status",
        "the column names and their order are fixed by the reading script"
    );
}

#[test]
fn a_settled_and_a_refused_line_render_exactly()
{
    let csv = export::to_csv(&[settled(), refused()]);

    assert_eq!(
        csv,
        "id;date_iso8601;employee_id;partner_id;amount_cents;status\n\
         11111111-1111-4111-8111-111111111111;2026-06-05T09:00:00Z;\
         22222222-2222-4222-8222-222222222222;33333333-3333-4333-8333-333333333333;1250;settled\n\
         55555555-5555-4555-8555-555555555555;2026-06-05T18:30:00Z;\
         22222222-2222-4222-8222-222222222222;66666666-6666-4666-8666-666666666666;\
         4000;insufficient_funds\n"
    );
}

#[test]
fn an_empty_export_still_carries_its_header()
{
    assert_eq!(export::to_csv(&[]), format!("{}\n", export::HEADER));
}

#[test]
fn the_amount_is_written_in_whole_cents_never_in_decimal_euros()
{
    let csv = export::to_csv(&[settled()]);

    assert!(csv.contains(";1250;"), "12.50 EUR must be written 1250");
    assert!(!csv.contains("12.50"), "no decimal separator on the amount column");
    assert!(!csv.contains("12,50"), "no comma decimal separator either");
}

#[test]
fn the_file_has_no_byte_order_mark_and_uses_line_feeds()
{
    let csv = export::to_csv(&[settled(), refused()]);

    assert!(!csv.starts_with('\u{feff}'), "a BOM would break a strict UTF-8 reader");
    assert!(!csv.contains('\r'), "line endings are LF, not CRLF");
    assert!(csv.ends_with('\n'), "the last line is terminated like the others");
    assert_eq!(csv.lines().count(), 3, "one header plus one line per transaction");
}

#[test]
fn every_line_carries_exactly_six_fields()
{
    let csv = export::to_csv(&[settled(), refused()]);

    for line in csv.lines() {
        assert_eq!(
            line.split(';').count(),
            6,
            "a missing or extra semicolon shifts every column: {line}"
        );
    }
}
