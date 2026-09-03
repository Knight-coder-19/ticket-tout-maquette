//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// api_client
//

use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use cartepro_core::crypto::password::{dummy_hash, verify_password};
use cartepro_core::error::CoreError;
use cartepro_core::ids::EmployerId;

use crate::error::ApiError;
use crate::state::AppState;

const FORWARDED_PROTO: &str = "x-forwarded-proto";
const BASIC: &str = "Basic";

#[derive(Debug, Clone)]
pub struct ApiClientAuth {
    pub client_id: String,
    pub employer_id: EmployerId,
}

fn uses_https(parts: &Parts) -> bool
{
    match parts.headers.get(FORWARDED_PROTO) {
        Some(value) => value.as_bytes().eq_ignore_ascii_case(b"https"),
        None => parts.uri.scheme_str() == Some("https")
    }
}

fn basic_credentials(parts: &Parts) -> Option<(String, String)>
{
    let header = parts.headers.get(AUTHORIZATION)?.to_str().ok()?;
    let (scheme, encoded) = header.split_once(' ')?;

    if !scheme.eq_ignore_ascii_case(BASIC) {
        return None;
    }

    let decoded = STANDARD.decode(encoded.trim()).ok()?;
    let text = String::from_utf8(decoded).ok()?;
    let (client_id, secret) = text.split_once(':')?;

    if client_id.is_empty() || secret.is_empty() {
        return None;
    }
    Some((client_id.to_string(), secret.to_string()))
}

async fn find_active_client(
    state: &AppState,
    client_id: &str,
) -> Result<Option<(EmployerId, String)>, sqlx::Error>
{
    sqlx::query_as::<_, (EmployerId, String)>(
        "SELECT employer_id, secret_hash FROM api_clients \
         WHERE client_id = $1 AND status = 'active'",
    )
    .bind(client_id)
    .fetch_optional(&state.db)
    .await
}

impl FromRequestParts<AppState> for ApiClientAuth {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection>
    {
        if !uses_https(parts) {
            return Err(ApiError::from(CoreError::Forbidden));
        }

        let (client_id, secret) = match basic_credentials(parts) {
            Some(credentials) => credentials,
            None => return Err(ApiError::from(CoreError::Unauthorized))
        };

        let found = match find_active_client(state, &client_id).await {
            Ok(found) => found,
            Err(error) => return Err(ApiError::from(CoreError::Db(error)))
        };

        let (employer_id, secret_hash) = match found {
            Some(row) => row,
            None => {
                let _ = verify_password(&secret, dummy_hash());
                return Err(ApiError::from(CoreError::Unauthorized));
            }
        };

        let result = verify_password(&secret, &secret_hash);
        match result {
            Ok(true) => Ok(ApiClientAuth { client_id, employer_id }),
            Ok(false) => Err(ApiError::from(CoreError::Unauthorized)),
            Err(error) => {
                tracing::error!(%error, "api client secret hash is malformed");
                Err(ApiError::from(CoreError::Internal))
            }
        }
    }
}
