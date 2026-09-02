// Define trait Role, the Employee/Partner/Admin marker types, and AuthUser<R>(AuthenticatedUser) implementing
// FromRequestParts: read the session cookie, validate the session, compare the role, reject with 401 or 403.
// This is the piece that makes RBAC compile-time checked (R5). Priority: P0
