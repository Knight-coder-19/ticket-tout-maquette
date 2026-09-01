use std::sync::Arc;
use std::thread;

use cartepro_core::clock::{Clock, FixedClock, SystemClock};
use chrono::{Duration, TimeZone, Utc};

#[test]
fn system_clock_moves_forward()
{
    let clock = SystemClock;
    let first = clock.now();
    let second = clock.now();
    assert!(second >= first);
    assert!(first > Utc.with_ymd_and_hms(2020, 1, 1, 0, 0, 0).unwrap());
}

#[test]
fn fixed_clock_stays_put_until_advanced()
{
    let start = Utc.with_ymd_and_hms(2026, 9, 1, 12, 0, 0).unwrap();
    let clock = FixedClock::new(start);

    assert_eq!(clock.now(), start);
    assert_eq!(clock.now(), start);

    clock.advance(Duration::minutes(5));
    assert_eq!(clock.now(), start + Duration::minutes(5));

    clock.advance(Duration::seconds(1));
    assert_eq!(clock.now(), start + Duration::seconds(301));

    clock.set(start);
    assert_eq!(clock.now(), start);
}

#[test]
fn expiry_can_be_tested_without_waiting()
{
    let start = Utc.with_ymd_and_hms(2026, 9, 1, 12, 0, 0).unwrap();
    let clock = FixedClock::new(start);
    let expires_at = clock.now() + Duration::minutes(5);

    clock.advance(Duration::minutes(4));
    assert!(clock.now() < expires_at);

    clock.advance(Duration::minutes(2));
    assert!(clock.now() > expires_at);
}

#[test]
fn a_shared_clock_can_be_advanced_from_another_thread()
{
    let start = Utc.with_ymd_and_hms(2026, 9, 1, 12, 0, 0).unwrap();
    let clock = Arc::new(FixedClock::new(start));
    let mover = Arc::clone(&clock);

    thread::spawn(move || mover.advance(Duration::hours(1))).join().unwrap();

    assert_eq!(clock.now(), start + Duration::hours(1));
}

#[test]
fn both_clocks_work_behind_a_trait_object()
{
    let start = Utc.with_ymd_and_hms(2026, 9, 1, 12, 0, 0).unwrap();
    let clocks: Vec<Arc<dyn Clock>> = vec![Arc::new(SystemClock), Arc::new(FixedClock::new(start))];

    assert_eq!(clocks[1].now(), start);
    assert!(clocks[0].now() > start - Duration::days(365 * 10));
}
