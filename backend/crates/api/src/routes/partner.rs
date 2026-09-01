// Wire GET /partner/summary, GET /partner/transactions, POST /partner/payments and POST /partner/payments/batch.
// The batch is the single exception: one transaction per row and a per-row status, so a failing row never
// brings the whole batch down. Priority: P0
