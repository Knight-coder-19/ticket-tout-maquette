use crate::ids::UserId;
use crate::PgTx;
use chrono::{DateTime, Utc};
use serde_json::Value;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum AuditError {
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

pub struct AuditEntry {
    pub actor_id: Option<UserId>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub payload: Value,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn log(tx: &mut PgTx<'_>, entry: AuditEntry) -> Result<(), AuditError> {
    sqlx::query(
        "INSERT INTO audit_log
             (actor_id, action, entity_type, entity_id, payload, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet, $7)",
    )
    .bind(entry.actor_id)
    .bind(&entry.action)
    .bind(&entry.entity_type)
    .bind(entry.entity_id)
    .bind(entry.payload.to_string())
    .bind(entry.ip_address.as_deref())
    .bind(entry.created_at)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
