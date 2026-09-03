// Implement submit_registration creating users, accounts and partners in pending status.
// A1: validate the service_mode / city_id coherence before inserting, on top of the database CHECK
// (a physical partner needs a city, an online one does not). Priority: P1

use super::{Partner, PartnerError, ServiceMode};
use crate::ids::CityId;
use crate::PgTx;

/// Partner registration form.
#[derive(Debug, Clone)]
pub struct RegistrationForm<'a> {
    pub email: &'a str,
    pub password_hash: &'a str,
    pub legal_name: &'a str,
    pub trade_name: &'a str,
    pub category: &'a str,
    pub ifu: Option<&'a str>,
    pub service_mode: ServiceMode,
    pub website_url: Option<&'a str>,
    pub city_id: Option<CityId>,
    pub district: Option<&'a str>,
    pub address_line: Option<&'a str>,
}

/// Create `users` → `accounts` (owner partner) → `partners` in `pending` status.
/// A1: reject with `CityRequired` when `service_mode != Online` and `city_id.is_none()`,
/// before the INSERT, duplicating the `CHECK physical_needs_city`.
pub async fn submit_registration(
    tx: &mut PgTx<'_>,
    form: RegistrationForm<'_>,
) -> Result<Partner, PartnerError> {
    todo!()
}
