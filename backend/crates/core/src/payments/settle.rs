// Implement settle(tx, clock, config, partner, jti_or_code, scanned_at) in the imposed order: idempotence,
// locks, checks, write. Same partner replaying the same jti returns Ok(payment); another partner having
// consumed the token returns TokenAlreadyUsed. Priority: P0
