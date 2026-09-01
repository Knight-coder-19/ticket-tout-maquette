// Define ApiClientAuth { client_id, employer_id } read from the authorization header against the hashed secret.
// Refuse plain HTTP with no development exception, and derive employer_id here, never from the path.
// Priority: P2
