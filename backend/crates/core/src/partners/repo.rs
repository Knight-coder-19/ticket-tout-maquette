//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// repo
//

use chrono::{DateTime, Utc};
use sqlx::postgres::PgRow;
use sqlx::{PgConnection, Row};

use super::{Partner, PartnerCard, PartnerError, PartnerStatus, ServiceMode};
use crate::directory::City;
use crate::ids::{AccountId, CityId, PartnerId, UserId};
use crate::ledger::PgTransaction;

const PARTNER_COLUMNS: &str = "id, user_id, account_id, legal_name, trade_name, category, ifu,
     service_mode, website_url, city_id, district, address_line, status, submitted_at,
     reviewed_by, reviewed_at, review_reason";

pub const CARD_COLUMNS: &str =
    "p.id, p.trade_name, p.category, p.service_mode, p.district, p.address_line, p.website_url,
     (p.status = 'approved') AS is_official_partner,
     p.city_id, c.name AS city_name, c.department AS city_department";

pub fn card_from_row(row: &PgRow) -> Result<PartnerCard, sqlx::Error> {
    let city = match row.try_get::<Option<CityId>, _>("city_id")? {
        Some(id) => Some(City {
            id,
            name: row.try_get("city_name")?,
            department: row.try_get("city_department")?,
        }),
        None => None,
    };
    Ok(PartnerCard {
        id: row.try_get("id")?,
        trade_name: row.try_get("trade_name")?,
        category: row.try_get("category")?,
        service_mode: row.try_get("service_mode")?,
        city,
        district: row.try_get("district")?,
        address_line: row.try_get("address_line")?,
        website_url: row.try_get("website_url")?,
        is_official_partner: row.try_get("is_official_partner")?,
    })
}

pub async fn insert_partner_account(
    tx: &mut PgTransaction<'_>,
    owner_id: UserId,
    now: DateTime<Utc>,
) -> Result<AccountId, sqlx::Error> {
    sqlx::query_scalar::<_, AccountId>(
        "INSERT INTO accounts (owner_type, owner_id, opened_at)
         VALUES ('partner'::account_owner, $1, $2)
         RETURNING id",
    )
    .bind(owner_id)
    .bind(now)
    .fetch_one(&mut **tx)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_partner(
    tx: &mut PgTransaction<'_>,
    user_id: UserId,
    account_id: AccountId,
    legal_name: &str,
    trade_name: &str,
    category: &str,
    ifu: Option<&str>,
    service_mode: ServiceMode,
    website_url: Option<&str>,
    city_id: Option<CityId>,
    district: Option<&str>,
    address_line: Option<&str>,
    submitted_at: DateTime<Utc>,
) -> Result<Partner, sqlx::Error> {
    let statement = format!(
        "INSERT INTO partners
             (id, user_id, account_id, legal_name, trade_name, category, ifu, service_mode,
              website_url, city_id, district, address_line, submitted_at)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING {PARTNER_COLUMNS}"
    );
    let row = sqlx::query(&statement)
        .bind(user_id)
        .bind(account_id)
        .bind(legal_name)
        .bind(trade_name)
        .bind(category)
        .bind(ifu)
        .bind(service_mode)
        .bind(website_url)
        .bind(city_id)
        .bind(district)
        .bind(address_line)
        .bind(submitted_at)
        .fetch_one(&mut **tx)
        .await?;
    partner_from_row(&row)
}

pub async fn remove_highlights_for_partner(
    tx: &mut PgTransaction<'_>,
    partner: PartnerId,
    now: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE partner_highlights SET removed_at = $2
         WHERE partner_id = $1 AND removed_at IS NULL",
    )
    .bind(partner)
    .bind(now)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn partner_from_row(row: &PgRow) -> Result<Partner, sqlx::Error>
{
    Ok(Partner {
        id: row.try_get("id")?,
        user_id: row.try_get("user_id")?,
        account_id: row.try_get("account_id")?,
        legal_name: row.try_get("legal_name")?,
        trade_name: row.try_get("trade_name")?,
        category: row.try_get("category")?,
        ifu: row.try_get("ifu")?,
        service_mode: row.try_get("service_mode")?,
        website_url: row.try_get("website_url")?,
        city_id: row.try_get("city_id")?,
        district: row.try_get("district")?,
        address_line: row.try_get("address_line")?,
        status: row.try_get("status")?,
        submitted_at: row.try_get("submitted_at")?,
        reviewed_by: row.try_get("reviewed_by")?,
        reviewed_at: row.try_get("reviewed_at")?,
        review_reason: row.try_get("review_reason")?
    })
}

pub async fn approved_account(
    tx: &mut PgTransaction<'_>,
    partner: PartnerId,
) -> Result<AccountId, PartnerError>
{
    let found = sqlx::query_as::<_, (AccountId, PartnerStatus)>(
        "SELECT account_id, status FROM partners WHERE id = $1",
    )
    .bind(partner)
    .fetch_optional(&mut **tx)
    .await?;

    match found {
        Some((account, PartnerStatus::Approved)) => Ok(account),
        Some(_) => Err(PartnerError::NotApproved),
        None => Err(PartnerError::NotFound)
    }
}

pub async fn find_partner(
    conn: &mut PgConnection,
    partner: PartnerId,
) -> Result<Option<Partner>, PartnerError>
{
    let statement = format!("SELECT {PARTNER_COLUMNS} FROM partners WHERE id = $1");
    let row = sqlx::query(&statement)
        .bind(partner)
        .fetch_optional(conn)
        .await?;

    match row {
        Some(row) => Ok(Some(partner_from_row(&row)?)),
        None => Ok(None)
    }
}

pub async fn find_partner_by_user(
    conn: &mut PgConnection,
    user: UserId,
) -> Result<Option<Partner>, PartnerError>
{
    let statement = format!("SELECT {PARTNER_COLUMNS} FROM partners WHERE user_id = $1");
    let row = sqlx::query(&statement)
        .bind(user)
        .fetch_optional(conn)
        .await?;

    match row {
        Some(row) => Ok(Some(partner_from_row(&row)?)),
        None => Ok(None)
    }
}

pub async fn list_partners_by_status(
    conn: &mut PgConnection,
    status: PartnerStatus,
    limit: i64,
) -> Result<Vec<Partner>, PartnerError>
{
    let statement = format!(
        "SELECT {PARTNER_COLUMNS}
           FROM partners
          WHERE status = $1
          ORDER BY submitted_at DESC, id DESC
          LIMIT $2"
    );
    let rows = sqlx::query(&statement)
        .bind(status)
        .bind(limit)
        .fetch_all(conn)
        .await?;
    let mut partners = Vec::with_capacity(rows.len());

    for row in &rows {
        partners.push(partner_from_row(row)?);
    }
    Ok(partners)
}

pub async fn set_status(
    tx: &mut PgTransaction<'_>,
    partner: PartnerId,
    status: PartnerStatus,
    reviewed_by: UserId,
    reviewed_at: DateTime<Utc>,
    reason: Option<&str>,
) -> Result<Partner, PartnerError>
{
    let statement = format!(
        "UPDATE partners
            SET status = $2, reviewed_by = $3, reviewed_at = $4, review_reason = $5
          WHERE id = $1
          RETURNING {PARTNER_COLUMNS}"
    );
    let row = sqlx::query(&statement)
        .bind(partner)
        .bind(status)
        .bind(reviewed_by)
        .bind(reviewed_at)
        .bind(reason)
        .fetch_optional(&mut **tx)
        .await?;

    match row {
        Some(row) => Ok(partner_from_row(&row)?),
        None => Err(PartnerError::NotFound)
    }
}
