// A2. Implement add, remove, reorder and list over the two placements minister_pick and public_featured.
// remove only fills removed_at, never deletes (R6); reorder must shift positions out of range first because
// of the partial unique index on (placement, position); list joins on status = 'approved'. Priority: P2

use super::{Partner, PartnerCard, PartnerError};
use crate::clock::Clock;
use crate::ids::{HighlightId, PartnerId, UserId};
use crate::PgTx;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, PgPool};

/// Postgres ENUM `highlight_placement` (A2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "highlight_placement", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum HighlightPlacement {
    MinisterPick,
    PublicFeatured,
}

/// An active highlight (or archived one if `removed_at` is set).
#[derive(Debug, Clone)]
pub struct Highlight {
    pub id: HighlightId,
    pub partner_id: PartnerId,
    pub placement: HighlightPlacement,
    pub position: i32,
    pub created_by: UserId,
    pub created_at: DateTime<Utc>,
    pub removed_at: Option<DateTime<Utc>>,
}

/// A highlight joined with its partner, for display (home page, minister picks).
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

pub async fn minister_picks(pool: &PgPool) -> Result<Vec<MinisterPick>, PartnerError> {
    todo!()
}

/// Add a highlight. `HighlightNotEligible` if the partner is not `approved`,
/// `HighlightDuplicate` if it already is at this placement. Writes `audit_log`.
/// `position = None` → append at the end of the list.
pub async fn add(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    partner: PartnerId,
    placement: HighlightPlacement,
    position: Option<i32>,
) -> Result<Highlight, PartnerError> {
    todo!()
}

/// Remove a highlight: set `removed_at`, never DELETE the row (R6). Writes `audit_log`.
pub async fn remove(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    id: HighlightId,
) -> Result<(), PartnerError> {
    todo!()
}

/// Reorder a whole placement. Receives the complete list of ids in the wanted order.
/// Gotcha: the partial unique index on `(placement, position)` forbids two rows at the same
/// position, even transiently — shift out of range first (negative), then reassign. Writes `audit_log`.
pub async fn reorder(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    placement: HighlightPlacement,
    ordered: &[HighlightId],
) -> Result<(), PartnerError> {
    todo!()
}

/// Read. The join filters `status = 'approved'`: a partner suspended after being highlighted
/// must no longer appear (the filter is in the query, not in the caller).
pub async fn list(
    conn: &mut PgConnection,
    placement: HighlightPlacement,
) -> Result<Vec<HighlightWithPartner>, PartnerError> {
    todo!()
}
