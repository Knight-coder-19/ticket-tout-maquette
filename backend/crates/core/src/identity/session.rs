use super::{repo, AuthenticatedUser, IdentityError, SessionToken, UserStatus};
use crate::clock::Clock;
use crate::ids::UserId;
use crate::PgTx;
use base64::Engine;
use chrono::{DateTime, Duration, Utc};
use rand::RngCore;
use sha2::{Digest, Sha256};
use sqlx::PgConnection;

const SESSION_TTL_HOURS: i64 = 12;
const TOKEN_BYTES: usize = 32;
const HASH_DOMAIN: &[u8] = b"CARTEPRO/SESSION/V1";

/// A session as stored in the database. `token_hash` only, never the clear text.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Session {
    pub user_id: UserId,
    pub created_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

fn hash_token(raw: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(HASH_DOMAIN);
    hasher.update(raw.as_bytes());
    hasher.finalize().into()
}

/// Create a session: generate a random token, store its hash, `expires_at = now + session_ttl`.
/// Return the clear text, to be set in the cookie.
pub async fn create_session(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    user_id: UserId,
    ip: Option<&str>,
    user_agent: Option<&str>,
) -> Result<SessionToken, IdentityError> {
    let mut bytes = [0u8; TOKEN_BYTES];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    let raw = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);

    let now = clock.now();
    let expires_at = now + Duration::hours(SESSION_TTL_HOURS);

    repo::insert_session(
        tx,
        user_id,
        &hash_token(&raw),
        ip,
        user_agent,
        now,
        expires_at,
    )
    .await?;

    Ok(SessionToken(raw))
}

/// Validate a session cookie: hash the clear text, look up the row, check `expires_at` and `revoked_at`,
/// load the user and check `status == active`. Refreshes `last_seen_at`.
pub async fn validate_session(
    conn: &mut PgConnection,
    clock: &dyn Clock,
    raw_token: &str,
) -> Result<AuthenticatedUser, IdentityError> {
    let token_hash = hash_token(raw_token);
    let now = clock.now();

    let session = repo::find_session_by_hash(&mut *conn, &token_hash)
        .await?
        .ok_or(IdentityError::SessionInvalid)?;

    if session.revoked_at.is_some() || session.expires_at <= now {
        return Err(IdentityError::SessionInvalid);
    }

    let user = repo::find_user_by_id(&mut *conn, session.user_id)
        .await?
        .ok_or(IdentityError::SessionInvalid)?;

    if user.status != UserStatus::Active {
        return Err(IdentityError::AccountInactive);
    }

    repo::touch_session_seen(&mut *conn, &token_hash, now).await?;

    Ok(AuthenticatedUser {
        id: user.id,
        role: user.role,
        status: user.status,
    })
}

/// Revoke a single session (logout). Sets `revoked_at`, does not delete.
pub async fn revoke_session(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    raw_token: &str,
) -> Result<(), IdentityError> {
    repo::revoke_session_by_hash(tx, &hash_token(raw_token), clock.now()).await?;
    Ok(())
}

/// Revoke every session of a user. Called when an account is suspended or closed.
pub async fn revoke_all_for_user(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    user_id: UserId,
) -> Result<u64, IdentityError> {
    let revoked = repo::revoke_all_sessions_for_user(tx, user_id, clock.now()).await?;
    Ok(revoked)
}
