//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// export
//

use std::fmt::Write;

use super::PaymentAttempt;

pub const HEADER: &str = "id;date_iso8601;employee_id;partner_id;amount_cents;status";

pub const CONTENT_TYPE: &str = "text/csv; charset=utf-8";

pub const FILE_NAME: &str = "transactions.csv";

const SEPARATOR: char = ';';

const DATE_FORMAT: &str = "%Y-%m-%dT%H:%M:%SZ";

pub fn write_row(out: &mut String, attempt: &PaymentAttempt)
{
    let _ = writeln!(
        out,
        "{}{s}{}{s}{}{s}{}{s}{}{s}{}",
        attempt.id,
        attempt.occurred_at.format(DATE_FORMAT),
        attempt.employee_id,
        attempt.partner_id,
        attempt.amount.cents(),
        attempt.outcome.as_csv(),
        s = SEPARATOR
    );
}

pub fn to_csv(attempts: &[PaymentAttempt]) -> String
{
    let mut out = String::with_capacity(HEADER.len() + attempts.len() * 128);

    out.push_str(HEADER);
    out.push('\n');
    for attempt in attempts {
        write_row(&mut out, attempt);
    }
    out
}
