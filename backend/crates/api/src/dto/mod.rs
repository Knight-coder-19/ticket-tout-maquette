// Declare and re-export the DTO modules. Core types are never serialized directly:
// a DTO is an exposure decision, not a shortcut. Priority: P1

pub mod admin;
pub mod auth;
pub mod catalog;
pub mod employee;
pub mod integration;
pub mod partner;
pub mod public;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
}
