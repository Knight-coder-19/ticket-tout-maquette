//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// clock
//

use std::sync::Mutex;

use chrono::{DateTime, Duration, Utc};

pub trait Clock: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}

#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> DateTime<Utc>
    {
        Utc::now()
    }
}

#[derive(Debug)]
pub struct FixedClock {
    at: Mutex<DateTime<Utc>>,
}

impl FixedClock {
    pub fn new(at: DateTime<Utc>) -> Self
    {
        FixedClock { at: Mutex::new(at) }
    }

    pub fn advance(&self, by: Duration)
    {
        let mut at = self.at.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        *at += by;
    }

    pub fn set(&self, at: DateTime<Utc>)
    {
        let mut current = self.at.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        *current = at;
    }
}

impl Clock for FixedClock {
    fn now(&self) -> DateTime<Utc>
    {
        *self.at.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}
