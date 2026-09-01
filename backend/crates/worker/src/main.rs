// Run three tokio intervals: token expiry every 60s, forfeiting the balances of accounts closed past the grace
// delay daily, and incremental hash-chain verification hourly. Log every run; this binary can die without
// interrupting payments. Priority: P2
