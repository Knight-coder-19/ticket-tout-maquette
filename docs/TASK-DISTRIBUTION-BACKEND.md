# CartePro — Backend distribution

> **A single night's sprint. Delivery tomorrow evening.**
> Two developers: **Sèdjro** (S) and **Giscard** (G).
> This document says who owns which file, what it contains, and in what order.
> The references `CLAUDE.md`, `data-dictionary.md` and `file-guide.md` remain the source for detail.

---

## 0. The principle behind the split

**Only one person touches the money.**

The ledger does not parallelise: two people writing into the hash chain produce a broken chaining, and the bug only shows up during the demo. Sèdjro owns the whole money path end to end. Giscard owns everything else, that is to say three quarters of the code.

**Nobody modifies a file that is not theirs.** Not even for a missing `use`. You report it, the other fixes it.

---

## 1. Scope: what we keep, what we cut

### Kept

Full ledger with double entry and chaining · `authorize` / `settle` with fund reservation · three-role authentication · partner registration and approval · paginated catalogue · single admin top-up · HR-system endpoint · minimal dashboard · highlights (A2).

### Cut, with the justification to give the jury

| Cut | What we answer |
|---|---|
| Worker | Token expiry handled lazily on every balance read |
| Bulk CSV import | The single top-up demonstrates the mechanism; the batch is documented |
| Compensations | Designed and documented, not implemented |
| Closure / balance forfeit | Documented |
| Public surface (A3) | Absent from the specification, awaiting confirmation |
| Offline queue | **The backend is ready**: reservation at issuance, idempotence on `token_jti`, `/payments/batch` endpoint. The local queue is front-end work. |
| Docker / Caddy | `cargo run` for the demo |

Every cut has an argument. That is what makes the difference between "we ran out of time" and "a deliberate choice".

---

## 2. File ownership

### Sèdjro — the money path

```
migrations/0001_schema.sql          <- the whole schema in a single file
crates/core/src/ids.rs
crates/core/src/money.rs
crates/core/src/clock.rs
crates/core/src/error.rs
crates/core/src/crypto/token_sig.rs
crates/core/src/crypto/short_code.rs
crates/core/src/ledger/mod.rs
crates/core/src/ledger/hash.rs
crates/core/src/ledger/balance.rs
crates/core/src/ledger/repo.rs
crates/core/src/payments/mod.rs
crates/core/src/payments/authorize.rs
crates/core/src/payments/settle.rs
crates/core/src/payments/repo.rs
crates/core/src/funding/topup.rs
crates/api/src/routes/employee.rs
crates/api/src/routes/partner.rs
crates/api/src/dto/employee.rs
crates/api/src/dto/partner.rs
tests/invariants.rs
tests/payments_flow.rs
```

### Giscard — everything else

```
Cargo.toml  (workspace + 3 crates)
rust-toolchain.toml   .env.example   .gitignore
crates/core/src/lib.rs               <- frozen at H+0, nobody touches it again
crates/core/src/config.rs
crates/core/src/crypto/mod.rs
crates/core/src/crypto/password.rs
crates/core/src/identity/*           (mod, login, session, repo)
crates/core/src/directory/*          (mod, employees, employers, cities, repo)
crates/core/src/partners/*           (mod, registration, review, catalog, highlights, repo)
crates/core/src/reporting/mod.rs
crates/api/src/main.rs
crates/api/src/state.rs
crates/api/src/error.rs
crates/api/src/routes/mod.rs         <- frozen at H+0
crates/api/src/extractors/*          (auth, validated, pagination, api_client)
crates/api/src/routes/auth.rs
crates/api/src/routes/catalog.rs
crates/api/src/routes/admin.rs
crates/api/src/routes/integration.rs
crates/api/src/dto/auth.rs   dto/catalog.rs   dto/admin.rs   dto/integration.rs
scripts/seed.sql
tests/common/mod.rs
```

---

## 3. Interface contract — to be frozen at H+0

These five signatures are what each of us expects from the other. **We write them into the files with `todo!()` within the first hour**, so that everything compiles and nobody waits.

