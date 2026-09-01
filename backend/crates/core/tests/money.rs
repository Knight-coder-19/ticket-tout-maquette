use cartepro_core::money::{InvalidMoneyError, Money};

#[derive(Debug, PartialEq, serde::Serialize, serde::Deserialize)]
struct Body {
    amount: Money,
}

fn cents(text: &str) -> i64
{
    Money::parse_euros(text).unwrap().cents()
}

#[test]
fn try_new_rejects_negative_cents()
{
    assert_eq!(Money::try_new(0).unwrap().cents(), 0);
    assert_eq!(Money::try_new(45656).unwrap().cents(), 45656);
    assert_eq!(Money::try_new(-1), Err(InvalidMoneyError::Negative("-1".into())));
    assert!(Money::try_from(-1i64).is_err());
}

#[test]
fn parse_euros_accepts_the_shapes_a_human_writes()
{
    assert_eq!(cents("456.56"), 45656);
    assert_eq!(cents("3.99"), 399);
    assert_eq!(cents("3,99"), 399);
    assert_eq!(cents("3"), 300);
    assert_eq!(cents("3.9"), 390);
    assert_eq!(cents("0.05"), 5);
    assert_eq!(cents("0"), 0);
    assert_eq!(cents("  12.34  "), 1234);
    assert_eq!(cents("+7.10"), 710);
}

#[test]
fn parse_euros_rejects_and_says_why()
{
    assert_eq!(Money::parse_euros("3.999"), Err(InvalidMoneyError::TooManyDecimals("3.999".into())));
    assert_eq!(Money::parse_euros("-3.99"), Err(InvalidMoneyError::Negative("-3.99".into())));
    assert_eq!(Money::parse_euros("abc"), Err(InvalidMoneyError::Malformed("abc".into())));
    assert_eq!(Money::parse_euros("1 234.56"), Err(InvalidMoneyError::Malformed("1 234.56".into())));
    assert_eq!(Money::parse_euros("1,234.56"), Err(InvalidMoneyError::Malformed("1,234.56".into())));
    assert_eq!(Money::parse_euros(".99"), Err(InvalidMoneyError::Malformed(".99".into())));
    assert_eq!(Money::parse_euros(""), Err(InvalidMoneyError::Malformed("".into())));
    assert!(matches!(Money::parse_euros("99999999999999999999"), Err(InvalidMoneyError::OutOfRange(_))));
}

#[test]
fn parse_euros_never_loses_a_cent_to_binary_rounding()
{
    for c in 1..200_000i64 {
        let euros = c as f64 / 100.0;
        assert_eq!(Money::parse_euros(&euros.to_string()).unwrap().cents(), c);
    }
}

#[test]
fn checked_add_stops_at_overflow()
{
    let a = Money::parse_euros("456.56").unwrap();
    let b = Money::parse_euros("3.99").unwrap();
    assert_eq!(a.checked_add(b).unwrap().cents(), 46055);
    assert_eq!(Money::try_new(i64::MAX).unwrap().checked_add(b), None);
    assert_eq!(a.checked_add(Money::zero()).unwrap(), a);
}

#[test]
fn checked_sub_refuses_to_go_below_zero()
{
    let a = Money::parse_euros("456.56").unwrap();
    let b = Money::parse_euros("3.99").unwrap();
    assert_eq!(a.checked_sub(b).unwrap().cents(), 45257);
    assert_eq!(a.checked_sub(a).unwrap(), Money::zero());
    assert_eq!(b.checked_sub(a), None);
    assert_eq!(Money::zero().checked_sub(Money::try_new(1).unwrap()), None);
}

#[test]
fn summing_many_small_amounts_stays_exact()
{
    let mut total = Money::zero();
    for _ in 0..1000 {
        total = total.checked_add(Money::parse_euros("0.10").unwrap()).unwrap();
    }
    assert_eq!(total.cents(), 10_000);
    assert_eq!(total.to_string(), "100.00");
}

#[test]
fn display_pads_the_cents_and_round_trips()
{
    for (c, shown) in [(45656i64, "456.56"), (5, "0.05"), (0, "0.00"), (100, "1.00"), (1205, "12.05")] {
        let m = Money::try_new(c).unwrap();
        assert_eq!(m.to_string(), shown);
        assert_eq!(Money::parse_euros(&m.to_string()).unwrap(), m);
    }
}

#[test]
fn is_positive_and_ordering()
{
    assert!(!Money::zero().is_positive());
    assert!(Money::try_new(1).unwrap().is_positive());
    let mut amounts = [cents("3.99"), cents("0.05"), cents("456.56")]
        .map(|c| Money::try_new(c).unwrap());
    amounts.sort();
    assert_eq!(amounts.map(|m| m.to_string()), ["0.05", "3.99", "456.56"]);
}

#[test]
fn json_carries_decimal_euros_in_both_directions()
{
    let body: Body = serde_json::from_str(r#"{"amount": 456.56}"#).unwrap();
    assert_eq!(body.amount.cents(), 45656);
    assert_eq!(serde_json::to_string(&body).unwrap(), r#"{"amount":456.56}"#);

    assert_eq!(serde_json::from_str::<Body>(r#"{"amount": 3.99}"#).unwrap().amount.cents(), 399);
    assert_eq!(serde_json::from_str::<Body>(r#"{"amount": 2.01}"#).unwrap().amount.cents(), 201);
    assert_eq!(serde_json::from_str::<Body>(r#"{"amount": 25}"#).unwrap().amount.cents(), 2500);
    assert_eq!(serde_json::from_str::<Body>(r#"{"amount": "12,34"}"#).unwrap().amount.cents(), 1234);
}

#[test]
fn json_rejects_what_the_domain_forbids()
{
    for body in [r#"{"amount": -5.00}"#, r#"{"amount": 3.999}"#, r#"{"amount": "abc"}"#, r#"{"amount": true}"#] {
        assert!(serde_json::from_str::<Body>(body).is_err(), "should reject {body}");
    }
}
