// Declare and re-export the crate modules (ledger, payments, identity, ...).
// Nothing else lives here: no type, no logic.
// Priority: P0

pub mod clock;
pub mod config;
pub mod error;
pub mod ids;
pub mod ledger;
pub mod money;
