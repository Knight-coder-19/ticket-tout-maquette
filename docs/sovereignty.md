# CartePro — Digital sovereignty note

> Status of the backend as of 3 September 2026, and the decisions still open.
> Companion to `docs/data-protection.md`, which covers personal data specifically.

This note answers four questions: where the data lives, who operates it, which third parties touch
it, and who holds the cryptographic keys. Everything in section 1 is a verified fact about the code
in this repository. Everything in section 3 is a decision nobody has taken yet.

---

## 1. What is true today, and how it was checked

### The backend makes no outbound network call

The workspace declares no HTTP client, no cloud SDK, no telemetry agent and no analytics library.
The only network peer the API process has is PostgreSQL.

```sh
grep -inE 'reqwest|hyper-tls|aws|google|azure|sentry|datadog' backend/Cargo.toml   # no match
```

This is worth stating plainly because it is the strongest sovereignty property a system can have:
there is no third party to trust, because there is no third party in the request path.

### The database is self-hosted

PostgreSQL 16, run by us, not a managed service. The schema, the roles and the privileges are
entirely described by `backend/migrations/`, so the whole data layer can be rebuilt from the
repository with two commands (`README.md` §3). No proprietary extension is used: `citext` and
`pgcrypto` ship with PostgreSQL.

### The keys are ours, and the algorithms are open

| Use | Algorithm | Where the key lives |
|---|---|---|
| Payment token signature | Ed25519 | `TOKEN_SIGNING_KEY` in `.env`, never committed |
| Offline verification by partners | Ed25519 public key | distributed to the partner application |
| Passwords | argon2id | no key; per-password salt |
| Session tokens | SHA-256 of a random token | no key; only the digest is stored |

No hardware security module, no foreign key-management service, no proprietary primitive. A partner
verifies a token offline with the public key alone, which is why the signature is asymmetric and
never an HMAC (`file-guide.md` §3.2).

### No personal data leaves the system

The transaction export (`GET /api/v1/admin/transactions.csv` and the seed's `transactions.csv`)
carries only identifiers, dates, integer amounts and a status word. Names, e-mail addresses and
addresses stay in the database. The partner-facing statement shows a customer as `"K. A."`,
initials computed in SQL; the full name never leaves PostgreSQL.

### For the demonstration, nothing leaves the machine

Docker and Caddy were cut from the sprint perimeter (`TASK-DISTRIBUTION-BACKEND.md` §1); the
demonstration runs `cargo run` against a local PostgreSQL. In that configuration the system is
sovereign by construction, because it is not connected to anything. This is a legitimate answer, on
condition that it is stated rather than left implicit.

---

## 2. What is not deployed, and therefore not yet decided

`backend/deploy/docker-compose.yml` and `backend/deploy/Caddyfile` are empty placeholders. There is
no hosting to declare because there is no hosting. Every question in section 3 becomes real on the
day that changes, and not before.

---

## 3. The open questions

### Q1 — Which hosting provider, under which jurisdiction?

The database will hold names, e-mail addresses, employer, and a purchase history that can reveal
habits. Hosting must be in the European Union, and the operator must not be subject to extraterritorial
disclosure law.

**Not decided.** The options usually retained for a public-sector project are a SecNumCloud-qualified
provider, a state-operated cloud, or on-premise hosting by the ministry's own teams. The choice
belongs to the sponsor, not to us.

### Q2 — Container images: Docker Hub, or an internal mirror?

The moment `deploy/` is filled in, the deployment will pull `postgres:16` and
`debian:bookworm-slim` from Docker Hub, a registry operated in the United States. The images
themselves are free software; what is not sovereign is the distribution channel and its availability.

**Recommendation:** mirror both images into an internal registry and pin them by digest rather than
by tag. It costs one afternoon and it also removes a build-time dependency on a third party being up.

### Q3 — TLS certificates: Let's Encrypt, or a European authority?

Caddy obtains certificates automatically from Let's Encrypt, operated by ISRG, a United States
non-profit. This is a widely accepted practice and involves no transfer of personal data — the
authority sees only the domain name.

**Recommendation:** accept it and write it down, or switch to a European authority if the sponsor
requires it. This is a documentation decision far more than a technical one.

### Q4 — Where are backups stored, and for how long?

Nothing is defined. A backup of this database is a copy of everything `data-protection.md`
describes, so it inherits the same jurisdiction requirement, the same retention duration and the
same encryption obligations.

**Not decided**, and it is the question most often forgotten until the first incident.

### Q5 — Who holds the signing key in production?

Today the key is generated by hand and lives in a `.env` file. That is acceptable for a
demonstration and not for production: whoever reads that file can mint payment tokens for any
amount.

**Recommendation:** a secret manager operated under the same jurisdiction as the hosting, with a
documented rotation procedure. Note that rotating the signing key invalidates the public key
embedded in the partner applications, so rotation is a coordinated operation, not a routine one.

---

## 4. What would break sovereignty, and must be refused

This is the watchlist. Any of these would silently move data or control outside our reach:

- adding an HTTP client to `crates/api` in order to call an external service in a request path;
- a managed database, a managed queue, or a managed cache;
- an error-reporting or APM agent — these ship payload extracts, which here means amounts and
  identifiers;
- a CDN in front of the API, which terminates TLS and therefore reads everything;
- an e-mail or SMS provider, on the day notifications appear;
- a map or geocoding service, on the day `partners.latitude` and `partners.longitude` stop being
  dormant;
- a font or script loaded from a third-party domain by the front end, which leaks the visitor's IP
  address on every page.

The last one is not backend work, but it is the most common way a sovereign back end ends up behind
a non-sovereign front end.

---

## 5. Re-checking these claims

The facts in section 1 are verifiable in under a minute, and should be re-verified whenever a
dependency is added:

```sh
grep -inE 'reqwest|hyper-tls|aws|google|azure|sentry|datadog' backend/Cargo.toml
grep -rn 'https://' backend/crates --include='*.rs'
```

Both must come back empty, save for documentation links.
