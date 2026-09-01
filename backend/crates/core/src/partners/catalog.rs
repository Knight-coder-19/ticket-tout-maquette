// Implement search(conn, city, service_mode, query, cursor, limit) filtering status = 'approved'.
// Keyset pagination on (trade_name, id), never OFFSET. A1: service_mode is an optional filter and an
// online partner comes back whatever the city filter says. Priority: P1
