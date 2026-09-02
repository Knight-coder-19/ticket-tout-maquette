//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// config
//

use chrono::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CoreConfig {
    pub token_ttl: Duration,
    pub resync_max_age: Duration,
    pub closure_grace: Duration,
    pub public_cache: Duration,
}
