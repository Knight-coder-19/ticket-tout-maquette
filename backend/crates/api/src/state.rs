// Define AppState { db, clock, signing_key, config, env } deriving Clone, cheap to clone thanks to the Arcs.
// It is the only shared context handed to the handlers.
// Priority: P0
