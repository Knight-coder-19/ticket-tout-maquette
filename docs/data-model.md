# CartePro — Data model

> Companion to `docs/data-dictionary.md` (the what) and `migrations/0001_schema.sql` (the how).
> This document says **why** the schema is what it is. The dictionary says what the front end sees
> of it, the migration says how PostgreSQL applies it.

The schema fits in thirteen enums and eighteen tables, in a single migration file. I kept it all in
one file because the dependency order reads from top to bottom there, and because a demo database
can be recreated with a single command. Migration `0002` brings only the city reference data, and
`0003` a unique index I should have put in place from the start.

**Three principles govern everything that follows.** Money moves only through double entry, and
therefore never through an isolated balance update. Nothing touching the journal is modified or
deleted, and it is the database itself that refuses it, not the application code. And any rule that
can be carried by a constraint is, because a constraint holds even when the code is wrong.

---

## The thirteen enums

I chose PostgreSQL `ENUM` types rather than `TEXT` columns with a `CHECK`. The gain is not storage,
it is that the set of values is **declared exactly once** and that `sqlx` can project it onto a Rust
enum through `#[sqlx(type_name = ...)]`. An unknown value then gets past neither the database nor
deserialisation. The cost is known and accepted: adding a value requires an `ALTER TYPE`, and
removing one is almost impossible. That is exactly the friction I want — a new enum value is a
breaking change for the front end, and the dictionary says so.

| Type | Values | Role |
|---|---|---|
| `user_role` | `employee`, `partner`, `admin` | The three roles. Access control reduces entirely to them. |
| `user_status` | `active`, `suspended`, `closed` | Lifecycle of a user account, and also of an employer and an API client. |
| `link_status` | `active`, `ended` | An employment link is current or finished. |
| `partner_status` | `pending`, `approved`, `rejected`, `suspended`, `closed` | A merchant's approval journey. Only `approved` receives money and appears in the catalogue. |
| `account_owner` | `employee`, `partner`, `system` | Who owns an account. `system` is the escape hatch from every balance constraint. |
| `account_status` | `active`, `suspended`, `closed` | Lifecycle of a monetary account, distinct from the user's. |
| `token_status` | `active`, `consumed`, `expired`, `cancelled` | The four possible ends of a payment token. Three out of four are final. |
| `operation_kind` | `topup`, `payment`, `compensation`, `closure_forfeit` | The nature of a journal operation. Each value has its detail table. |
| `entry_direction` | `debit`, `credit` | The direction of an entry. Two values, never three. |
| `entry_mode` | `qr_scan`, `short_code` | How the token was presented at the counter. Used for support and field statistics. |
| `batch_status` | `draft`, `validated`, `rejected` | The lifecycle of a top-up batch imported from a file. |
| `service_mode` | `physical`, `online`, `both` | Amendment A1. Decides whether an address is required. |
| `highlight_placement` | `minister_pick`, `public_featured` | Amendment A2. Two distinct shop windows, with their own positions. |

---

## The eighteen tables

### The people reference data

#### `cities`

`id`, `name`, `department`, with `uq_cities_name_department`.

A city is not identified by its name alone: several departments have towns with the same name. The
natural key is therefore the pair, and it is that pair the unique index protects. The table is
populated by migration `0002`, and nothing in the application writes to it.

#### `users`

`id`, `email` (`CITEXT`, unique), `password_hash`, `role`, `status`, `last_login_at`, `created_at`,
`updated_at`.

The address is `CITEXT` and not `TEXT`: nobody considers `Claire@…` and `claire@…` to be two
accounts, and settling case in the database rather than in the code guarantees that no write path
can create the duplicate. `password_hash` carries a full PHC string — the algorithm and its
parameters travel with the digest, which will allow the cost to be changed without a data migration.

The table carries **only** authentication. What the person is — an employee, a merchant — lives in
`employees` and `partners`. That is what allows a role to change without touching identity.

#### `employees` and `employers`

`employees`: `id`, `user_id` (unique), `last_name`, `first_name`, `phone`, `created_at`.
`employers`: `id`, `legal_name`, `ifu` (unique), `contact_email`, `contact_phone`, `status`,
`created_at`.

An employee is always backed by a user, never the other way round: the uniqueness of `user_id`
forbids two employee records for the same account. An employer, by contrast, has no user — it has no
session, it exists only as a payer and as an issuer of payroll references. Its `ifu` is unique but
nullable, because a public-sector employer may not have one.

