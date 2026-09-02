// Implement end_employment(tx, clock, config, link_id): close the link, then the account, then post a
// closure_forfeit operation to CLOSURE_FORFEIT if a residual balance remains, honouring closure_grace.
// Close, never delete (R6). Priority: P2
