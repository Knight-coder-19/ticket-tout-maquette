// Init tracing (JSON in production), read the environment, build AppState and the PgPool, mount the router,
// listen on BIND_ADDR and shut down gracefully on SIGTERM. Never run the migrations in production.
// Priority: P0
