// Implement lock_chain, lock_account, place_hold, release_hold, and post_operation, the single entry point
// writing the operation, its two chained entries and the balance caches. Only this module writes accounts,
// ledger_operations and ledger_entries (R2), and it takes a transaction, never a pool. Priority: P0
