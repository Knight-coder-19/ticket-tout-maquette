// One test per invariant I1 to I9, against a real PostgreSQL since part of the logic lives in the database.
// I8 asserts that a direct UPDATE on ledger_entries fails. Nothing else gets built until these pass.
// Priority: P0
