//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// validated
//

use axum::{
    extract::{FromRequest, Request},
    Json,
};
use serde::de::DeserializeOwned;
use validator::Validate;
use cartepro_core::error::CoreError;
use crate::error::ApiError;

pub struct ValidatedJson<T: Validate>(pub T);

impl<S, T> FromRequest<S> for ValidatedJson<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state)
            .await
            .map_err(|err| {
                tracing::warn!(error = %err, "Failed to deserialize JSON payload");
                ApiError::from(CoreError::Unauthorized) 
            })?;

        value.validate()
            .map_err(|err| {
                tracing::warn!(error = %err, "JSON validation failed");
                ApiError::from(CoreError::Unauthorized)
            })?;
        Ok(ValidatedJson(value))
    }
}
