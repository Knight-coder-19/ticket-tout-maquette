---

## Amendment A5 — The currency becomes the euro, and money is represented as whole cents

### Context

The project was designed around the franc, and the CFA franc has no subdivision in practical use:
an amount was an integer, full stop. Moving to the euro changes that, because the euro has cents.
The question "how do we represent a sum of money" therefore reopens, and it cannot be settled after
the fact: the amount is hashed into the ledger's audit chain and stored in a column whose type
commits every migration that follows.

Two distinct questions hide behind that one, and I separated them: what the Rust type holds in
memory, and what travels on the wire between the front end and the API. Conflating them is
precisely what pushes people towards floating point.

### The options I weighed

**Floating point, `Money(f64)`.** That is the spontaneous answer when you think "the euro has
decimals, so I need decimals". I ruled it out for four reasons, the first of which is
disqualifying in the strict sense:

1. `f64` implements neither `Eq`, nor `Ord`, nor `Hash` in Rust. This is not a style convention, it
   is the compiler: `Money`'s derives would stop compiling, and I would lose total ordering and
   exact comparison.
2. `hash.rs` requires a canonical serialisation of the amount for the audit chain. A float has
   several binary representations for the same value; "canonical" means nothing there without
   inventing extra rules. And the document warns that any later change to that serialisation
   invalidates the chain already written.
3. `recompute_balance` sums thousands of entries and must land exactly on `balance_settled`, which
   the P0 invariant tests check. In floating point addition is not associative, and on the
   PostgreSQL side the aggregation order of `SUM()` is not guaranteed: two runs over the same rows
   can return two values. An invariant that tolerates a margin is no longer an invariant.
4. A fraction of a cent lost per operation on a payment system is not a display imprecision, it is
   a till that does not reconcile.

**Exact decimal, `rust_decimal::Decimal` over `NUMERIC(14,2)`.** Substantively correct, and
readable in the database. I ruled it out on cost, not on correctness: one more dependency, heavier
arithmetic on the ledger's hot path, and above all a renegotiation of the schema with the team when
`BIGINT` already answers the need.

**The integer in cents, `Money(i64)`.** Chosen. The type does not change, only the unit does:
`Money(45656)` is €456.56. Arithmetic stays exact and deterministic, hashing stays defined, the
column stays `BIGINT`, and nothing that had been decided for the ledger needs redoing.

### What I decided

**Internally, money is a whole number of euro cents.** `Money`'s field is private: nobody outside
`core/src/money.rs` can read or write the underlying integer. The representation is an
implementation detail, in the same way as how `String` arranges its bytes.

**On the wire, amounts travel as decimal euros.** The front end sends and receives `456.56`,
`3.99`, `25`. That is the format in which sums are entered by users, and I refuse to push onto the
front end a conversion it would perform in JavaScript, where floating point is the only numeric
type available and where the trap described below is exactly the same.

This amends the published contract: the data dictionary stipulated "integer, in the minor currency
unit, never a decimal". I own the change and I carry its consequences into the documents, but it
must be announced to the front-end team in person — a leftover `2500` written under the old
contract to mean €25.00 would now be read as €2,500.00, and that hundredfold error is silent.

**The conversion exists in exactly one place.** It is performed by `Money` itself, in its
deserialisation, its serialisation and its `Display`. No multiplication or division by one hundred
should appear anywhere else in the backend: if a `100` ever surfaces in `payments/`, `funding/` or
`dto/`, it is a defect, not an adaptation.

**I also decided that `checked_sub` refuses a negative result.** The signed integer would allow it,
but a negative `Money` built by bypassing `try_new` would silently violate the type's guarantee,
and `checked_sub` is the primitive on which fund holds and ledger debits rest.

### The technical consequence worth writing down

The spontaneous way to convert a decimal euro into cents, `(amount * 100.0) as i64`, truncates.
This is not a textbook case: I measured it over the range €0.01 to €20,000, and **131,252 amounts
out of 1,999,999, that is 6.6%, lose a cent**. `0.29 * 100.0` is `28.999999999999996` and yields 28
cents; `2.01 * 100.0` yields 200.

Replacing truncation with rounding fixes those cases but creates a worse one: `3.999 * 100.0`
rounded yields 400, and three decimals are silently accepted, €3.999 becoming €4.00. The float has
lost the information I need in order to validate.

The method I chose goes through text. `f64::to_string()` in Rust prints the shortest decimal string
that, read back, yields the same float: for the double nearest to 456.56, that is `"456.56"`. The
binary noise is eliminated once, at the boundary, and splitting on the decimal separator then gives
exact integers. Above all, the string preserves the number of decimals actually entered, which
makes it possible to **refuse** `3.999` instead of guessing what the user meant.

### Consequences on the code and the documents

- `core/src/money.rs`: `Money` in cents, private field, `Serialize`/`Deserialize` converting at the
  boundaries, `parse_euros(&str)` for the CSV import, `InvalidMoneyError` distinguishing a negative,
  malformed, over-precise or out-of-range amount.
- `funding/csv.rs` must call `parse_euros` on the `montant` column rather than parsing a number
  itself. It is the most exposed boundary: it is filled in by hand in a spreadsheet.
