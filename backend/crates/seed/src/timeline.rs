use chrono::{DateTime, Duration, TimeZone, Utc};
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};

pub const SEED: u64 = 20_260_605;

pub const EMPLOYEE_COUNT: usize = 50;
pub const PARTNER_COUNT: usize = 12;

const ZERO_EMPLOYEES: [usize; 3] = [0, 1, 2];
const LOW_TARGETS: [(usize, i64); 2] = [(3, 137), (4, 349)];
const REFUSED_EMPLOYEES: [usize; 5] = [10, 20, 30, 40, 45];

const SPECIAL_COUNT: usize = 5;
const SPECIAL_DAYS: [i64; 4] = [6, 18, 44, 71];
const SPECIAL_TOPUPS: [i64; 2] = [8000, 6000];
const SPECIAL_PAYMENTS: [[i64; 4]; SPECIAL_COUNT] = [
    [2340, 4115, 3280, 4265],
    [1890, 3420, 5150, 3540],
    [2760, 3990, 2870, 4380],
    [2340, 4115, 3280, 4128],
    [2340, 4115, 3280, 3916],
];

const TOPUP_DAYS: [i64; 2] = [1, 31];
const SECOND_TOPUP_DAY: i64 = TOPUP_DAYS[1];
const FIRST_PAYMENT_DAY: i64 = 2;
const LAST_PAYMENT_DAY: i64 = 84;
const REFUSAL_DAY: i64 = 87;

const MIN_PAYMENT: i64 = 250;
const MAX_PAYMENT: i64 = 6500;
const MIN_MARGIN: i64 = 1500;
const MAX_MARGIN: i64 = 9000;
const REFUSAL_EXCESS: (i64, i64) = (2000, 6000);

#[derive(Debug, Clone)]
pub struct Topup {
    pub employee: usize,
    pub amount: i64,
    pub at: DateTime<Utc>,
    pub reference: String,
}

#[derive(Debug, Clone)]
pub struct Attempt {
    pub employee: usize,
    pub partner: usize,
    pub amount: i64,
    pub at: DateTime<Utc>,
    pub expect_refusal: bool,
}

#[derive(Debug, Clone)]
pub enum Event {
    Topup(Topup),
    Attempt(Attempt),
}

impl Event {
    pub fn at(&self) -> DateTime<Utc>
    {
        match self {
            Event::Topup(topup) => topup.at,
            Event::Attempt(attempt) => attempt.at
        }
    }

    fn employee(&self) -> usize
    {
        match self {
            Event::Topup(topup) => topup.employee,
            Event::Attempt(attempt) => attempt.employee
        }
    }
}

pub fn epoch() -> DateTime<Utc>
{
    Utc.with_ymd_and_hms(2026, 3, 2, 8, 0, 0).unwrap()
}

fn topup_at(day: i64) -> DateTime<Utc>
{
    epoch() + Duration::days(day)
}

fn payment_at(day: i64, employee: usize, seq: usize) -> DateTime<Utc>
{
    let minutes = 60 + (employee as i64 * 7 + seq as i64 * 13) % 600;

    epoch() + Duration::days(day) + Duration::minutes(minutes)
}

fn payment_count(employee: usize) -> usize
{
    match employee < 45 {
        true => 4,
        false => 3
    }
}

fn distinct_days(rng: &mut StdRng, count: usize) -> Vec<i64>
{
    let mut days: Vec<i64> = Vec::with_capacity(count);

    while days.len() < count {
        let day = rng.gen_range(FIRST_PAYMENT_DAY..=LAST_PAYMENT_DAY);

        if !days.contains(&day) {
            days.push(day);
        }
    }
    days.sort_unstable();
    days
}

fn special_plan(employee: usize) -> (Vec<(i64, i64)>, [i64; 2])
{
    let amounts = SPECIAL_PAYMENTS[employee];
    let schedule = SPECIAL_DAYS
        .iter()
        .zip(amounts.iter())
        .map(|(day, amount)| (*day, *amount))
        .collect();

    (schedule, SPECIAL_TOPUPS)
}

fn ordinary_plan(rng: &mut StdRng, employee: usize) -> (Vec<(i64, i64)>, [i64; 2])
{
    let days = distinct_days(rng, payment_count(employee));
    let schedule: Vec<(i64, i64)> = days
        .into_iter()
        .map(|day| (day, rng.gen_range(MIN_PAYMENT..MAX_PAYMENT)))
        .collect();

    let before: i64 = schedule.iter().filter(|(d, _)| *d < SECOND_TOPUP_DAY).map(|(_, a)| a).sum();
    let after: i64 = schedule.iter().filter(|(d, _)| *d >= SECOND_TOPUP_DAY).map(|(_, a)| a).sum();
    let first = before + rng.gen_range(MIN_MARGIN..MAX_MARGIN);
    let second = after + rng.gen_range(MIN_MARGIN..MAX_MARGIN);

    (schedule, [first, second])
}

pub fn build() -> Vec<Event>
{
    let mut rng = StdRng::seed_from_u64(SEED);
    let mut events: Vec<Event> = Vec::new();

    for employee in 0..EMPLOYEE_COUNT {
        let special = ZERO_EMPLOYEES.contains(&employee)
            || LOW_TARGETS.iter().any(|(index, _)| *index == employee);
        let (schedule, topups) = match special {
            true => special_plan(employee),
            false => ordinary_plan(&mut rng, employee)
        };

        for (slot, amount) in topups.iter().enumerate() {
            events.push(Event::Topup(Topup {
                employee,
                amount: *amount,
                at: topup_at(TOPUP_DAYS[slot]),
                reference: format!("PAY-2026-{:02}-AG{:04}", slot + 3, employee + 1)
            }));
        }

        let mut balance = 0;

        for (seq, (day, amount)) in schedule.iter().enumerate() {
            events.push(Event::Attempt(Attempt {
                employee,
                partner: rng.gen_range(0..PARTNER_COUNT),
                amount: *amount,
                at: payment_at(*day, employee, seq),
                expect_refusal: false
            }));
            balance += amount;
        }

        if REFUSED_EMPLOYEES.contains(&employee) {
            let available = topups.iter().sum::<i64>() - balance;

            events.push(Event::Attempt(Attempt {
                employee,
                partner: rng.gen_range(0..PARTNER_COUNT),
                amount: available + rng.gen_range(REFUSAL_EXCESS.0..REFUSAL_EXCESS.1),
                at: payment_at(REFUSAL_DAY, employee, 9),
                expect_refusal: true
            }));
        }
    }

    events.sort_by_key(|event| (event.at(), event.employee()));
    events
}