```rust
// -- Giscard supplies, Sèdjro consumes --------------------------
// partners/repo.rs — error if the partner is not 'approved'
pub async fn approved_account(tx: &mut PgTransaction<'_>, id: PartnerId)
    -> Result<AccountId, PartnerError>;

// directory/employees.rs — payroll reference -> account, for topup and the HR system
pub async fn resolve_account_by_ref(
    conn: &mut PgConnection, employer: EmployerId, employer_ref: &str,
) -> Result<AccountId, DirectoryError>;

// extractors/auth.rs — corrected, see the note below
pub struct AuthUser<R: Role>(pub AuthenticatedUser, pub PhantomData<R>);

// Without these two conversions, no handler knows who it is talking about.
impl From<AuthenticatedUser> for EmployeeId;
impl From<AuthenticatedUser> for PartnerId;

// -- Sèdjro supplies, Giscard consumes --------------------------
// ids.rs, money.rs, clock.rs      -> delivered at H+1, HARD DEADLINE
// ledger/mod.rs
pub async fn post_operation(tx: &mut PgTransaction<'_>, kind: OperationKind, p: Posting)
    -> Result<LedgerOperation, LedgerError>;

pub async fn lock_account(tx: &mut PgTransaction<'_>, id: AccountId)
    -> Result<Account, LedgerError>;
```

**Sèdjro stubs `approved_account` on his side at H+1** with a hard-coded account, otherwise he is blocked on `settle` all night. Giscard replaces the stub when his `partners` is ready.

> **Amendment — `AuthUser` corrected.** The original form, `AuthUser<R: Role>(pub AuthenticatedUser)`,
> does not compile: Rust refuses a type parameter that appears in no field, that is error `E0392`.
> Since the role marker is used only by the `FromRequestParts` implementation, it needs a
> `PhantomData<R>`. I only noticed when compiling my handlers against this contract, and I am fixing
> it here rather than on my own: it is one of the five signatures we froze precisely so as not to
> block each other.
>
> Consequence for the handlers: they destructure `AuthUser(user, _)` and not `AuthUser(user)`. If
> Giscard prefers to keep a single public field and expose an accessor, it is my two route files
> that change, not his — let him say so, the correction is mechanical.
>
> I am also adding the two `From<AuthenticatedUser>` impls: the example handler in `file-guide.md`
> §4.5 already assumes them with its `partner.into()`, but they were written nowhere. The detail of
> everything my routes expect is in §30 of `decisions.md`.
>
> **Later amendment.** `From<AuthenticatedUser> for PartnerId` cannot work: `insert_payment` binds
> the `PartnerId` into `payments.partner_id`, whose foreign key points at `partners(id)`. The partner
> routes resolve through `partners::repo::find_partner_by_user`. See §32 of `decisions.md`.

---

## 4. What each file contains

### 4.1 Sèdjro's files

#### `migrations/0001_schema.sql`

The whole schema in one file. Order imposed by the dependencies:

```
extensions (citext, pgcrypto)
enums (13 types, including service_mode and highlight_placement)
cities, users, employers
accounts                      -- no FK on owner_id
employees, employment_links, partners
payment_tokens
ledger_operations, ledger_entries
payments, topups
partner_highlights
sessions, api_clients, audit_log
immutability triggers + REVOKE
INSERT system accounts: MINISTRY_ISSUANCE, CLOSURE_FORFEIT
INSERT city reference data
```

Copy the definitions from `data-model.md`. Do not forget the partial unique indexes (`uq_active_employment`, `uq_active_short_code`, `uq_employer_ref`, the two on `partner_highlights`): they are what carry the rules.

#### `core/src/ids.rs` — **to be delivered at H+1**

```rust
macro_rules! newtype_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash,
                 Serialize, Deserialize, sqlx::Type)]
        #[sqlx(transparent)]
        pub struct $name(pub Uuid);
        impl $name { pub fn new() -> Self { Self(Uuid::new_v4()) } }
        // Display
    };
}
newtype_id!(UserId); newtype_id!(EmployeeId); newtype_id!(EmployerId);
newtype_id!(PartnerId); newtype_id!(AccountId); newtype_id!(OperationId);
newtype_id!(Jti); newtype_id!(CityId); newtype_id!(HighlightId);
```

#### `core/src/money.rs` — **to be delivered at H+1**

```rust
pub struct Money(i64);          // euro cents, never a float

impl Money {
    pub fn try_new(cents: i64) -> Result<Self, InvalidMoneyError>   // refuses < 0
    pub fn parse_euros(text: &str) -> Result<Self, InvalidMoneyError>
    pub fn checked_add(self, o: Money) -> Option<Money>
    pub fn checked_sub(self, o: Money) -> Option<Money>   // also refuses negatives
    pub fn is_positive(self) -> bool
    pub fn cents(self) -> i64
}
// JSON: decimal euros (456.56) both ways, conversion done here only.
// Display: "456.56". sqlx::Type transparent over BIGINT.
```