- `crates/api/src/extractors/` must provide a hand-written `Json` extractor, otherwise the rejection
  of an invalid amount comes out in serde's raw format instead of the `{ error, message,
  request_id }` envelope.
- `data-dictionary.md` §0, §1 and §4, `file-guide.md` §3.1 and §4.4, and
  `TASK-DISTRIBUTION-BACKEND.md` have been amended accordingly.
- Storage stays `BIGINT`, and the `currency` field of the payloads is now always `"EUR"`.

---

## Decision — The canonical serialisation of the entry hash

### Context

`ledger/hash.rs` computes the digest of each entry, and each entry carries the digest of the
previous one. It is that chaining which makes tampering detectable: rewriting a past row forces you
to recompute every digest that follows, which the immutability triggers and the privileges forbid.

The consequence is brutal and deserves to be written down in black and white: **the day I change
the way fields are concatenated before hashing, the entire chain already written becomes
unverifiable.** `verify_chain` would flag the very first entry as inconsistent, and I would have no
way to tell that format change apart from genuine tampering. This format is therefore not an
implementation detail, it is a piece of schema in the same way a column type is.

### The chosen format

SHA-256 over the concatenation, with no separator and no textual encoding, of the following fields
in this exact order:

| Rank | Field | Size | Encoding |
|---|---|---|---|
| 1 | domain label | 18 bytes | `CARTEPRO/LEDGER/V1` in ASCII |
| 2 | `seq` | 8 bytes | signed integer, big-endian |
| 3 | `operation_id` | 16 bytes | the raw bytes of the UUID |
| 4 | `account_id` | 16 bytes | the raw bytes of the UUID |
| 5 | `direction` | 1 byte | `0x00` for a debit, `0x01` for a credit |
| 6 | `amount` | 8 bytes | euro cents, signed integer, big-endian |
| 7 | `recorded_at` | 8 bytes | microseconds since the Unix epoch, big-endian |
| 8 | `prev_hash` | 32 bytes | the digest of the previous entry, or `GENESIS_HASH` |

Every field is fixed-length. That is the property which makes the concatenation unambiguous:
without it, two different sets of values could produce the same byte sequence, and the digest would
stop saying anything about the row.

### The three points that required a choice

**The domain label.** It protects nothing today, it prepares for tomorrow: if another SHA-256 digest
appears in the project — the fingerprint of an import file, a session token — the label guarantees
that no value hashed in one context can be presented as valid in the other. It carries a version
number, `V1`, so that the day the format really has to change, the break is explicit rather than
silent.

**Microseconds, not nanoseconds.** `DateTime<Utc>` in Rust carries the nanosecond, `TIMESTAMPTZ` in
PostgreSQL stops at the microsecond. Hashing the nanosecond would amount to hashing a value the
database truncates on storage: the digest recomputed after reading back would never land on the one
that is recorded, and `verify_chain` would declare the whole chain broken. So I hash the precision
that is actually stored.

**`recorded_at` is written explicitly, never left to `DEFAULT now()`.** Same reason: the hashed
value and the stored value must be the same. `post_operation` retrieves the `recorded_at` returned
by the operation insert and reuses it as-is for both entries, which thus share a single recording
instant.

### What follows for `seq`

`seq` goes into the digest even though the column is a `BIGSERIAL`. So we cannot insert first and
compute the digest afterwards: the update would be refused by the immutability trigger.
`post_operation` reserves the rank with an explicit `nextval` before hashing, then inserts the row
with that rank. That is what the schema's `GRANT USAGE, SELECT ON SEQUENCE ledger_entries_seq_seq`
already made possible.

A rolled-back transaction still consumes the reserved rank: the sequence of `seq` values may
therefore have gaps. This is not a problem, because the continuity of the chain is carried by the
digests and not by the contiguity of the ranks. `verify_chain` reads entries in `seq` order and
checks that each `prev_hash` is the digest of the previous row read, never assuming that ranks
follow on from one another.

---

## Departures from the build plan

`file-guide.md` and `TASK-DISTRIBUTION-BACKEND.md` were written before the first line of code. On
twenty points, what I wrote departs from them. I record them here because an unjustified departure
reads as carelessness, and because three of them correct an error in the documents themselves — a
reviewer following the plan to the letter would reintroduce the bug.

### 1. In `settle`, releasing the hold precedes the entry

**The plan** (`TASK-DISTRIBUTION-BACKEND.md` §4.1) posts the ledger operation, then releases the
hold:

```
post_operation(...)
release_hold(...)      // "the hold becomes real"
```

**What I did**: the opposite.

**Why**: the `held_within_settled` constraint is checked by PostgreSQL on *every statement*, not at
the end of the transaction. On an account at `settled = 100, held = 100` — the case of an employee
generating a token covering their whole balance — debiting before releasing transiently gives
`settled = 0, held = 100`, and the database refuses the `UPDATE`. In the plan's order, any
settlement covering the entire available balance fails.

This is the most important departure in the list: it does not show up on a €10 token drawn against
a €100 balance, only on a token that exhausts what is available.

### 2. `Account.balance_settled` is an `i64`, not a `Money`

**The plan** does not say so explicitly, but the use of `Money` everywhere else suggests it.

**What I did**: both of `Account`'s balances are signed integers of cents.

**Why**: `Money` refuses negatives by construction, and `MINISTRY_ISSUANCE` is negative by
construction too — that is amendment A5 and invariant I3. Carrying a system balance in a `Money`
would force us to build values that violate the type's invariant, that is, to lie to the compiler
to feel reassured. Operation amounts, on the other hand, really are `Money`: the schema guarantees
they are strictly positive.

`Account::available_cents()` and `Account::can_cover(Money)` encapsulate the only balance
arithmetic that is exposed, so that the bare integer does not circulate.

### 3. `recompute_balance` returns an `i64`

**The plan** (`file-guide.md` §3.3) announces `recompute_balance(conn, AccountId) -> Money`.

**What I did**: `-> Result<i64, sqlx::Error>`.

**Why**: same reason as point 2 — the function must be able to return the balance of the issuance
account, which is negative. `recompute_held`, on the other hand, does return a `Money`: a sum of
active tokens is always positive.

### 4. `verify_chain` returns a status, not a `Result<(), seq>`

**The plan** announces `verify_chain(conn, from_seq) -> Result<(), u64>`, where the error carries
the first inconsistent rank.

**What I did**: `-> Result<ChainStatus, sqlx::Error>` with `ChainStatus::{Intact, BrokenAt(i64)}`.

**Why**: the plan's signature leaves no room for a database failure. Yet "the chain is broken at
rank 412" and "the connection was cut" are two failures of opposite natures: the first is a security
alert that must reach a human, the second an operational error. Conflating them in a single `Err`
would force the caller to tell them apart by inspection.

### 5. Queries are checked at run time, not at compile time

**The plan** (`file-guide.md` §1) calls for `.sqlx/` generated by `cargo sqlx prepare --workspace`
and committed, "otherwise CI cannot compile without a database".

**What I did**: `sqlx::query_as` and `sqlx::query_scalar`, checked at run time. The `.sqlx/`
directory stays empty.

**Why**: compile-time-checked macros require a reachable database during the build, or a cache
regenerated after *every* query change. With two developers working in parallel, a forgotten cache
breaks the other's compilation with no intelligible message. The real cost is low: SQL typing errors
show up in the first integration test, and those tests run against a real PostgreSQL.

**Accepted consequence**: a typo in a column name does not show up at compile time. That is what
makes the integration tests non-negotiable.

### 6. `CoreError` gains an `Internal` variant

**The plan** lists the business errors and their HTTP mapping in `data-dictionary.md` §6.

**What I did**: added `CoreError::Internal`.

**Why**: `LedgerError` distinguishes two families. `InsufficientFunds` and `AccountInactive` are
business situations, which the user must understand. `SelfTransfer`, `NonPositiveAmount`,
`CorruptedHash` and `AccountNotFound` are programming errors: if they occur, the caller is at fault
and no message should leak to the client. Without a dedicated variant they would have had to be
filed under `Db(_)`, which would have blurred the only clear rule in that table — `Db(_)` becomes
500 and says nothing.

### 7. The signed payload carries integers, not domain types

**The plan** (`file-guide.md` §3.2) gives `TokenPayload { jti, amt, exp, iss }` without specifying
the types.

**What I did**: `amt: i64` in cents, `exp: i64` in Unix seconds.

**Why**: `Money` has a hand-written `Serialize` implementation that renders a float in decimal
euros, because that is what the front end expects. A float has no textual form guaranteed stable
across two versions of `serde_json`: a token signed today could stop verifying tomorrow. Same
reasoning for the date, whose textual serialisation admits several equivalent forms.

`TokenPayload::new` is the only conversion point, and `amount()` goes back through `Money::try_new`
on the way out — a valid signature proves the token comes from us, not that its value is sane.

### 8. `short_code` exposes four functions instead of one

**The plan** only asks for `generate_short_code(&mut impl Rng) -> String` and mentions the display
format `XXXX-XXXX`.

**What I did**: `generate`, `format_for_display`, `normalize` and `is_valid`.

**Why**: a short code exists in three forms — the one that is stored (`86RB57CT`), the one that is
displayed (`86RB-57CT`) and the one the merchant types (`86rb 57ct`, with or without a dash).
Without `normalize`, the lookup starts from the raw string, no row matches, and a perfectly valid
payment is refused as an unknown token. That is the bug that costs you a demo.

`is_valid` discards absurd input before touching the database, so that guessing codes does not
amount to running PostgreSQL for free. It validates the *stored* form: the call order is
`normalize`, then `is_valid`, then the lookup.

### 9. The short code is drawn after checking, not retried after failure

**What I had announced**: a retry loop on a uniqueness violation (`SQLSTATE 23505`), "five lines".

**What I did**: up to five draws, each preceded by an availability `SELECT`.

**Why I changed my mind**: it was wrong. A constraint violation aborts the entire PostgreSQL
transaction — every subsequent statement fails until the `ROLLBACK`. A retry would have required a
`SAVEPOINT` around each insert, that is, disproportionate machinery on the hot path for a collision
whose probability is on the order of 10⁻⁸ against 31⁸ combinations.

The residual race — two concurrent `authorize` calls drawing the same code between the `SELECT` and
the `INSERT` — is still caught by the unique index, and then surfaces as a 500. At that
probability, it is a trade-off I accept.

### 10. The short-code lookup ignores the token status

**What I did**: `WHERE short_code = $1 ORDER BY issued_at DESC LIMIT 1`, with no filter on status.

**Why**: the `uq_active_short_code` uniqueness index covers active tokens only. Filtering on
`status = 'active'` would therefore have broken idempotence: a merchant replaying a short-code
settlement after consumption would have found nothing and received `UnknownToken` instead of their
payment. And that is exactly what an offline queue does.

### 11. `settle` re-reads the payment when the token is already consumed

**The plan** (§4.1) puts the idempotence check first, before the locks, and then refuses any token
whose status is not `active`.

**What I did**: when the token is found `consumed` *after* the locks, `settle` re-reads the
associated payment and returns it if it belongs to the merchant making the request.

**Why**: the leading check runs before `lock_chain`. Two concurrent requests from the same merchant
can therefore both get past it, then serialise on the lock, and the second receives
`TokenAlreadyUsed` when it has just been settled. For a queue replaying until success, that is an
infinite loop.

**Known limitation**: this branch is only reachable under a genuine race. I can test the one that
refuses, not the one that returns the payment; a real concurrency test belongs to
`payments_flow.rs`.

### 12. `payments` exposes `cancel`, and `expire_stale_tokens` takes a limit

**The plan** only foresees `cancel_token` at the query level, and announces
`expire_stale_tokens(pool, clock) -> Result<u64>`.

**What I did**: a business function `cancel(tx, clock, account_id, jti)` that checks the token
really belongs to the account before cancelling it and releasing the hold, and
`expire_stale_tokens(pool, clock, limit)`.

**Why**: `DELETE /me/payment-tokens/{jti}` needs an entry point that does both things together;
leaving them to the handler would amount to putting a business rule in the HTTP layer. The `limit`
parameter prevents a sweep over an old database from loading a hundred thousand rows at once — and
cancelling an already-cancelled token returns `Ok(())`, for the same idempotence reason as in point
11.

### 13. Payment errors are finer-grained than the plan's list

**What I added**: `TokenCancelled`, `PartnerNotApproved` and `ShortCodeUnavailable`.

**Why**: the first two are situations the merchant must distinguish from an already-settled token —
a token cancelled by the employee and an unapproved merchant account do not call for the same
reaction at the counter. `ShortCodeUnavailable` signals exhaustion of the five draws from point 9;
it should never occur, and that is precisely why it must be named rather than drowned in a 500.

### 14. Tests I6 and I7 check a data property, not a behaviour

**The plan** describes I6 as "two `settle` calls → a single payment" and I7 as a settlement refused
after expiry.

**What I did**: at the time `invariants.rs` was written, `settle` did not exist. Both tests
therefore check the properties at the database level — the uniqueness of `payments.token_jti`, the
consistency between a token's status and the existence of its payment, and the query that detects a
settlement later than expiry.

**What remains to be done**: now that `settle` exists, the behavioural versions belong to
`payments_flow.rs` and `degraded_mode.rs`. The invariant tests remain useful as they are: they check
the state of the database, independently of the code path that produced it.

### 15. The `approved_account` stub was not put in place

**The plan** (§3) has me stub `partners::repo::approved_account` with a hard-coded account within
the first hour, so as not to be blocked on `settle`.

**What I did**: nothing of the sort. `settle` calls the function as the contract defines it, and
`payments` remains dead code until Giscard has written it.

**Why**: the stub would have lived in a file that is not mine. The coexistence rule takes
precedence, and Giscard owns his files. To check my own work, I add the function and the two
missing `pub mod` lines locally, run the tests, then remove them — nothing enters his perimeter.

**What he must supply**, exactly:

```rust
// crates/core/src/lib.rs
pub mod partners;
pub mod payments;

