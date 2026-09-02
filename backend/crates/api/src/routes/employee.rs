// Wire GET /me/balance, GET /me/transactions, GET /me/minister-picks, POST /me/payment-tokens and
// DELETE /me/payment-tokens/{jti}. A handler only opens the transaction, calls core, commits and
// serializes (R4). Priority: P0