#### `core/src/clock.rs` — **to be delivered at H+1**

```rust
pub trait Clock: Send + Sync { fn now(&self) -> DateTime<Utc>; }
pub struct SystemClock;
pub struct FixedClock { at: Mutex<DateTime<Utc>> }   // + advance(Duration)
```

`FixedClock` is indispensable: without it, testing the five-minute expiry would mean waiting five minutes.

#### `core/src/crypto/token_sig.rs`

**Ed25519, never HMAC.** The partner must be able to verify offline with the public key; an HMAC would force them to hold the server's secret key, and therefore the means to forge tokens.

```rust
pub struct TokenPayload { jti: Jti, amt: i64, exp: DateTime<Utc>, iss: String }

pub fn sign(p: &TokenPayload, key: &SigningKey) -> String
// -> "CP1." + b64url(canonical json) + "." + b64url(signature)

pub fn verify(s: &str, key: &VerifyingKey) -> Result<TokenPayload>
// splits into 3, checks the signature BEFORE deserialising
```

#### `core/src/ledger/hash.rs`

```rust
pub const GENESIS_HASH: [u8; 32] = [0u8; 32];

pub fn entry_hash(
    seq: i64, op: OperationId, acc: AccountId, dir: EntryDirection,
    amount: Money, recorded_at: DateTime<Utc>, prev: &[u8; 32],
) -> [u8; 32]
// SHA-256 over a canonical concatenation.
// WARNING: DOCUMENT THE FORMAT IN A COMMENT: changing it later
//   invalidates the whole chain already written.
```

#### `core/src/ledger/mod.rs` — **the most important file in the project**

```rust
pub struct Posting {
    debit: AccountId, credit: AccountId, amount: Money,
    occurred_at: DateTime<Utc>, memo: Option<String>, created_by: Option<UserId>,
}

pub async fn lock_chain(tx) -> Result<()> {
    // SELECT pg_advisory_xact_lock(42)
    // serialises the chaining; released at COMMIT/ROLLBACK
}

pub async fn lock_account(tx, id) -> Result<Account> {
    // SELECT * FROM accounts WHERE id = $1 FOR UPDATE
}

pub async fn post_operation(tx, kind, p: Posting) -> Result<LedgerOperation> {
    // 1. check debit != credit, amount > 0
    // 2. INSERT ledger_operations
    // 3. read the last (seq, hash) -> prev
    // 4. INSERT DEBIT entry  : hash = entry_hash(...)
    // 5. INSERT CREDIT entry : prev = previous hash
    // 6. UPDATE accounts: debit.settled -= amount ; credit.settled += amount
    //                      version += 1 on both
    // -> the caller has ALREADY taken lock_chain and lock_account
}

pub async fn place_hold(tx, id, amount) -> Result<()> {
    // checks settled - held >= amount, otherwise InsufficientFunds
    // UPDATE accounts SET balance_held = balance_held + amount
}

pub async fn release_hold(tx, id, amount) -> Result<()>
```

#### `core/src/ledger/balance.rs`

```rust
pub async fn recompute_balance(conn, id) -> Money
// SUM(CASE direction WHEN 'credit' THEN amount ELSE -amount END)

pub async fn recompute_held(conn, id) -> Money
// SUM(amount) of active, unexpired payment_tokens

pub async fn verify_chain(conn, from_seq) -> Result<(), i64>
// replays the chain, returns the first inconsistent seq
```

#### `core/src/payments/authorize.rs`

```rust
pub async fn authorize(tx, clock, config, account_id, amount) -> Result<IssuedToken> {
    let acc = ledger::lock_account(tx, account_id)?;      // 1. lock
    if acc.status != Active { return Err(AccountInactive) }
    ledger::place_hold(tx, account_id, amount)?;          // 2. reservation
                                                          //    (<- future cap HERE)
    let jti  = Jti::new();
    let code = short_code::generate();                    // 3. token
    INSERT payment_tokens (jti, account_id, amount, code,
                           expires_at = now + config.token_ttl);
    let payload = TokenPayload { jti, amt, exp, iss };
    Ok(IssuedToken { jti, code, amount, expires_at, qr: sign(&payload, key) })
}
```

#### `core/src/payments/settle.rs` — **the order is the protection**