// crates/core/src/partners/repo.rs
pub async fn approved_account(tx: &mut PgTransaction<'_>, id: PartnerId)
    -> Result<AccountId, PartnerError>;
```

The `status = 'approved'` filter must live in his query, not in the caller: it is the query that
carries the rule "an unapproved merchant does not receive public money".

### 16. `topup` takes a clock and an optional reference

**The plan** (§4.1) announces `topup(tx, admin, employer_id, account_id, amount, reference)`.

**What I did**: I inserted `clock: &dyn Clock` in second position and typed the reference
`Option<&str>`.

**Why**: the operation's `occurred_at` must come from the injected clock, as everywhere else on the
money path — otherwise a test cannot date a top-up, and the fixed-clock demonstration of expiry
stops at the first credit. The reference is nullable in the database (`topups.reference`), and the
Rust type says so.

### 17. Top-up idempotence rests on the chain lock

**The plan** describes the reference as "the natural idempotency key", at priority P3.

**What I did**: `topup` takes `lock_chain` as its first statement, then looks for an existing top-up
for the `(employer_id, reference)` pair and returns it as-is if one exists.

**Why not a unique index**: `uq_topup_reference` does not exist in `0001_schema.sql`, and the
migration is already applied on the team's machines. Adding a `0003` migration for a P3 constraint
amounts to making the schema carry a migration-replay risk the day before delivery.

**What makes the check correct anyway**: advisory lock 42 is taken by every path that writes to the
journal — `topup`, `settle`, and any future write. Two concurrent top-ups carrying the same
reference therefore cannot run in parallel: the second waits, then reads the row written by the
first. The residual hole is a direct `INSERT` into `topups` bypassing the function; that is the kind
of thing the unique index would forbid for good, and it is the reason to add it one day.

### 18. The system account is refused as a credit target

**The plan** says nothing about the case.

**What I did**: `topup` returns `SystemAccountCredited` when the target account carries
`owner_type = 'system'`.

**Why**: `post_operation` already refuses a transfer from an account to itself, so topping up
`MINISTRY_ISSUANCE` from itself failed anyway. But topping up `CLOSURE_FORFEIT` from issuance went
through without a word, and produced a `topups` row that makes no sense: a closure forfeit is not an
allocation. Better to name the refusal.

### 19. Only `topup.rs` is delivered, and it does not compile yet

`TASK-DISTRIBUTION-BACKEND.md` §2 assigns me only `funding/topup.rs`: `mod.rs` and `repo.rs` fall
into Giscard's "everything else". I had written all three; I kept only mine. `topup.rs` therefore
calls things that do not exist yet, exactly as `settle` calls `approved_account` in point 15.

**What Giscard must supply**, exactly:

```rust
// crates/core/src/lib.rs
pub mod funding;

// crates/core/src/funding/mod.rs
pub mod repo;
pub mod topup;

#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct Topup {
    pub operation_id: OperationId,
    pub batch_id: Option<BatchId>,
    pub employer_id: EmployerId,
    pub to_account: AccountId,
    pub reference: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum FundingError {
    SystemAccountMissing(&'static str),
    SystemAccountCredited,
    AccountInactive,
    Ledger(#[from] LedgerError),
    Db(#[from] sqlx::Error),
}

// crates/core/src/funding/repo.rs
pub async fn find_topup_by_reference(
    conn: &mut PgConnection, employer_id: EmployerId, reference: &str,
) -> Result<Option<Topup>, sqlx::Error>;

pub async fn insert_topup(
    conn: &mut PgConnection, operation_id: OperationId, batch_id: Option<BatchId>,
    employer_id: EmployerId, to_account: AccountId, reference: Option<&str>,
) -> Result<Topup, sqlx::Error>;
```

Two points that cannot be guessed. `find_topup_by_reference` must filter on `(employer_id,
reference)` only, with no extra condition: that is what carries the idempotence of point 17, and one
more filter would break it. And `insert_topup` must return the inserted row through `RETURNING`, not
a `()`: `topup` hands the `Topup` back to its caller.

`TopupBatch` and `BatchStatus` are announced by `file-guide.md` §3.8 in the same `mod.rs`. Since the
CSV batch is cut in §1 of the distribution plan, I do not miss them — but the `topup_batches` table
exists and `Topup.batch_id` already references it, so he may as well write them while he is there.

### 20. The `funding` tests are not delivered

`topup` was checked by five tests against a real PostgreSQL: the nominal top-up with the two
balances moving in opposite directions, the replayed reference that does not credit twice, the
suspended account refused, the system account refused as a credit target, and two top-ups without a
reference that both apply. They pass, and they are not in the repository.

**Why**: they need everything point 19 lists, and shipping a test file that does not compile would
break the whole `crates/tests` package, and therefore `invariants.rs` too. They will come back once
Giscard has delivered — in a separate `funding_topup.rs`, because they are not invariants and
`payments_flow.rs` is reserved for the `authorize` → `settle` path.

### 21. `BatchSettleResult.jti` is nullable

**The published contract** (`data-dictionary.md` §4.5) gives `jti: string` in each result of the
resynchronisation batch.

**What I did**: `Option<Jti>`, so `string | null` on the front-end side.

**Why**: a batch line may be entered by short code. If that code is unknown — the merchant mistyped
a digit at the counter, the day before, offline — there is no `jti` to return, and yet the contract
requires one to be written. The two escape hatches were to invent a null UUID, which reads as a
valid identifier, or to drop the line from the response, which shifts the correspondence with the
merchant's queue.

The front end correlates by rank: `results[i]` answers `items[i]`, and the batch preserves the order
received. The `jti` is a display convenience, not the correlation key. A `null` on a `failed` line
says exactly what happened: we could not name that token.

### 22. `PaymentResponse` is not built through `From<Payment>`

**The rule** (`file-guide.md` §4.4) asks for one `impl From<DomainType> for ResponseDto` per
response DTO.

**What I did**: `PaymentResponse::settled(&Payment, Money)`.

**Why**: `Payment` does not carry the amount. It carries `operation_id`, and the amount lives in
`ledger_operations.amount` — the journal is the authority on sums, not the payments table, and that
is deliberate. A `From<Payment>` alone therefore cannot fill the contract's `amount` field. Making
it optional would have pushed onto the front end an absence that does not exist; having the DTO read
the database would have put a query in a layer that never makes one.

The second value is supplied by the caller, who already has it to hand: `settle` returns the
`Payment`, and the amount is that of the token it has just consumed.

**This departure is lifted by §25.**

### 23. `AuthorizeRequest` refuses a zero amount

**What I added**: a schema validation on `AuthorizeRequest`, which rejects a non-strictly-positive
`amount`.

**Why**: `Money` refuses negatives and surplus decimals from deserialisation onwards, but it accepts
zero — that is a legitimate amount for the type, `Money::zero()` exists. A €0 token, on the other
hand, makes no sense, and without this check it went all the way down to `place_hold`, came back up
as `LedgerError::NonPositiveAmount`, which the conversion files under `CoreError::Internal`, that is,
a **500**. Invalid user input would have surfaced as a server error.

The refusal therefore belongs at the boundary: it is a `422 VALIDATION_FAILED`, which the dictionary
already announces for a malformed amount.

### 24. The short code goes out formatted and comes back raw

**What I did**: `IssuedTokenResponse` applies `format_for_display` to the domain code, so `86RB57CT`
goes out as `86RB-57CT`. In the other direction, `SettleRequest::token_ref` passes the merchant's
input **as-is** into `TokenRef::ShortCode`, without normalising it.

**Why the asymmetry**: display is an exposure decision, it belongs to the DTO. Normalisation, on the
other hand, is a resolution rule: `settle::resolve` already calls `normalize` then `is_valid` before
searching the database, and that is the only place that should do it. Normalising in the DTO as well
would create a second authority over the same rule — harmless as long as the two implementations
agree, and silently wrong the day one of them changes.

The DTO therefore does not validate the short code's shape either. It only caps its length, so that
absurd input does not travel as far as the database. A malformed code comes back as
`TOKEN_NOT_FOUND`, like an unknown code, which is the same thing from the counter's point of view.

### 25. `settle` returns a `Settlement`, not a `Payment`

**What I did**: `settle` now returns `Settlement { payment, amount }`, and `payments/repo.rs` gains
`find_settlement_by_jti`, `operation_amount` and `list_partner_settlements`, the last of which
replaces `list_partner_payments`.

**Why**: the `payments` table carries no amount, and that is deliberate — the amount lives in
`ledger_operations`, because the journal is what has authority over sums. But the published contract
asks for `amount` in the response of `POST /partner/payments` **and** in every line of
`GET /partner/transactions`. The handler would therefore have had to go and fetch it itself, that is,
put a query in the HTTP layer, exactly what rule R1 forbids.

The cost is nil on the nominal path: `settle` already holds `token.amount` at the moment it writes
the operation, it has nothing to re-read. On the idempotent path — the merchant replaying — re-reading
the amount costs one extra query, on a path that is not the hot path.

**What this settles along the way**: §22. `PaymentResponse` is again built through an
`impl From<&Settlement>`, as the guide's §4.4 rule asks for every response DTO. That was not possible
as long as the domain type did not carry the amount.

**Why composition and not a flat struct**: `Payment` is the table row, and `Settlement` is the
business result of a settlement. Flattening the two would have duplicated `Payment`'s seven fields,
and they would have had to be maintained twice the day the table changes. Composition costs only a
hand-written `FromRow` implementation, eight lines, which serves the single read and the joined list
equally well.

### 26. Expiry is judged at scan time, not at synchronisation time

**The observation**: `RESYNC_MAX_AGE_HOURS` is 72 h and `TOKEN_TTL_SECONDS` is 300 s. As long as
`settle` compared `expires_at` against the server clock, the first of those two durations served no
purpose whatsoever: any offline settlement resynchronised more than five minutes after the scan came
out as `TokenExpired`. And yet `TASK-DISTRIBUTION-BACKEND.md` tells the jury that "the backend is
ready" for the offline queue. It was not.

**What I did**: `settle` now compares `expires_at` against `scanned_at`. The token is valid if the
merchant scanned it during its validity window, whatever the moment the synchronisation reaches us —
within the limit of `resync_max_age`.

**What this amends**: decision 2, which made the server clock the sole authority on expiry. It
remains true for what it protected — the QR token still does not have the final word, and it is we
who decide — but the question "at which instant do we judge?" gets a different answer.

**What I concede**: `scanned_at` comes from the client. I bound it with three limits rather than
trusting it:

1. `now - scanned_at > resync_max_age` is still refused — a queue does not come back three days
   later.
2. `scanned_at` is clamped to `min(scanned_at, now)` — a till clock running fast extends the life of
   no token, it is simply realigned on ours.
3. `scanned_at < issued_at` is refused — a scan earlier than the token's issuance cannot be honest.

**What exactly a liar gains**: settling a token *they legitimately hold* which has expired, by
declaring they scanned it during its validity. Nothing more. They cannot forge one, the signature is
Ed25519; nor settle it twice, `payments.token_jti` is unique; nor change its amount, which comes from
the token and never from the request; nor push it through a suspended account or an unapproved
merchant, those checks are unchanged. Set against a degraded mode that did not work at all, the
trade-off seems largely favourable to me.

### The already-swept token

Fixing the comparison was not enough. `expire_stale_tokens` moves expired tokens to `expired` and
releases their hold; the `match` on status refused those tokens before even looking at `scanned_at`.
A perfectly valid offline settlement therefore stayed refused as soon as the sweep had run — that is,
always, since expiry is handled lazily on every balance read.

`settle` now accepts an `expired` token, remembering that its hold no longer exists:

- `still_held` distinguishes `Active` (the hold is there, it must be released) from `Expired` (the
  sweep already did it, releasing a second time would give `ReleaseExceedsHold`).
- `consume_token` accepts `status IN ('active', 'expired')`, without which the token would have
  stayed `expired` while a payment is attached to it, which breaks the consistency test I6 checks.
- Since the funds were made available again, the employee may have spent them in the meantime.
  `post_operation` then fails on the balance constraint, and I translate that case explicitly into
  `PaymentError::InsufficientFunds` rather than letting it surface as `Ledger(_)`, which the mapping
  table files under 500. It is a business situation, and the merchant must understand it.

**What this settles along the way**: invariant I7 — "an expired token is never settled" — becomes
true *by construction*. Until now it was checked after the fact by a query; it is now the very
condition that authorises the write, since `settle` refuses any `scanned_at` later than
`expires_at`.

### 27. `AuthUser<R>(pub AuthenticatedUser)` cannot compile as written

**The contract frozen at H+0** (`TASK-DISTRIBUTION-BACKEND.md` §3, echoed by `file-guide.md` §4.3)
gives the authentication extractor in this form:

```rust
pub struct AuthUser<R: Role>(pub AuthenticatedUser);
```

**The problem**: Rust refuses a type parameter that appears in no field — that is error `E0392`.
Since the role marker is used only by the `FromRequestParts` implementation, the struct needs a
`PhantomData<R>` in order to exist. I only discovered this when compiling my handlers against the
contract.

**What I did**: my handlers destructure `AuthUser(user, _)`. It is the only form that compiles, and
it leaves Giscard the choice of making the second field public or exposing an accessor — in the
latter case, it is my two files that change, not his.

**Why I record it rather than work around it**: it is one of the five contracts we froze so as not
to block each other. A contract that does not compile must be fixed in the document, otherwise each
of us will rediscover it on his own side.

### 28. The pagination cursor is the identifier of the last row

**The plan** (`file-guide.md` §4.3) describes an "opaque base64 cursor encapsulating
`(sort_value, id)`".

**What I did**: both of my lists return the identifier of the page's last operation, and `null` as
soon as the page is not full.

**Why**: the cursor's encoding belongs to `extractors/pagination.rs`, which does not exist yet.
Inventing a base64 format in my handlers would amount to fixing a second one, and the day Giscard
writes his, the two would contradict each other silently. The bare identifier stays opaque from the
front end's point of view — it must infer nothing from it — and can be replaced by the full format
without changing the shape of the response.

### 29. Partner-space reads live in `payments`, not in `reporting`

**The plan** assigns `core/src/reporting/` to Giscard, and that is where statements would naturally
live.

**What I did**: `payments/repo.rs` gains `partner_totals` and `list_partner_activity`, with the
types `PartnerTotals` and `PartnerActivity` in `payments/mod.rs`. The employee statement, on the
other hand, stays with him, in `reporting::employee_statement`.

**Why that boundary**: what a merchant reads is their own settlements — `payments` joined to
`ledger_operations`, exactly the material `payments/repo.rs` already has charge of, and which I
needed anyway for the amount in §25. An employee's statement, by contrast, mixes top-ups and
payments, and goes to fetch the name of an employer or a trading name: it is a crossing of three
domains, none of which is mine.

**The customer label** — "K. A." — is computed in SQL from the employee's initials, with a
`LEFT JOIN`: an account with no employee record yields a dash rather than making the line disappear.
The full name never leaves the database.

### 30. What my two route files expect from Giscard

The nine handlers are written and compile, checked against a set of stubs I put in place and then
removed. Here is, exactly, what they are missing. I list it here because half of these items were not
in the frozen contract, and because they are as many decisions I am taking in his place until he has
taken them.

```rust
// core/src/lib.rs
pub mod directory;  pub mod partners;  pub mod payments;  pub mod reporting;

// core/src/partners/mod.rs
pub struct PartnerCard { pub id: PartnerId, pub trade_name: String }
pub enum PartnerError { NotApproved, Db(sqlx::Error) }

// core/src/partners/repo.rs
pub async fn approved_account(tx: &mut PgTransaction<'_>, id: PartnerId)
    -> Result<AccountId, PartnerError>;

// core/src/partners/highlights.rs
pub struct MinisterPick { pub partner: PartnerCard, pub position: i32 }
pub async fn minister_picks(pool: &PgPool) -> Result<Vec<MinisterPick>, PartnerError>;

// core/src/directory/employees.rs
pub async fn active_account(conn: &mut PgConnection, employee: EmployeeId)
    -> Result<AccountId, DirectoryError>;

// core/src/reporting/mod.rs
pub struct StatementLine {
    pub operation_id: OperationId, pub kind: OperationKind, pub amount: Money,
    pub incoming: bool, pub counterparty: String,
    pub occurred_at: DateTime<Utc>, pub reference: Option<String>,
}
pub async fn employee_statement(
    pool: &PgPool, account: AccountId, limit: i64, cursor: Option<&str>,
) -> Result<Vec<StatementLine>, sqlx::Error>;

// api/Cargo.toml : ed25519-dalek, since AppState carries Arc<SigningKey>
// api/src/state.rs   : AppState { db, clock, signing_key, config }, Clone
// api/src/error.rs   : ApiError, IntoResponse, and From<_> for CoreError, sqlx::Error,
//                      InvalidMoneyError, PaymentError, PartnerError, DirectoryError
// api/src/extractors/auth.rs       : AuthUser<R>(pub AuthenticatedUser, pub PhantomData<R>),
//                                    Employee and Partner markers,
//                                    From<AuthenticatedUser> for EmployeeId and PartnerId
// api/src/extractors/pagination.rs : Pagination { cursor: Option<String>, limit: u32 }
// api/src/extractors/validated.rs  : ValidatedJson<T: Validate>(pub T)
// api/src/dto/mod.rs               : Paginated<T> { items, next_cursor } + the pub mod lines
// api/src/dto/catalog.rs           : CatalogItem + From<&PartnerCard>
// api/src/routes/mod.rs            : mounts employee::routes() and partner::routes()
```

Two points cannot be guessed. `AuthenticatedUser` must convert into `EmployeeId` and into
`PartnerId` — that is what the guide's example handler assumes with its `partner.into()`, and
without those two conversions no handler knows who it is talking about. And `ApiError` must accept
`PaymentError` directly, without going through `CoreError`: the dictionary's §6 codes distinguish
`TOKEN_EXPIRED` from `TOKEN_ALREADY_USED`, which conversion to `CoreError` would flatten.

**`PaymentError::code()`**, on the other hand, is already written, on my side, in `payments/mod.rs`:
the resynchronisation batch must name each line's error without fabricating an HTTP response, so the
stable code belongs to the domain. `api/src/error.rs` only has to add the status to it.

> **Amended by §32.** The `From<AuthenticatedUser> for PartnerId` conversion listed above cannot
> work; the partner routes now resolve through `partners::repo::find_partner_by_user`. See below.

### 31. The session token is compared hashed in SQL, with `digest()`

**The plan** (`TASK-DISTRIBUTION-BACKEND.md` §4.2) says the session token is hashed in the database
and that the plaintext lives only in the cookie, without naming the algorithm or the place where the
hash is computed.

**What I did**: `extractors/auth.rs` looks the session up with
`WHERE s.token_hash = digest($1, 'sha256')`, binding the plaintext token. The hashing is therefore
computed by PostgreSQL, not by the Rust code.

**Why**: `sha2` is not among the dependencies of `crates/api`, and `api/Cargo.toml` belongs to
Giscard — I do not open it for one line. `pgcrypto`, on the other hand, is already enabled by
`0001_schema.sql`, and `digest()` on a high-entropy random token needs neither salt nor stretching:
it is not a password, it is a lookup key. The plaintext does not leave the bound parameter, it
appears neither in a log nor in a constructed string.

**What this requires from the other end**: `identity::create_session` must store exactly
`sha256(token)` as `BYTEA` — the `digest($1, 'sha256')` of the same migration, or the Rust
equivalent. A different algorithm breaks nothing noisily: no session would simply ever be found, and
every authenticated request would answer `401`. That is the kind of failure you hunt for an hour, so
it may as well be written down here.

**What I left aside**: updating `last_seen_at` on every request. It would turn every authenticated
read into a write, for a need that appears nowhere in the specification.

### 32. `From<AuthenticatedUser>` cannot work for `PartnerId`, and the partner routes resolve through a query

**The contract** (§30 above) asks for `From<AuthenticatedUser>` into `EmployeeId` and into
`PartnerId`: without those two conversions, no handler knows who it is talking about.

**The problem**: in the schema, `employees.id` and `partners.id` are keys of their own, distinct from
`users.id` — the table carries a `user_id UNIQUE` that makes the link. Going from an
`AuthenticatedUser` to the real `EmployeeId` therefore requires a query, and a query does not fit
into a `From`, which is synchronous and infallible.

**What I did first, and why it was wrong**: the conversion copied the user's UUID, so
`PartnerId::from(user)` returned a value equal to `users.id`. I asked the other end to resolve by
`user_id` rather than by its table's primary key. **That cannot hold for partners**, and the reason
is a foreign key:

`payments/repo.rs::insert_payment` binds the `PartnerId` it receives straight into
`payments.partner_id`, a column whose foreign key points at `partners(id)`. If that value carried
`users.id`, every `settle` would fail on a foreign-key violation — not on a subtle business error, on
a constraint. My own tests confirm it the other way round: `payments_flow.rs` passes
`partner.partner`, the real `partners.id`, and they pass.

So, inside `core`, `PartnerId` **is** `partners.id`, and it cannot be otherwise.

**What I did in the end**: `routes/partner.rs` no longer uses `PartnerId::from(user)`. A `partner_of`
helper resolves the authenticated user through `partners::repo::find_partner_by_user`, and the four
handlers work from the real identifier. A valid session whose user has no partner record answers
`403`, the same code as the role refusal of `AuthUser<Partner>`. This is the alternative I set aside
in the first version of this decision — it turns out it was not optional.

Along the way, `summary` loses a transaction: since the helper returns the whole `Partner`,
`Partner::is_official_partner()` answers the same question as the `approved_account` round trip
(amendment A4, `status == Approved`), with one query fewer.

**What remains true for the employee side**: `directory::employees::active_account` returns only an
`AccountId`; no foreign key constrains how its argument is interpreted. It can therefore resolve by
`user_id`, by joining on `employees.user_id`, and `routes/employee.rs` is unchanged.
**That function receives a `users.id`, not an `employees.id`** — it is the only place where the
original convention of this decision still holds, and it must be said explicitly because nothing in
the signature reveals it.

**What follows**: the `impl From<AuthenticatedUser> for PartnerId` in `identity/mod.rs` is now
unused. It is harmless, but it is a trap left lying around, and it should be removed.
