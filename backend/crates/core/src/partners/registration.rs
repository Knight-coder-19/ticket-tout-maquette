use super::{repo, Partner, PartnerError, ServiceMode};
use crate::clock::Clock;
use crate::directory;
use crate::identity::UserRole;
use crate::ids::CityId;
use crate::PgTx;

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

pub async fn submit_registration(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    form: RegistrationForm<'_>,
) -> Result<Partner, PartnerError> {
    if form.service_mode != ServiceMode::Online && form.city_id.is_none() {
        return Err(PartnerError::CityRequired);
    }

    let now = clock.now();

    let user_id = directory::repo::insert_user(
        tx,
        form.email,
        form.password_hash,
        UserRole::Partner,
        now,
    )
    .await?;

    let account_id = repo::insert_partner_account(tx, user_id, now).await?;

    let partner = repo::insert_partner(
        tx,
        user_id,
        account_id,
        form.legal_name,
        form.trade_name,
        form.category,
        form.ifu,
        form.service_mode,
        form.website_url,
        form.city_id,
        form.district,
        form.address_line,
        now,
    )
    .await?;

    Ok(partner)
}
