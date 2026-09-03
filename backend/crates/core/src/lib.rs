// Declare and re-export the crate modules. Nothing else lives here: no type, no logic.
// Written at H+0 and never touched again — this is what avoids merge conflicts at 3am.
// Priority: P0

// ── Socle (Sèdjro: ids, money, clock, error) ───────────────────────────────
pub mod clock;
pub mod config;
pub mod error;
pub mod ids;
pub mod money;

// ── Cross-cutting bricks ───────────────────────────────────────────────────
pub mod audit;
pub mod crypto;

// ── Money path (Sèdjro) ────────────────────────────────────────────────────
pub mod ledger;
pub mod payments;

// ── Rest of the domain (Giscard) ───────────────────────────────────────────
pub mod corrections;
pub mod directory;
pub mod funding;
pub mod identity;
pub mod partners;
pub mod reporting;

/// Postgres transaction alias, so the shape is not repeated everywhere.
/// `ledger` exposes its own `PgTransaction` alias; both are the same type.
pub type PgTx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;