```rust
pub async fn settle(tx, clock, partner, jti_or_code, scanned_at) -> Result<Payment> {

    // 1. IDEMPOTENCE — before anything else
    if let Some(p) = repo::find_payment_by_jti(tx, jti)? {
        if p.partner_id == partner { return Ok(p); }      // replay -> success
        return Err(TokenAlreadyUsed);                      // other -> error
    }

    // 2. LOCKS
    ledger::lock_chain(tx)?;
    let token = repo::lock_token(tx, jti)?.ok_or(UnknownToken)?;
    let acc   = ledger::lock_account(tx, token.account_id)?;

    // 3. CHECKS — never before the lock
    if token.status != Active          { return Err(TokenAlreadyUsed) }
    if token.expires_at <= clock.now() { return Err(TokenExpired) }     // SERVER clock
    if acc.status != Active            { return Err(AccountInactive) }
    let partner_acc = partners::approved_account(tx, partner)?;

    // 4. WRITE
    let op = ledger::post_operation(tx, Payment, Posting {
        debit: token.account_id, credit: partner_acc,
        amount: token.amount, occurred_at: scanned_at,
    })?;
    ledger::release_hold(tx, token.account_id, token.amount)?;  // the hold becomes real
    repo::consume_token(tx, jti, op.id)?;
    repo::insert_payment(tx, op.id, jti, partner, entry_mode, scanned_at)
}
```

> **The trap:** a balance check placed before the lock protects nothing. Between the read and the write, another request slips through. That is the double-QR case, and it only shows up with two simultaneous users.

#### `core/src/funding/topup.rs`

```rust
pub async fn topup(tx, admin, employer, account_id, amount, reference) -> Result<Topup> {
    ledger::lock_chain(tx)?;
    let sys = repo::system_account(tx, "MINISTRY_ISSUANCE")?;
    ledger::lock_account(tx, sys)?;  ledger::lock_account(tx, account_id)?;
    let op = ledger::post_operation(tx, Topup, Posting {
        debit: sys, credit: account_id, amount, occurred_at: now,
    })?;
    INSERT topups (op.id, employer, account_id, reference)
}
```

> The system account may go negative: that is normal, it is the source of issuance. The `balance_settled >= 0` constraint must be lifted for `owner_type = 'system'`, or that account must be pre-credited with a very large amount in the seed. **Choose now, not at 4 a.m.**

#### `api/src/routes/employee.rs` and `partner.rs`

Handlers in the imposed shape, fifteen lines maximum:

```rust
async fn create_token(
    AuthUser(user): AuthUser<Employee>,
    State(app): State<AppState>,
    ValidatedJson(body): ValidatedJson<AuthorizeRequest>,
) -> Result<Json<IssuedTokenResponse>, ApiError> {
    let mut tx = app.db.begin().await?;
    let account = directory::account_of_employee(&mut tx, user.id).await?;
    let token = payments::authorize(&mut tx, &*app.clock, &app.config,
                                    account, body.amount).await?;
    tx.commit().await?;
    Ok(Json(token.into()))
}
```

Routes: `GET /me/balance`, `GET /me/transactions`, `POST /me/payment-tokens`, `DELETE /me/payment-tokens/{jti}`, `GET /partner/summary`, `GET /partner/transactions`, `POST /partner/payments`, `POST /partner/payments/batch`.

The batch is the only special case: **one SQL transaction per line**, one status per item, a failing line does not bring down the batch.

#### `tests/invariants.rs` — **checkpoint 1**

```rust
#[sqlx::test] async fn i1_two_entries_summing_to_zero()
#[sqlx::test] async fn i2_cached_balance_matches_ledger()
#[sqlx::test] async fn i3_held_matches_active_tokens()
#[sqlx::test] async fn i4_balance_never_negative()          // expects an error
#[sqlx::test] async fn i5_held_within_settled()
#[sqlx::test] async fn i6_token_consumed_once()             // 2x settle -> 1 payment
#[sqlx::test] async fn i7_one_active_employment()           // expects an error
#[sqlx::test] async fn i8_entries_immutable()               // direct UPDATE -> error
#[sqlx::test] async fn i9_global_sum_is_zero()
```

**If these nine tests do not pass by H+6, everything else stops and Giscard switches to the ledger.**

---

### 4.2 Giscard's files

#### `Cargo.toml` (workspace) — **H+0, blocking for everyone**

Three members, common dependencies in `[workspace.dependencies]`: `tokio`, `axum 0.8`, `tower-http`, `sqlx 0.8`, `serde`, `thiserror`, `argon2`, `ed25519-dalek`, `sha2`, `subtle`, `chrono`, `uuid`, `rand`, `base64`, `tracing`, `validator`.

