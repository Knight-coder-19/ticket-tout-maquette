// Declare Partner, PartnerStatus, ServiceMode and PartnerError, and re-export registration, review,
// catalog and highlights. One partner is one point of sale (decision 11): no multi-establishment field.
// Priority: P1

pub mod catalog;
pub mod highlights;
pub mod registration;
pub mod repo;
pub mod review;

pub use highlights::{HighlightPlacement, HighlightWithPartner, MinisterPick};
pub use repo::approved_account;

use crate::directory::City;
use crate::ids::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Postgres ENUM `partner_status`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "partner_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PartnerStatus {
    Pending,
    Approved,
    Rejected,
    Suspended,
    Closed,
}

/// Postgres ENUM `service_mode` (A1). An `online` partner does not need a city.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "service_mode", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ServiceMode {
    Physical,
    Online,
    Both,
}

/// The point of sale. `is_official_partner` is NOT a field (A4): it is `status == Approved`.
#[derive(Debug, Clone)]
pub struct Partner {
    pub id: PartnerId,
    pub user_id: UserId,
    pub account_id: AccountId,
    pub legal_name: String,
    pub trade_name: String,
    pub category: String,
    pub ifu: Option<String>,
    pub service_mode: ServiceMode,
    pub website_url: Option<String>,
    pub city_id: Option<CityId>,
    pub district: Option<String>,
    pub address_line: Option<String>,
    pub status: PartnerStatus,
    pub submitted_at: DateTime<Utc>,
    pub reviewed_by: Option<UserId>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_reason: Option<String>,
}

impl Partner {
    /// A4 — derived, never stored.
    pub fn is_official_partner(&self) -> bool {
        matches!(self.status, PartnerStatus::Approved)
    }
}

#[derive(Debug, Clone)]
pub struct PartnerCard {
    pub id: PartnerId,
    pub trade_name: String,
    pub category: String,
    pub service_mode: ServiceMode,
    pub city: Option<City>,
    pub district: Option<String>,
    pub address_line: Option<String>,
    pub website_url: Option<String>,
    pub is_official_partner: bool,
}

#[derive(Debug, Error)]
pub enum PartnerError {
    #[error("partner not found")]
    NotFound,
    #[error("partner is not approved")]
    NotApproved,
    #[error("a physical partner needs a city")]
    CityRequired,
    #[error("partner is not eligible for a highlight")]
    HighlightNotEligible,
    #[error("partner already highlighted at this placement")]
    HighlightDuplicate,
    #[error("reorder list does not match the placement contents")]
    ReorderMismatch,
    #[error(transparent)]
    Audit(#[from] crate::audit::AuditError),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl From<PartnerError> for crate::error::CoreError {
    fn from(err: PartnerError) -> Self {
        use crate::error::CoreError;
        match err {
            PartnerError::NotApproved => CoreError::PartnerNotApproved,
            PartnerError::HighlightNotEligible => CoreError::HighlightNotEligible,
            PartnerError::HighlightDuplicate => CoreError::HighlightDuplicate,
            PartnerError::Db(e) => CoreError::Db(e),
            PartnerError::Audit(crate::audit::AuditError::Db(e)) => CoreError::Db(e),
            _ => CoreError::Internal,
        }
    }
}
