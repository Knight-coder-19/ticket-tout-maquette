use super::{repo, PartnerError, PartnerStatus};
use crate::audit::{self, AuditEntry};
use crate::clock::Clock;
use crate::ids::{PartnerId, UserId};
use crate::PgTx;

async fn record(
    tx: &mut PgTx<'_>,
    admin: UserId,
    partner_id: PartnerId,
    action: &str,
    reason: Option<&str>,
    at: chrono::DateTime<chrono::Utc>,
) -> Result<(), PartnerError> {
    audit::log(
        tx,
        AuditEntry {
            actor_id: Some(admin),
            action: action.to_string(),
            entity_type: "partner".to_string(),
            entity_id: Some(partner_id.as_uuid()),
            payload: match reason {
                Some(reason) => serde_json::json!({ "reason": reason }),
                None => serde_json::json!({}),
            },
            ip_address: None,
            created_at: at,
        },
    )
    .await?;
    Ok(())
}

pub async fn approve(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    partner_id: PartnerId,
) -> Result<(), PartnerError> {
    let now = clock.now();
    repo::set_status(tx, partner_id, PartnerStatus::Approved, admin, now, None).await?;
    record(tx, admin, partner_id, "partner.approve", None, now).await
}

pub async fn reject(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    partner_id: PartnerId,
    reason: &str,
) -> Result<(), PartnerError> {
    let now = clock.now();
    repo::set_status(tx, partner_id, PartnerStatus::Rejected, admin, now, Some(reason)).await?;
    record(tx, admin, partner_id, "partner.reject", Some(reason), now).await
}

pub async fn suspend(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    admin: UserId,
    partner_id: PartnerId,
    reason: &str,
) -> Result<(), PartnerError> {
    let now = clock.now();
    repo::set_status(tx, partner_id, PartnerStatus::Suspended, admin, now, Some(reason)).await?;
    repo::remove_highlights_for_partner(tx, partner_id, now).await?;
    record(tx, admin, partner_id, "partner.suspend", Some(reason), now).await
}