#### `employment_links`

`id`, `employee_id`, `employer_id`, `employer_ref`, `account_id`, `status`, `started_at`,
`ended_at`, `created_at`.

This is the table that links an employee to an employer **and to an account**. Three rules are
carried by the schema here:

- `uq_active_employment` — an employee has only one `active` link. The index is partial, so the
  history of finished links stays intact.
- `uq_employer_ref` — a payroll reference is unique **per employer, among the active links**. Two
  employers can use the same reference without interfering, and a released reference can be
  reassigned.
- `ended_after_started` and `ended_link_has_date` — a finished link necessarily carries its end
  date, and that date does not precede the start.

The account is carried by the link and not by the employee, because it is the link that justifies
the existence of the money. The day the employee changes employer, the question of the residual
balance is raised explicitly instead of silently following along.

### Merchants

#### `partners`

`id`, `user_id` (unique), `account_id` (unique), `legal_name`, `trade_name`, `category`, `ifu`,
`service_mode`, `website_url`, `city_id`, `district`, `address_line`, `latitude`, `longitude`,
`status`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_reason`.

Two constraints deserve reading:

- `physical_needs_city` — a merchant who is not exclusively online must have a city. That is
  amendment A1: the catalogue filters by city, and a missing address would make the merchant
  invisible without anyone noticing.
- `reviewed_is_complete` — `reviewed_by` and `reviewed_at` are both null or both set. An approval
  without an approver, or without a date, is not an approval.

`idx_partners_catalog` is a partial index `WHERE status = 'approved'`: the public catalogue reads
only approved merchants, so the index covers only those.

Geographic coordinates exist as `NUMERIC(9,6)` but are not exposed. They lie dormant awaiting a map,
and the dictionary marks them as such.

#### `partner_highlights`

`id`, `partner_id`, `placement`, `position`, `created_by`, `created_at`, `removed_at`.

Amendment A2. A highlight is removed by setting `removed_at`, never by deleting the row: who put a
merchant in the shop window, and when, is audit information. The two partial indexes
`uq_active_highlight_partner` and `uq_active_highlight_position` — both `WHERE removed_at IS NULL` —
guarantee that a merchant occupies only one slot per window and that a position is held by only one
merchant. A released slot becomes available immediately.

### The money

#### `accounts`

`id`, `owner_type`, `owner_id`, `system_code` (unique), `payment_handle` (unique),
`balance_settled`, `balance_held`, `status`, `version`, `opened_at`, `closed_at`.

It is the most constrained table in the schema, and that is deliberate.

- `settled_never_negative` and `held_within_settled` are **exempted for `owner_type = 'system'`**.
  That is the amendment from milestone 1.0.0: under double entry, the sum of all balances is
  identically zero, so the issuance counterparty `MINISTRY_ISSUANCE` is necessarily negative. Its
  balance measures the total issued. Without that exemption, no top-up was possible.
- `held_never_negative` applies to everyone: a negative reservation makes no sense.
- `system_account_shape` forbids the two hybrid forms — a system account with an owner, a user
  account with a system code.

`owner_id` carries **no** foreign key, because it designates sometimes an employee, sometimes a
merchant. It is the only place in the schema where I accept an unconstrained reference, and
`system_account_shape` limits the damage.

`balance_settled` and `balance_held` are **caches**. The truth is in `ledger_entries`, and invariant
I2 requires that they agree. I keep them because recomputing a balance on every page read would cost
an aggregation over the whole history.

`version` is an optimistic-locking counter, incremented on every movement. It is not yet used to
arbitrate a conflict — row locks handle that — but it makes a conflict detectable on the read side.

#### `ledger_operations`

`id`, `kind`, `amount`, `memo`, `created_by`, `occurred_at`, `recorded_at`.

An operation is the business fact: a top-up, a payment. It carries the amount, which is **strictly
positive** — direction is carried by the entries, never by the sign of the amount.

Two dates, and the distinction matters: `occurred_at` is the moment the thing happened in the world
— the instant of the scan at the counter, possibly offline — while `recorded_at` is the moment we
recorded it. On a system that accepts deferred resynchronisation, conflating them amounts to lying
about one of the two.

#### `ledger_entries`

`seq` (`BIGSERIAL`), `operation_id`, `account_id`, `direction`, `amount`, `recorded_at`,
`prev_hash`, `hash` (unique).

The heart of it. Every operation produces at least two entries, a debit and a credit of the same
amount, and invariant I1 checks it. Every entry carries the digest of the previous one, which makes
any rewriting of the past detectable: modifying a row forces you to recompute every following
digest, which the triggers and the privileges forbid.

`hash` is unique — two entries cannot carry the same digest, which would be the symptom of a
collision or a duplication. The two byte-length `CHECK` constraints guarantee that the column
contains a genuine SHA-256 and not a fragment.

The exact format of the serialisation before hashing is frozen, and it is described in
`decisions.md`. Any later modification would invalidate the chain already written.

`recorded_at` is written **explicitly** by the application and never left to `DEFAULT now()`: the
hashed value and the stored value must be the same, to the microsecond, otherwise `verify_chain`
declares the chain broken.

### Payments

#### `payment_tokens`

`jti` (primary key), `account_id`, `amount`, `short_code`, `status`, `issued_at`, `expires_at`,
`resolved_at`.

The `jti` is supplied by the application and not by the database: it goes into the signed payload of
the QR code, and it must be known before the insert.

`uq_active_short_code` is partial — a short code is unique only **among active tokens**. That is
what makes it possible to reuse the reduced alphabet indefinitely without ever accumulating
historical collisions. The consequence, an important one, is that the short-code lookup cannot
filter on status without breaking the idempotence of a replayed settlement.

`resolved_token_has_date`: as soon as a token leaves `active`, it carries the date on which it left.
`token_expires_after_issue` forbids a stillborn token.

#### `payments`

`operation_id` (primary key), `token_jti` (unique), `partner_id`, `from_account`, `entry_mode`,
`scanned_at`, `synced_at`.

The primary key **is** the journal operation's identifier: a payment does not exist without its
double entry, and the relationship is one-to-one by construction rather than by convention.

`token_jti` is **unique**, and that constraint alone carries invariant I6: a token cannot be settled
twice, even if two concurrent requests get past every application check. It is also what makes the
offline queue safe.

The table carries **no** amount. It lives in `ledger_operations`, because the journal has authority
over sums and a second copy would end up diverging.

### Top-ups

#### `topup_batches` and `topups`

`topup_batches`: `id`, `employer_id`, `file_name`, `file_hash`, `line_count`, `total_amount`,
`status`, `uploaded_by`, `uploaded_at`, `validated_at`.
`topups`: `operation_id` (primary key), `batch_id`, `employer_id`, `to_account`, `reference`.

`uq_batch_file` — the pair of employer and file fingerprint is unique. Re-importing the same
spreadsheet twice is the most commonplace mistake a payroll department makes, and it is the database
that refuses it.

As with payments, `topups.operation_id` is both the primary key and the reference to the operation.
`batch_id` is nullable, because a single top-up decided by an administrator belongs to no batch.

`reference` is the idempotency key of a single top-up. Migration `0003` adds `uq_topup_reference` on
`(employer_id, reference) WHERE reference IS NOT NULL`: until then, idempotence rested only on the
advisory lock taken by `topup`, and a direct `INSERT` would have bypassed it. The partial index
lets as many top-ups without a reference coexist as needed.

### Corrections

#### `compensations`

`operation_id` (primary key), `original_operation_id`, `reason`, `approved_by`.

Since the journal is append-only, a mistake is not corrected: it is compensated by a reversing
operation pointing at the original. `compensation_is_not_self` forbids the degenerate case of an
operation compensating itself. The table is designed and constrained; the logic is not implemented,
and that is an accepted cut.

### Operations

#### `sessions`

`id`, `user_id`, `token_hash` (unique), `ip_address`, `user_agent`, `created_at`, `last_seen_at`,
`expires_at`, `revoked_at`.

Only the session token's digest is stored, never the token: a database leak does not hand out the
means to log in. A session is revoked by setting `revoked_at`, it is not deleted — knowing that a
session was revoked, and when, is part of the audit trail. Both indexes are partial
`WHERE revoked_at IS NULL`, since only live sessions are queried.

#### `api_clients`

`id`, `employer_id`, `client_id` (unique), `secret_hash`, `label`, `status`, `last_used_at`,
`created_at`.

Machine access for the HR-system integration. The secret is hashed like a password. `employer_id` is
carried by the client itself: the employer of an integration request is derived from the secret
presented, never from a path parameter, otherwise any client could read any employer's balances.

#### `audit_log`

`id`, `actor_id`, `action`, `entity_type`, `entity_id`, `payload`, `ip_address`, `created_at`.

A journal of administrative acts, append-only like the ledger. `actor_id` is nullable to cover
actions by the system itself. `payload` is `JSONB` because the shape of what is recorded depends on
the action, and one table per kind of act would be unmanageable.

---

## Immutability, and who is allowed to write

Three tables are **append-only**: `ledger_operations`, `ledger_entries` and `audit_log`. The rule is
enforced at two levels, and that is deliberate.

**The triggers.** The `forbid_mutation()` function raises a `restrict_violation` exception on any
`UPDATE`, `DELETE` or `TRUNCATE`. It applies even to a superuser writing by hand in `psql`, and the
message names the table and the refused operation.

**The privileges.** The application role `cartepro_app` receives `SELECT, INSERT` on those three
tables and nothing else, and the explicit `REVOKE` statements finish saying so. On the other fifteen
tables it has `SELECT, INSERT, UPDATE`, never `DELETE`.

Two levels, because they fail differently: a missing privilege can be worked around by connecting
with another role, a trigger cannot. And a trigger can be disabled by the table's owner, a privilege
cannot. Together, they leave no easy path.

`GRANT USAGE, SELECT ON SEQUENCE ledger_entries_seq_seq` deserves a line of explanation: the
sequence is consumed by an explicit `nextval` **before** the insert, because the rank goes into the
digest and therefore cannot be learned after the fact. A rolled-back transaction still consumes its
rank, so the sequence of `seq` values may have gaps. This is not a problem: the continuity of the
chain is carried by the digests, never by the contiguity of the ranks.

**The two system accounts** are inserted by the migration itself: `MINISTRY_ISSUANCE`, the issuance
counterparty whose negative balance measures the total put into circulation, and `CLOSURE_FORFEIT`,
which will receive the balances of accounts closed past the grace delay.

---

## Invariants I1 to I9

These are the nine properties the system must hold at all times. They are the exit gate of milestone
H+6: `crates/tests/tests/invariants.rs` contains one test per invariant, and until they pass,
nothing else gets built.

I wrote them with a single question in mind: **if this one is false, is money lost, created, or
spent twice?** Rules that do not answer yes to that question are not invariants; they are listed
separately at the end of this section.

Each one is checkable against a real database, without going through the API.

---

### I1 — Double entry is balanced

For any ledger operation, the sum of the credit entries equals the sum of the debit entries, and
that sum equals `ledger_operations.amount`. No operation has fewer than two entries.

```sql
SELECT o.id
FROM ledger_operations o
JOIN ledger_entries e ON e.operation_id = o.id
GROUP BY o.id, o.amount
HAVING sum(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END) <> o.amount
    OR sum(CASE WHEN e.direction = 'debit'  THEN e.amount ELSE 0 END) <> o.amount
    OR count(*) < 2;
