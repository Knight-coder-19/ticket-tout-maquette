use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::{Validate, ValidationError};

use cartepro_core::ids::{Jti, OperationId};
use cartepro_core::money::Money;
use cartepro_core::payments::{EntryMode, Settlement, TokenRef};

use crate::dto::Paginated;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct PartnerSummary {
    #[schema(value_type = f64, example = 1284.9)]
    pub total_received: Money,

    pub transaction_count: i64,

    pub period_from: DateTime<Utc>,

    pub period_to: DateTime<Utc>,

    pub is_official_partner: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct PartnerTransaction {
    #[schema(value_type = String, format = Uuid)]
    pub id: OperationId,

    #[schema(value_type = f64, example = 12.5)]
    pub amount: Money,

    #[schema(value_type = String, example = "qr_scan")]
    pub entry_mode: EntryMode,

    pub occurred_at: DateTime<Utc>,

    pub synced_at: DateTime<Utc>,

    #[schema(example = "K. A.")]
    pub customer_label: String,
}

pub type PartnerTransactionList = Paginated<PartnerTransaction>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Validate)]
#[validate(schema(function = "exactly_one_reference"))]
pub struct SettleRequest {
    #[schema(value_type = Option<String>, format = Uuid)]
    pub jti: Option<Jti>,

    #[validate(length(min = 1, max = 32))]
    #[schema(example = "86RB-57CT")]
    pub short_code: Option<String>,

    pub scanned_at: DateTime<Utc>,
}

impl SettleRequest {
    pub fn token_ref(&self) -> Option<TokenRef>
    {
        match (self.jti, self.short_code.as_deref()) {
            (Some(jti), None) => Some(TokenRef::Jti(jti)),
            (None, Some(code)) => Some(TokenRef::ShortCode(code.to_string())),
            _ => None
        }
    }
}

fn exactly_one_reference(request: &SettleRequest) -> Result<(), ValidationError>
{
    match (request.jti.is_some(), request.short_code.is_some()) {
        (true, false) => Ok(()),
        (false, true) => Ok(()),
        _ => Err(ValidationError::new("exactly_one_of_jti_or_short_code"))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    Settled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct PaymentResponse {
    #[schema(value_type = String, format = Uuid)]
    pub id: OperationId,

    #[schema(value_type = String, format = Uuid)]
    pub jti: Jti,

    #[schema(value_type = f64, example = 12.5)]
    pub amount: Money,

    #[schema(value_type = String, example = "qr_scan")]
    pub entry_mode: EntryMode,

    pub occurred_at: DateTime<Utc>,

    pub synced_at: DateTime<Utc>,

    pub status: PaymentStatus,
}

impl From<&Settlement> for PaymentResponse {
    fn from(settlement: &Settlement) -> Self
    {
        PaymentResponse {
            id: settlement.payment.operation_id,
            jti: settlement.payment.token_jti,
            amount: settlement.amount,
            entry_mode: settlement.payment.entry_mode,
            occurred_at: settlement.payment.scanned_at,
            synced_at: settlement.payment.synced_at,
            status: PaymentStatus::Settled
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum BatchItemStatus {
    Settled,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Validate)]
pub struct BatchSettleRequest {
    #[validate(length(min = 1, max = 100), nested)]
    pub items: Vec<SettleRequest>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct BatchSettleResult {
    #[schema(value_type = Option<String>, format = Uuid)]
    pub jti: Option<Jti>,

    pub status: BatchItemStatus,

    pub payment: Option<PaymentResponse>,

    #[schema(example = "TOKEN_EXPIRED")]
    pub error: Option<String>,
}

impl BatchSettleResult {
    pub fn settled(payment: PaymentResponse) -> Self
    {
        BatchSettleResult {
            jti: Some(payment.jti),
            status: BatchItemStatus::Settled,
            payment: Some(payment),
            error: None
        }
    }

    pub fn failed(jti: Option<Jti>, error: &str) -> Self
    {
        BatchSettleResult {
            jti,
            status: BatchItemStatus::Failed,
            payment: None,
            error: Some(error.to_string())
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct BatchSettleResponse {
    pub results: Vec<BatchSettleResult>,
}
