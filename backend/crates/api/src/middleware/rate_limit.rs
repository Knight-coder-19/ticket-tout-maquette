// Apply differentiated limits: /auth/login per IP and per email, /partner/payments per partner (short_code
// entry above all), /integration per api_client, and /public per IP more strictly than the rest (A3).
// Read X-Forwarded-For only when the connection comes from TRUSTED_PROXY. Priority: P1