```

This query must always return zero rows. It is the invariant that guarantees money is neither born
nor lost: it is always taken from somewhere in order to be put somewhere else.

### I2 — An account's balance is the exact reflection of its entries

For any account, `balance_settled` equals the sum of its credits minus the sum of its debits. That
is what `ledger/balance.rs::recompute_balance` recomputes.

The stored balance is a cache: the ledger is the truth. If the two diverge, it is the balance that
is wrong, and the divergence means an entry was posted without updating the account, or the
opposite — and therefore that a transaction was not atomic.

### I3 — No user account has a negative balance

For any account whose `owner_type` is `employee` or `partner`: `balance_settled >= 0`,
`balance_held >= 0`, and `balance_held <= balance_settled`. **System accounts are exempt.**

The third condition is the one that protects the available balance: `available = settled - held`
must never go negative, otherwise an employee could generate two tokens each covering their entire
balance.

The exemption for system accounts is not a convenience relaxation, it is an arithmetic necessity.
Under balanced double entry, every credit has a twin debit of the same amount: the sum of all
balances is therefore identically zero. If every account had to be positive or zero, they would all
be zero and the system could hold no money at all. Checked against a real database after two
top-ups:

```
CLOSURE_FORFEIT    :     0
MINISTRY_ISSUANCE  : -8000
employee A         :  8000
employee B         :     0
─────────────────────────────
sum                :     0
```

Pre-crediting `MINISTRY_ISSUANCE` would solve nothing: to credit it through a ledger operation you
must debit something else by the same amount, which moves the negative balance without removing it.
Writing its balance directly in the seed would break I2 permanently.

The issuance account's negative balance is therefore not an overdraft: **it is the measure of the
total issued**. Nobody spends from that account — no payment token is attached to it and `authorize`
never looks at it. The safety property I3 really protects is that we never let anyone spend money
that does not exist, and that concerns only the accounts one can spend from.

> **Capping issuance**, if the need arises, is a business rule checked in `funding/topup.rs` before
> posting the operation — never a balance constraint, which would reintroduce the deadlock.

### I4 — Reservations match the active tokens

For any account, `balance_held` equals the sum of the `amount` values of the `payment_tokens` with
status `active` attached to that account. That is what `recompute_held` recomputes.

If `held` is too high, the employee can no longer spend money they own: a reservation was not
released on expiry or on cancellation. If `held` is too low, they can spend twice.

### I5 — The hash chain is continuous and verifiable

For any entry of rank `seq`, `prev_hash` is the `hash` of the entry of the immediately lower rank,
and `hash` is exactly the value `entry_hash(...)` recomputes from the row's fields. The very first
entry has `prev_hash = GENESIS_HASH`.

`verify_chain(conn, from_seq)` returns the first inconsistent `seq`. It is the invariant that makes
tampering detectable: modifying a past entry forces you to recompute every following hash, which the
privileges and the triggers of I8 forbid.

### I6 — A token is settled only once

`payments.token_jti` is unique. A token leaves the `active` state for exactly one terminal state —
`consumed`, `expired` or `cancelled` — and `resolved_at` is then set. A `consumed` token has exactly
one associated payment; a token in any other state has none.

This is the protection against double settlement, and it must hold even when two partners scan the
same QR code at the same instant: `settle`'s lock depends on it.

### I7 — An expired token is never settled

For any payment, the settlement instant retained by the server is earlier than the corresponding
token's `payment_tokens.expires_at`.

The expiry written into the QR code is indicative. The only one that counts is the one the server
checks against its own clock at settlement time (decision 2). This invariant is tested with
`FixedClock`: the clock is advanced beyond `expires_at` and the settlement must be refused.

### I8 — The ledger and the audit trail are append-only

`UPDATE`, `DELETE` and `TRUNCATE` on `ledger_entries`, `ledger_operations` and `audit_log` fail. The
protection has two layers: the privileges refuse the operation to the `cartepro_app` role, and the
`forbid_mutation()` function refuses it to the database owner, who bypasses privileges.

A mistake is never corrected by a modification: it is corrected by a compensation, a reversing
operation that leaves the trace of both (decision 4).

### I9 — No row is deleted, only marked

No row is removed from `employment_links`, `partner_highlights`, `sessions`, `accounts`, `partners`
or `users`. End of life goes through a dedicated column: `ended_at`, `removed_at`, `revoked_at`,
`closed_at`, or a change of `status`.

That is rule R6. It has a direct consequence on the indexes: uniqueness always applies to the active
rows through a partial index, never to the whole table, so that history stays intact without
blocking a recreation.

---

## What the schema already carries, and which is not among the nine

These rules are real and tested, but they concern reference-data consistency, not monetary safety.
They do not stop the project if they break, and the database refuses them by itself.

| Rule | Carried by |
|---|---|
| An employee has only one active link | `uq_active_employment` |
| A payroll reference is unique per employer, among active links | `uq_employer_ref` |
| An active `short_code` is unique | `uq_active_short_code` |
| A partner occupies only one slot per highlight placement | `uq_active_highlight_partner` |
| A highlight position is occupied by only one partner | `uq_active_highlight_position` |
| A partner that is not exclusively online has a city | `physical_needs_city` |
| The same file is imported only once per employer | `uq_batch_file` |
| Digests are 32 bytes long | `hash_is_32_bytes`, `prev_hash_is_32_bytes`, `batch_file_hash_is_32_bytes` |
| A system account has a code and no owner, and vice versa | `system_account_shape` |
| Operation, entry and token amounts are strictly positive | three `CHECK` constraints |
