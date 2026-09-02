// Cover the five scenarios of CLAUDE.md section 12: replay by the same partner, replay by another partner,
// a token expired against the server clock refused whatever scanned_at says, two concurrent authorize calls
// exceeding the balance where the second fails, and a partly invalid batch. Proves requirement 2.2. Prio: P0