#### `core/src/lib.rs` — **written at H+0, never touched again**

```rust
pub mod ids; pub mod money; pub mod clock; pub mod error; pub mod config;
pub mod crypto; pub mod ledger; pub mod payments; pub mod identity;
pub mod directory; pub mod partners; pub mod funding; pub mod reporting;
```

Every module declared from the start, with files containing `todo!()`. **The project compiles from the first hour onwards**, and nobody has to modify this file again. That is what avoids merge conflicts at 3 a.m.

#### `api/src/state.rs`

```rust
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub clock: Arc<dyn Clock>,
    pub signing_key: Arc<SigningKey>,
    pub verifying_key: Arc<VerifyingKey>,
    pub config: CoreConfig,
}
```

#### `api/src/error.rs`

`CoreError` -> HTTP response. Full table in `data-dictionary.md` §6. Format:

```json
{ "error": "TOKEN_EXPIRED", "message": "...", "request_id": "..." }
```

**Never any SQL detail in the response.** `Db(_)` becomes `INTERNAL` / 500.

#### `api/src/routes/mod.rs` — **written at H+0, frozen**

```rust
pub fn router(state: AppState) -> Router {
    Router::new()
        .nest("/api/v1/auth",        auth::routes())
        .nest("/api/v1/me",          employee::routes().layer(session_auth()))
        .nest("/api/v1/partner",     partner::routes().layer(session_auth()))
        .nest("/api/v1/catalog",     catalog::routes().layer(session_auth()))
        .nest("/api/v1/admin",       admin::routes().layer(session_auth()))
        .nest("/api/v1/integration", integration::routes())
        .route("/health", get(|| async { "ok" }))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
```

Each module exposes `pub fn routes() -> Router<AppState>`. Sèdjro fills in `employee.rs` and `partner.rs` without ever touching this file.

#### `api/src/extractors/auth.rs` — **the most profitable piece of the night**

```rust
pub trait Role { const VALUE: UserRole; }
pub struct Employee; pub struct Partner; pub struct Admin;

pub struct AuthUser<R: Role>(pub AuthenticatedUser, PhantomData<R>);

impl<R: Role> FromRequestParts<AppState> for AuthUser<R> {
    // 1. read the "session" cookie
    // 2. hash it, look the session up, check expires_at and revoked_at
    // 3. load the user, check status == active
    // 4. if user.role != R::VALUE -> 403
}
```

RBAC becomes compile-time checked: a partner-space handler receiving `AuthUser<Employee>` does not compile.

#### `core/src/identity/`

```rust
// login.rs
pub async fn login(tx, clock, email, password, ip, ua) -> Result<String> {
    // WARNING: hash even if the user does not exist (compare against a dummy hash)
    //   otherwise the response time reveals which accounts exist
    // check status == active
    // create the session, return the plaintext token (the only moment it exists)
}

// session.rs
create_session   validate_session   revoke_session   revoke_all_for_user
```

The session token is **hashed in the database**, the plaintext lives only in the cookie. Cookie: `http_only`, `secure`, `SameSite=Strict`.

#### `core/src/directory/`

```rust
create_employee_with_account(tx, ...)   // users -> employees -> accounts -> employment_links
                                        // WARNING: this order, because of the FK cycle
resolve_account_by_ref(conn, employer, employer_ref) -> AccountId   // topup + HR system
account_of_employee(conn, user_id) -> AccountId                     // used by Sèdjro
list_cities(conn)
```

#### `core/src/partners/`

```rust
// registration.rs
submit_registration(tx, ...)   // users + accounts + partners in 'pending'
                               // validate service_mode / city_id consistency

// review.rs
approve(tx, admin, id)         // status, reviewed_by/at, + audit_log
reject(tx, admin, id, reason)

// catalog.rs
search(conn, city, service_mode, q, cursor, limit)
// WHERE status = 'approved'
// KEYSET pagination: WHERE (trade_name, id) > ($cursor) ORDER BY trade_name, id
// WARNING: never OFFSET (requirement 3.4)

// highlights.rs
add(tx, admin, partner, placement, position)   // refuses if the partner is not 'approved'
remove(tx, admin, id)                          // sets removed_at, does NOT DELETE
list(conn, placement)                          // JOIN filtering on status = 'approved'

// repo.rs
approved_account(tx, partner_id) -> AccountId  // <- CONTRACT with Sèdjro
```

