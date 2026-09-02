//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// money
//

use std::fmt;

use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

const SUBUNIT: i64 = 100;
const SCALE: usize = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, sqlx::Type)]
#[sqlx(transparent)]
pub struct Money(i64);

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum InvalidMoneyError {
    #[error("negative amount: {0}")]
    Negative(String),

    #[error("malformed amount: {0}")]
    Malformed(String),

    #[error("more than two decimal places: {0}")]
    TooManyDecimals(String),

    #[error("amount out of range: {0}")]
    OutOfRange(String),
}


impl Money {
    pub fn zero() -> Self
    {
        Money(0)
    }

    pub fn try_new(cents: i64) -> Result<Self, InvalidMoneyError>
    {
        if cents < 0 {
            return Err(InvalidMoneyError::Negative(cents.to_string()));
        }
        Ok(Money(cents))
    }

    pub fn parse_euros(text: &str) -> Result<Self, InvalidMoneyError>
    {
        let trimmed = text.trim();
        let unsigned = trimmed.strip_prefix('+').unwrap_or(trimmed);

        if unsigned.starts_with('-') {
            return Err(InvalidMoneyError::Negative(text.to_string()));
        }

        let normalized = unsigned.replace(',', ".");
        let (whole, frac) = match normalized.split_once('.') {
            Some((whole, frac)) => (whole, frac),
            None => (normalized.as_str(), "")
        };

        if whole.is_empty() || !whole.bytes().all(|b| b.is_ascii_digit()) {
            return Err(InvalidMoneyError::Malformed(text.to_string()));
        }
        if !frac.bytes().all(|b| b.is_ascii_digit()) {
            return Err(InvalidMoneyError::Malformed(text.to_string()));
        }
        if frac.len() > SCALE {
            return Err(InvalidMoneyError::TooManyDecimals(text.to_string()));
        }

        let euros = match whole.parse::<i64>() {
            Ok(euros) => euros,
            Err(_) => return Err(InvalidMoneyError::OutOfRange(text.to_string()))
        };
        let mut subunits = frac.parse::<i64>().unwrap_or(0);
        for _ in frac.len()..SCALE {
            subunits *= 10;
        }

        match euros.checked_mul(SUBUNIT).and_then(|c| c.checked_add(subunits)) {
            Some(cents) => Ok(Money(cents)),
            _ => Err(InvalidMoneyError::OutOfRange(text.to_string()))
        }
    }

    pub fn cents(self) -> i64
    {
        self.0
    }

    pub fn checked_add(self, other: Money) -> Option<Money>
    {
        match self.0.checked_add(other.0) {
            Some(result) => Some(Money(result)),
            _ => None
        }
    }

    pub fn checked_sub(self, other: Money) -> Option<Money>
    {
        match self.0.checked_sub(other.0) {
            Some(result) if result >= 0 => Some(Money(result)),
            _ => None
        }
    }

    pub fn is_positive(self) -> bool
    {
        self.0 > 0
    }
}

impl TryFrom<i64> for Money {
    type Error = InvalidMoneyError;

    fn try_from(cents: i64) -> Result<Self, Self::Error>
    {
        Money::try_new(cents)
    }
}

impl From<Money> for i64 {
    fn from(money: Money) -> Self
    {
        money.0
    }
}

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result
    {
        write!(f, "{}.{:02}", self.0 / SUBUNIT, self.0 % SUBUNIT)
    }
}

impl Serialize for Money {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_f64(self.0 as f64 / SUBUNIT as f64)
    }
}

struct MoneyVisitor;

impl<'de> Visitor<'de> for MoneyVisitor {
    type Value = Money;

    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result
    {
        write!(f, "a non-negative amount in euros with at most two decimal places")
    }

    fn visit_f64<E>(self, value: f64) -> Result<Money, E>
    where
        E: de::Error,
    {
        Money::parse_euros(&value.to_string()).map_err(de::Error::custom)
    }

    fn visit_u64<E>(self, value: u64) -> Result<Money, E>
    where
        E: de::Error,
    {
        Money::parse_euros(&value.to_string()).map_err(de::Error::custom)
    }

    fn visit_i64<E>(self, value: i64) -> Result<Money, E>
    where
        E: de::Error,
    {
        Money::parse_euros(&value.to_string()).map_err(de::Error::custom)
    }

    fn visit_str<E>(self, value: &str) -> Result<Money, E>
    where
        E: de::Error,
    {
        Money::parse_euros(value).map_err(de::Error::custom)
    }
}

impl<'de> Deserialize<'de> for Money {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(MoneyVisitor)
    }
}
