# CartePro backend — running it

Every command below is run from `backend/`.

---

## 1. Prerequisites

| Tool | Check |
|---|---|
| Rust stable | `rustc --version` (pinned by `rust-toolchain.toml`) |
| PostgreSQL 16 | `pg_isready` |
| `sqlx-cli` | `sqlx --version`, otherwise `cargo install sqlx-cli --no-default-features --features rustls,postgres` |

---

## 2. Environment

Copy the example and fill in the two keys:

```sh
cp .env.example .env
chmod 600 .env
```

`.env` is never committed — `.gitignore` already covers it.

### The two database URLs, and why there are two

| Variable | Role | Used by |
|---|---|---|
| `DATABASE_URL` | `cartepro_app` | the API and the seed |
| `MIGRATION_DATABASE_URL` | `cartepro_owner` | `sqlx migrate run` only |

`cartepro_app` has no `UPDATE` or `DELETE` on `ledger_operations`, `ledger_entries`, `audit_log` and
`payment_attempts`. That is deliberate: running the application and the seed under that role means
the append-only rule is enforced by PostgreSQL, not merely respected by the code. The migrations
need a role that can create and revoke, hence the second URL.

### Generating the signing keys

`TOKEN_SIGNING_KEY` and `TOKEN_PUBLIC_KEY` are a raw Ed25519 pair, base64, 32 bytes each:

```sh
openssl genpkey -algorithm ed25519 -out /tmp/ed.pem
openssl pkey -in /tmp/ed.pem -outform DER | tail -c 32 | base64 -w0   # TOKEN_SIGNING_KEY
openssl pkey -in /tmp/ed.pem -pubout -outform DER | tail -c 32 | base64 -w0   # TOKEN_PUBLIC_KEY
rm /tmp/ed.pem
```

The private key is the most sensitive value in the system. Never commit it, never log it.

---

## 3. Database

### First time, or full reset

The seed is only reproducible on an empty database, so a reset is the normal starting point:

```sh
dropdb   --if-exists -U cartepro_owner -h localhost cartepro
createdb -U cartepro_owner -h localhost -O cartepro_owner cartepro
DATABASE_URL="$MIGRATION_DATABASE_URL" sqlx migrate run
```

Migration `0002` loads about 35 000 French communes; it takes a few seconds.

### Checking the state

```sh
DATABASE_URL="$MIGRATION_DATABASE_URL" sqlx migrate info
```

Every line must read `installed`. A line still reading `pending` means the schema and the tracking
table disagree — see the note below.

### The migrations

| File | Contents |
|---|---|
| `0001_schema.sql` | 13 enums, 18 tables, constraints, partial unique indexes, immutability triggers, `cartepro_app` role and its grants, the two system accounts |
| `0002_cities.sql` | the city reference data |
| `0003_topup_reference.sql` | `uq_topup_reference`, the idempotency key of a single top-up |
| `0004_payment_attempts.sql` | `payment_attempts`, the append-only table of settlement attempts, including refusals |
| `0005_append_only_corrections.sql` | `compensations.created_at`, and the append-only triggers and revokes that table was missing |

> **If the schema was applied by hand** (with `psql < 0001_schema.sql` rather than through
> `sqlx migrate run`), the `_sqlx_migrations` table does not exist and `sqlx migrate info` reports
> everything as pending. `sqlx migrate run` will then fail on `0001`, because the types already
> exist. The fix is the full reset above.

---

## 4. Tests

```sh
DATABASE_URL="$MIGRATION_DATABASE_URL" cargo test --workspace
```

> **The override is required.** `#[sqlx::test]` creates one throwaway database per test, runs the
> migrations in it and drops it afterwards. That needs a role allowed to create databases, which
> `cartepro_app` deliberately is not. The tests never touch the `cartepro` database itself.

To run a single suite:

```sh
DATABASE_URL="$MIGRATION_DATABASE_URL" cargo test -p cartepro-tests --test invariants
```

| Suite | What it proves |
|---|---|
| `invariants` | the nine invariants I1 to I9, against a real PostgreSQL |
| `payments_flow` | the `authorize` → `settle` path, nominal and degraded cases |
| `degraded_mode` | the offline queue replayed as a batch |
| `funding_topup` | top-ups, idempotence and the refused cases |
| `csv_export` | the exact bytes of the transaction export |

The unit tests of `crates/core/tests/` need no database.

---

## 5. Running the API

```sh
cargo run -p cartepro-api
```

Listens on `BIND_ADDR`. Health check:

```sh
curl -s http://127.0.0.1:8080/health
```

Migrations are never run automatically at startup.

---

## 6. Seed

```sh
make seed
```

Wipes nothing: it expects an empty database, obtained with the reset in section 3. Two runs on an
empty database produce the same identifiers, the same amounts and the same dates — the random seed
is fixed and every date is anchored on a reference date, never on `now()`.

The seed writes `transactions.csv` next to itself, read back from the database rather than from
memory, so the file is a projection of what was actually stored. The same bytes are served by
`GET /api/v1/admin/transactions.csv`, which uses the same writer.

---

## 7. Troubleshooting

| Symptom | Cause |
|---|---|
| `role "cartepro_app" does not exist` | `0001` has not run; do the reset in section 3 |
| `permission denied for table ledger_entries` | you are writing to the ledger with `cartepro_app` outside `post_operation`; that is the point |
| `type "user_role" already exists` on `migrate run` | schema applied by hand, tracking table missing; reset |
| `database "..." already exists` during tests | a previous run was interrupted; the `_sqlx_test_*` databases can be dropped by hand |
| every authenticated request answers `401` | `identity::create_session` and the session lookup must hash the token the same way — see decision 31 |
