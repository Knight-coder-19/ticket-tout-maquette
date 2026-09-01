// Define TokenPayload { jti, amt, exp, iss } plus sign(&TokenPayload, &SigningKey) and
// verify(&str, &VerifyingKey) over Ed25519, never HMAC (checklist §14): the partner verifies offline with
// the public key. Canonical deterministic encoding, wire format CP1.<b64url payload>.<b64url sig>. Prio: P0
