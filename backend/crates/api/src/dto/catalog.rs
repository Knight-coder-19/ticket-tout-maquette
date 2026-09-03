// Catalog DTOs: city and text query filters, and the approved-partner entry with city and neighbourhood.
// Priority: P1

use cartepro_core::directory::City;
use cartepro_core::partners::{PartnerCard, ServiceMode};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize)]
pub struct CatalogQuery {
    pub city: Option<String>,
    pub service_mode: Option<String>,
    pub q: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CityRef {
    pub id: String,
    pub name: String,
    pub department: String,
}

impl From<&City> for CityRef {
    fn from(city: &City) -> Self {
        CityRef {
            id: city.id.to_string(),
            name: city.name.clone(),
            department: city.department.clone(),
        }
    }
}

fn service_mode_str(mode: ServiceMode) -> &'static str {
    match mode {
        ServiceMode::Physical => "physical",
        ServiceMode::Online => "online",
        ServiceMode::Both => "both",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CatalogItem {
    pub id: String,
    pub trade_name: String,
    pub category: String,
    pub service_mode: String,
    pub city: Option<CityRef>,
    pub district: Option<String>,
    pub address_line: Option<String>,
    pub website_url: Option<String>,
    /// A4 — derived from `status == "approved"`.
    pub is_official_partner: bool,
}

impl From<&PartnerCard> for CatalogItem {
    fn from(card: &PartnerCard) -> Self {
        CatalogItem {
            id: card.id.to_string(),
            trade_name: card.trade_name.clone(),
            category: card.category.clone(),
            service_mode: service_mode_str(card.service_mode).to_string(),
            city: card.city.as_ref().map(CityRef::from),
            district: card.district.clone(),
            address_line: card.address_line.clone(),
            website_url: card.website_url.clone(),
            is_official_partner: card.is_official_partner,
        }
    }
}
