// Set HSTS, nosniff, X-Frame-Options: DENY, Referrer-Policy and CSP on every response, and reject any
// request whose X-Forwarded-Proto is not https outside development. CORS is strict: one origin with
// credentials for the authenticated surfaces, a separate policy without credentials for /public. Prio: P1
