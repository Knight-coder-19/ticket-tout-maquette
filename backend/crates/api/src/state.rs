// Define AppState, cheap to clone thanks to the Arcs. It is the only shared context handed to the handlers.
// Priority: P0

use cartepro_core::clock::Clock;
use cartepro_core::config::CoreConfig;
use ed25519_dalek::{SigningKey, VerifyingKey};
use sqlx::PgPool;
use std::sync::Arc;

/// Runtime mode. `Development` disables the plain-traffic refusal and exposes `/docs`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Development,
    Production,
}

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub clock: Arc<dyn Clock>,
    pub signing_key: Arc<SigningKey>,
    pub verifying_key: Arc<VerifyingKey>,
    pub config: CoreConfig,
    pub env: Environment,
}
