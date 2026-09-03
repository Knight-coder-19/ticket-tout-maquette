use axum::extract::{FromRequestParts, Query};
use axum::http::request::Parts;
use serde::Deserialize;

use crate::error::ApiError;

pub use crate::dto::Paginated;

pub const DEFAULT_LIMIT: u32 = 20;
pub const MAX_LIMIT: u32 = 100;

#[derive(Debug, Clone)]
pub struct Pagination {
    pub cursor: Option<String>,
    pub limit: u32,
}

#[derive(Debug, Deserialize)]
struct PaginationQuery {
    cursor: Option<String>,
    limit: Option<u32>,
}

fn capped_limit(limit: Option<u32>) -> u32
{
    let value = match limit {
        Some(value) => value,
        None => DEFAULT_LIMIT
    };

    match value {
        0 => DEFAULT_LIMIT,
        value if value > MAX_LIMIT => MAX_LIMIT,
        value => value
    }
}

fn clean_cursor(cursor: Option<String>) -> Option<String>
{
    let value = match cursor {
        Some(value) => value,
        None => return None
    };

    if value.trim().is_empty() {
        return None;
    }
    Some(value)
}

impl<S> FromRequestParts<S> for Pagination
where
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection>
    {
        let query = match Query::<PaginationQuery>::from_request_parts(parts, state).await {
            Ok(Query(query)) => query,
            Err(error) => {
                tracing::warn!(%error, "Unreadable pagination query, falling back to the defaults");
                PaginationQuery { cursor: None, limit: None }
            }
        };

        Ok(Pagination {
            cursor: clean_cursor(query.cursor),
            limit: capped_limit(query.limit)
        })
    }
}
