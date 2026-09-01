// Assemble the five stacks of section 8: /public with public_rate_limit and cache_layer only, /me and
// /partner with session_auth, /admin with session_auth plus admin_audit, /integration with
// client_credentials_auth. Then the global middleware stack in the order of section 9. Priority: P0
