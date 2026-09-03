use super::{repo, Partner, PartnerCard, PartnerError, PartnerStatus};
use crate::audit::{self, AuditEntry};
use crate::clock::Clock;
use crate::ids::{HighlightId, PartnerId, UserId};
use crate::PgTx;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, PgPool, Row};

const REORDER_SHIFT: i32 = 1_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "highlight_placement", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum HighlightPlacement {
    MinisterPick,
    PublicFeatured,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Highlight {
    pub id: HighlightId,
    pub partner_id: PartnerId,
    pub placement: HighlightPlacement,
    pub position: i32,
    pub created_by: UserId,
    pub created_at: DateTime<Utc>,
    pub removed_at: Option<DateTime<Utc>>,
}

const HIGHLIGHT_COLUMNS: &str =
    "id, partner_id, placement, position, created_by, created_at, removed_at";

#[derive(Debug, Clone)]
pub struct HighlightWithPartner {
    pub highlight: Highlight,
    pub partner: Partner,
}

#[derive(Debug, Clone)]
pub struct MinisterPick {
    pub partner: PartnerCard,
    pub position: i32,
}

async fn cards_for_placement(
    pool: &PgPool,
    placement: HighlightPlacement,
) -> Result<Vec<MinisterPick>, PartnerError> {
    let statement = format!(
        "SELECT {}, h.position
           FROM partner_highlights h
           JOIN partners p ON p.id = h.partner_id
           LEFT JOIN cities c ON c.id = p.city_id
          WHERE h.placement = $1 AND h.removed_at IS NULL AND p.status = 'approved'
          ORDER BY h.position",
        repo::CARD_COLUMNS
    );
    let rows = sqlx::query(&statement).bind(placement).fetch_all(pool).await?;

    let mut cards = Vec::with_capacity(rows.len());
    for row in &rows {
        cards.push(MinisterPick {
            partner: repo::card_from_row(row)?,
            position: row.try_get("position")?,
        });
    }
    Ok(cards)
}

pub async fn minister_picks(pool: &PgPool) -> Result<Vec<MinisterPick>, PartnerError> {
    cards_for_placement(pool, HighlightPlacement::MinisterPick).await
}

pub async fn public_featured(pool: &PgPool) -> Result<Vec<MinisterPick>, PartnerError> {
    cards_for_placement(pool, HighlightPlacement::PublicFeatured).await
}

pub async fn add(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    partner: PartnerId,
    placement: HighlightPlacement,
    position: Option<i32>,
) -> Result<Highlight, PartnerError> {
    let now = clock.now();

    let target = repo::find_partner(tx, partner).await?.ok_or(PartnerError::NotFound)?;
    if target.status != PartnerStatus::Approved {
        return Err(PartnerError::HighlightNotEligible);
    }

    let position = match position {
        Some(position) => position,
        None => {
            sqlx::query_scalar::<_, i32>(
                "SELECT (COALESCE(MAX(position), 0) + 1)::INT FROM partner_highlights
                 WHERE placement = $1 AND removed_at IS NULL",
            )
            .bind(placement)
            .fetch_one(&mut **tx)
            .await?
        }
    };

    let statement = format!(
        "INSERT INTO partner_highlights (partner_id, placement, position, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING {HIGHLIGHT_COLUMNS}"
    );
    let highlight = match sqlx::query_as::<_, Highlight>(&statement)
        .bind(partner)
        .bind(placement)
        .bind(position)
        .bind(admin)
        .bind(now)
        .fetch_one(&mut **tx)
        .await
    {
        Ok(highlight) => highlight,
        Err(sqlx::Error::Database(db)) if db.is_unique_violation() => {
            return Err(PartnerError::HighlightDuplicate)
        }
        Err(error) => return Err(error.into()),
    };

    audit::log(
        tx,
        AuditEntry {
            actor_id: Some(admin),
            action: "highlight.add".to_string(),
            entity_type: "partner_highlight".to_string(),
            entity_id: Some(highlight.id.as_uuid()),
            payload: serde_json::json!({
                "partner_id": partner.as_uuid(),
                "position": position,
            }),
            ip_address: None,
            created_at: now,
        },
    )
    .await?;

    Ok(highlight)
}

pub async fn remove(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    id: HighlightId,
) -> Result<(), PartnerError> {
    let now = clock.now();

    let removed = sqlx::query(
        "UPDATE partner_highlights SET removed_at = $2 WHERE id = $1 AND removed_at IS NULL",
    )
    .bind(id)
    .bind(now)
    .execute(&mut **tx)
    .await?;

    if removed.rows_affected() > 0 {
        audit::log(
            tx,
            AuditEntry {
                actor_id: Some(admin),
                action: "highlight.remove".to_string(),
                entity_type: "partner_highlight".to_string(),
                entity_id: Some(id.as_uuid()),
                payload: serde_json::json!({}),
                ip_address: None,
                created_at: now,
            },
        )
        .await?;
    }
    Ok(())
}

pub async fn reorder(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    placement: HighlightPlacement,
    ordered: &[HighlightId],
) -> Result<(), PartnerError> {
    let now = clock.now();

    let current: Vec<HighlightId> = sqlx::query_scalar::<_, HighlightId>(
        "SELECT id FROM partner_highlights
         WHERE placement = $1 AND removed_at IS NULL
         ORDER BY position",
    )
    .bind(placement)
    .fetch_all(&mut **tx)
    .await?;

    if current.len() != ordered.len() || !current.iter().all(|id| ordered.contains(id)) {
        return Err(PartnerError::ReorderMismatch);
    }

    sqlx::query(
        "UPDATE partner_highlights SET position = position + $2
         WHERE placement = $1 AND removed_at IS NULL",
    )
    .bind(placement)
    .bind(REORDER_SHIFT)
    .execute(&mut **tx)
    .await?;

    for (index, id) in ordered.iter().enumerate() {
        sqlx::query("UPDATE partner_highlights SET position = $2 WHERE id = $1")
            .bind(id)
            .bind(index as i32 + 1)
            .execute(&mut **tx)
            .await?;
    }

    audit::log(
        tx,
        AuditEntry {
            actor_id: Some(admin),
            action: "highlight.reorder".to_string(),
            entity_type: "partner_highlight".to_string(),
            entity_id: None,
            payload: serde_json::json!({ "placement": format!("{placement:?}"), "count": ordered.len() }),
            ip_address: None,
            created_at: now,
        },
    )
    .await?;

    Ok(())
}

pub async fn list(
    conn: &mut PgConnection,
    placement: HighlightPlacement,
) -> Result<Vec<HighlightWithPartner>, PartnerError> {
    let statement = format!(
        "SELECT {HIGHLIGHT_COLUMNS} FROM partner_highlights
         WHERE placement = $1 AND removed_at IS NULL
         ORDER BY position"
    );
    let highlights = sqlx::query_as::<_, Highlight>(&statement)
        .bind(placement)
        .fetch_all(&mut *conn)
        .await?;

    let mut result = Vec::with_capacity(highlights.len());
    for highlight in highlights {
        if let Some(partner) = repo::find_partner(&mut *conn, highlight.partner_id).await? {
            if partner.status == PartnerStatus::Approved {
                result.push(HighlightWithPartner { highlight, partner });
            }
        }
    }
    Ok(result)
}
