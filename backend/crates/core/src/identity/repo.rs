use super::session::Session;
use super::{UserRole, UserStatus};
use crate::ids::UserId;
use crate::PgTx;
use chrono::{DateTime, Utc};
use sqlx::PgConnection;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserRow {
    pub id: UserId,
    pub email: String,
    pub password_hash: String,
    pub role: UserRole,
    pub status: UserStatus,
    pub last_login_at: Option<DateTime<Utc>>,
}

const USER_COLUMNS: &str = "id, email::text AS email, password_hash, role, status, last_login_at";
const SESSION_COLUMNS: &str = "user_id, created_at, last_seen_at, expires_at, revoked_at";

pub async fn find_user_by_email(
    conn: &mut PgConnection,
    email: &str,
) -> Result<Option<UserRow>, sqlx::Error> {
    let statement = format!("SELECT {USER_COLUMNS} FROM users WHERE email = $1");
    sqlx::query_as::<_, UserRow>(&statement)
        .bind(email)
        .fetch_optional(conn)
        .await
}

pub async fn find_user_by_id(
    conn: &mut PgConnection,
    id: UserId,
) -> Result<Option<UserRow>, sqlx::Error> {
    let statement = format!("SELECT {USER_COLUMNS} FROM users WHERE id = $1");
    sqlx::query_as::<_, UserRow>(&statement)
        .bind(id)
        .fetch_optional(conn)
        .await
}

pub async fn touch_last_login(
    tx: &mut PgTx<'_>,
    id: UserId,
    at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE users SET last_login_at = $2, updated_at = $2 WHERE id = $1")
        .bind(id)
        .bind(at)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn insert_session(
    tx: &mut PgTx<'_>,
    user_id: UserId,
    token_hash: &[u8],
    ip: Option<&str>,
    user_agent: Option<&str>,
    created_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO sessions
             (user_id, token_hash, ip_address, user_agent, created_at, last_seen_at, expires_at)
         VALUES ($1, $2, $3::inet, $4, $5, $5, $6)",
    )
    .bind(user_id)
    .bind(token_hash)
    .bind(ip)
    .bind(user_agent)
    .bind(created_at)
    .bind(expires_at)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn find_session_by_hash(
    conn: &mut PgConnection,
    token_hash: &[u8],
) -> Result<Option<Session>, sqlx::Error> {
    let statement = format!("SELECT {SESSION_COLUMNS} FROM sessions WHERE token_hash = $1");
    sqlx::query_as::<_, Session>(&statement)
        .bind(token_hash)
        .fetch_optional(conn)
        .await
}

pub async fn touch_session_seen(
    conn: &mut PgConnection,
    token_hash: &[u8],
    at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE sessions SET last_seen_at = $2 WHERE token_hash = $1")
        .bind(token_hash)
        .bind(at)
        .execute(conn)
        .await?;
    Ok(())
}

pub async fn revoke_session_by_hash(
    tx: &mut PgTx<'_>,
    token_hash: &[u8],
    at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL")
        .bind(token_hash)
        .bind(at)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn revoke_all_sessions_for_user(
    tx: &mut PgTx<'_>,
    user_id: UserId,
    at: DateTime<Utc>,
) -> Result<u64, sqlx::Error> {
    let result =
        sqlx::query("UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL")
            .bind(user_id)
            .bind(at)
            .execute(&mut **tx)
            .await?;
    Ok(result.rows_affected())
}