#### `core/src/reporting/mod.rs`

Read-only. Three queries are enough for the demo:

```rust
partner_summary(conn, partner, from, to)  // SUM of credited payments -> total_received
                                          // WARNING: "received", never "balance"
national_dashboard(conn, from, to)        // volume, transaction count, active partners,
                                          // by_city + a separate online_partners block
employee_transactions(conn, account, cursor)
```

#### `api/src/routes/admin.rs`

`GET /admin/partners?status=pending` · `POST /admin/partners/{id}/approve` · `POST /admin/partners/{id}/reject` · `POST /admin/topups` · `GET /admin/highlights` · `POST /admin/highlights` · `DELETE /admin/highlights/{id}` · `GET /admin/dashboard` · `GET /admin/audit/verify`.

#### `scripts/seed.sql` — **underestimated, do not rush it**

One admin, two employers, four credited employees, six approved partners including one online, one pending partner to demonstrate approval, two highlights. Without this file, the demo starts with twenty minutes of manual data entry.

---

## 5. How the night runs

| Slot | Sèdjro | Giscard |
|---|---|---|
| **H+0 -> H+1** | `0001_schema.sql`, then `ids`, `money`, `clock` | workspace, `lib.rs`, `routes/mod.rs`, `main.rs`, `state.rs`, all files created with `todo!()` |
| **milestone H+1** | **`cargo run` answers on `/health`, migrations applied, everything compiles.** `ids`/`money`/`clock` delivered to Giscard. `approved_account` stub in place. | |
| **H+1 -> H+6** | the whole `ledger`, then `tests/invariants.rs` | `crypto/password`, `identity`, `extractors/auth`, `routes/auth`, `partners` registration + review |
| **milestone H+6** | **The 9 invariants pass.** Otherwise Giscard switches to the ledger and everything else waits. | |
| **H+6 -> H+10** | staggered rest: one sleeps 4 h while the other finishes their block, then swap | |
| **H+10 -> H+16** | `token_sig`, `short_code`, `authorize`, `settle`, `routes/employee`, `routes/partner` | `catalog`, `routes/admin`, `topup` wired in, `dto/*`, `seed.sql` |
| **milestone H+16** | **A full payment goes through over HTTP**: credit an account, generate a token, settle it, watch both balances move. | |
| **H+16 -> H+20** | `/payments/batch`, `/admin/audit/verify`, `tests/payments_flow.rs` | highlights, HR system, dashboard, `openapi.json` for the front end |
| **H+20** | **FREEZE. No more features.** | |
| **H+20 -> end** | demo seed, re-read the forbidden list, README, rehearse the walkthrough **three times** | |

**If time runs short at H+16:** cut the highlights and the dashboard first. Never cut the ledger tests.

---

## 6. Rules of coexistence

**Reserved files.** Nobody modifies someone else's file, not even for an import. You report it, the other fixes it.

**One branch each, merges at the milestones.** `feat/ledger` and `feat/api`. Merge at H+1, H+6, H+16. No merging between milestones, no `git push --force`.

**`cargo sqlx prepare --workspace` after every new SQL query.** Otherwise the other person's build breaks for no visible reason and you lose an hour looking for it.

> **Amendment.** This rule is void: the queries are checked at run time (`decisions.md`, departure 5). `.sqlx/` stays empty and there is nothing to regenerate.

**The `approved_account` stub** placed by Sèdjro at H+1 is removed by Giscard when `partners/repo.rs` is ready. Write it down somewhere, it is the kind of thing you forget.

**Decide at H+0**, not at 4 a.m.: is the `MINISTRY_ISSUANCE` system account allowed to go negative, or is it pre-credited in the seed?

---

## 7. Checklist before delivery

- [ ] The 9 invariants pass
- [ ] A direct `UPDATE` on `ledger_entries` does fail
- [ ] Two `settle` calls on the same `jti` by the same partner -> a single debit
- [ ] An expired token is refused according to the server clock
- [ ] Two concurrent `authorize` calls exceeding the balance -> the second fails
- [ ] No `f32`/`f64` anywhere on a money path
- [ ] No `axum` type in `crates/core`
- [ ] No `OFFSET` in any pagination
- [ ] Ed25519 signature, not HMAC
- [ ] No secret and no `short_code` in the logs
- [ ] `seed.sql` allows the full demo with no manual data entry
- [ ] The demo walkthrough has been rehearsed three times
