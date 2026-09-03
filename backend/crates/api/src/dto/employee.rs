use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::{Validate, ValidationError};

use cartepro_core::crypto::short_code;
use cartepro_core::ids::{Jti, OperationId};
use cartepro_core::ledger::{Account, OperationKind};
use cartepro_core::money::{InvalidMoneyError, Money};
use cartepro_core::payments::IssuedToken;

use crate::dto::catalog::CatalogItem;
use crate::dto::Paginated;

pub const CURRENCY: &str = "EUR";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct BalanceResponse {
    #[schema(value_type = f64, example = 456.56)]
    pub settled: Money,

    #[schema(value_type = f64, example = 25.0)]
    pub held: Money,

    #[schema(value_type = f64, example = 431.56)]
    pub available: Money,

    #[schema(example = "EUR")]
    pub currency: String,
}

impl TryFrom<&Account> for BalanceResponse {
    type Error = InvalidMoneyError;

    fn try_from(account: &Account) -> Result<Self, Self::Error>
    {
        Ok(BalanceResponse {
            settled: Money::try_new(account.balance_settled)?,
            held: Money::try_new(account.balance_held)?,
            available: Money::try_new(account.available_cents())?,
            currency: CURRENCY.to_string()
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum TransactionDirection {
    In,
    Out,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct EmployeeTransaction {
    #[schema(value_type = String, format = Uuid)]
    pub id: OperationId,

    #[schema(value_type = String, example = "payment")]
    pub kind: OperationKind,

    #[schema(value_type = f64, example = 12.5)]
    pub amount: Money,

    pub direction: TransactionDirection,

    pub counterparty: String,

    pub occurred_at: DateTime<Utc>,

    pub reference: Option<String>,
}

pub type EmployeeTransactionList = Paginated<EmployeeTransaction>;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MinisterPick {
    pub partner: CatalogItem,
    pub position: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Validate)]
#[validate(schema(function = "amount_is_positive"))]
pub struct AuthorizeRequest {
    #[schema(value_type = f64, example = 25.0)]
    pub amount: Money,
}

fn amount_is_positive(request: &AuthorizeRequest) -> Result<(), ValidationError>
{
    if request.amount.is_positive() {
        return Ok(());
    }
    Err(ValidationError::new("amount_must_be_positive"))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct IssuedTokenResponse {
    #[schema(value_type = String, format = Uuid)]
    pub jti: Jti,

    #[schema(example = "86RB-57CT")]
    pub short_code: String,

    #[schema(value_type = f64, example = 25.0)]
    pub amount: Money,

    pub issued_at: DateTime<Utc>,

    pub expires_at: DateTime<Utc>,

    pub qr_payload: String,
}

impl From<IssuedToken> for IssuedTokenResponse {
    fn from(token: IssuedToken) -> Self
    {
        IssuedTokenResponse {
            jti: token.jti,
            short_code: short_code::format_for_display(&token.short_code),
            amount: token.amount,
            issued_at: token.issued_at,
            expires_at: token.expires_at,
            qr_payload: token.qr
        }
    }
}
