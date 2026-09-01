// Implement authorize(tx, clock, config, account_id, amount): lock the account, check status and available
// balance, place_hold, generate jti and short_code, insert the token, sign it, return IssuedToken with its
// qr_payload. The future spending cap of decision 8 plugs in here. Priority: P0
