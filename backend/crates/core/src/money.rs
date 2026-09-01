//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// money
//

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Money(i64);

#[derive(Debug, PartialEq)]
pub struct InvalidMoneyError;


impl Money {
    pub fn try_new(amount: i64) -> Result<Self, InvalidMoneyError> {
        if amount < 0 {
            Err(InvalidMoneyError)
        }
        Ok(Money(amount))
    }

    pub fn value(self) -> i64
    {
        self.0
    }

    pub fn add(self, other: Money) -> Option<Money>
    {
        match self.0.checked_add(other.0) {
            Some(result) => Some(result),
            _ => None
        }
    }

    pub fn sub(self, other: Money) -> Option<Money> 
    {
        match self.0.checked_sub(other.0) {
        Some(result) => Some(result),
        _ => None
        }        
    }

    pub fn is_positive(self) -> bool
    {
        if self.0 < 0 {
            return true;
        }
        false
    }
}
