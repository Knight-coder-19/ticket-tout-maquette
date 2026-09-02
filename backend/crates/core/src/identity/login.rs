// Implement login(tx, clock, email, password, ip, ua) -> SessionToken. Always run the password verification,
// even on an unknown email, so response time never reveals which accounts exist. Refuse any status other than active.
// Priority: P0
