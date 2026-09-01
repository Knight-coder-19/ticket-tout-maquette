# CartePro — Répartition backend

> **Sprint d'une nuit. Rendu demain soir.**
> Deux développeurs : **Sèdjro** (S) et **Giscard** (G).
> Ce document dit qui possède quel fichier, ce qu'il contient, et dans quel ordre.
> Les références `CLAUDE.md`, `data-dictionary.md` et `file-guide.md` restent la source pour le détail.

---

## 0. Le principe de la répartition

**Une seule personne touche à l'argent.**

Le ledger ne se parallélise pas : deux personnes qui écrivent dans la chaîne de hash produisent un chaînage cassé, et le bug ne se voit qu'en démo. Sèdjro possède tout le chemin monétaire de bout en bout. Giscard possède tout le reste, c'est-à-dire les trois quarts du code.

**Personne ne modifie un fichier qui ne lui appartient pas.** Même pour un `use` manquant. On signale, l'autre corrige.

---

## 1. Périmètre : ce qu'on garde, ce qu'on coupe

### Gardé

Ledger complet avec partie double et chaînage · `authorize` / `settle` avec réservation de fonds · authentification 3 rôles · inscription et validation des partenaires · catalogue paginé · rechargement unitaire admin · endpoint SIRH · tableau de bord minimal · mises en avant (A2).

### Coupé, avec la justification à donner au jury

| Coupé | Ce qu'on répond |
|---|---|
| Worker | Expiration des jetons traitée en paresseux à chaque lecture de solde |
| Import CSV en lot | Le rechargement unitaire démontre le mécanisme ; le lot est documenté |
| Compensations | Conçu et documenté, non implémenté |
| Clôture / reprise de solde | Documenté |
| Surface publique (A3) | Absente du cahier des charges, en attente de confirmation |
| File d'attente hors ligne | **Le backend est prêt** : réservation à l'émission, idempotence sur `token_jti`, endpoint `/payments/batch`. La file locale est un travail front. |
| Docker / Caddy | `cargo run` pour la démo |

Chaque coupe a un argument. C'est ce qui fait la différence entre « pas eu le temps » et « choix assumé ».

---

## 2. Propriété des fichiers

### Sèdjro — le chemin monétaire

```
migrations/0001_schema.sql          ← tout le schéma en un seul fichier
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

### Giscard — tout le reste

```
Cargo.toml  (workspace + 3 crates)
rust-toolchain.toml   .env.example   .gitignore
crates/core/src/lib.rs               ← figé à H+0, plus personne n'y touche
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
crates/api/src/routes/mod.rs         ← figé à H+0
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

## 3. Contrat d'interface — à figer à H+0

Ces cinq signatures sont ce que chacun attend de l'autre. **On les écrit dans les fichiers avec `todo!()` dès la première heure**, pour que tout compile et que personne n'attende.

```rust
// ── Giscard fournit, Sèdjro consomme ────────────────────────────
// partners/repo.rs — erreur si le partenaire n'est pas 'approved'
pub async fn approved_account(tx: &mut PgTransaction<'_>, id: PartnerId)
    -> Result<AccountId, PartnerError>;

// directory/employees.rs — résolution matricule → compte, pour topup et SIRH
pub async fn resolve_account_by_ref(
    conn: &mut PgConnection, employer: EmployerId, employer_ref: &str,
) -> Result<AccountId, DirectoryError>;

// extractors/auth.rs
pub struct AuthUser<R: Role>(pub AuthenticatedUser);

// ── Sèdjro fournit, Giscard consomme ────────────────────────────
// ids.rs, money.rs, clock.rs      → livrés à H+1, DEADLINE DURE
// ledger/mod.rs
pub async fn post_operation(tx: &mut PgTransaction<'_>, kind: OperationKind, p: Posting)
    -> Result<LedgerOperation, LedgerError>;

pub async fn lock_account(tx: &mut PgTransaction<'_>, id: AccountId)
    -> Result<Account, LedgerError>;
```

**Sèdjro bouchonne `approved_account` chez lui à H+1** avec un compte en dur, sinon il est bloqué toute la nuit sur `settle`. Giscard remplace le bouchon quand son `partners` est prêt.

---

## 4. Ce que contient chaque fichier

### 4.1 Fichiers de Sèdjro

#### `migrations/0001_schema.sql`

Tout le schéma en un fichier. Ordre imposé par les dépendances :

```
extensions (citext, pgcrypto)
enums (13 types, dont service_mode et highlight_placement)
cities, users, employers
accounts                      -- pas de FK sur owner_id
employees, employment_links, partners
payment_tokens
ledger_operations, ledger_entries
payments, topups
partner_highlights
sessions, api_clients, audit_log
triggers d'immuabilité + REVOKE
INSERT comptes système : MINISTRY_ISSUANCE, CLOSURE_FORFEIT
INSERT référentiel de villes
```

Copier les définitions depuis `data-model.md`. Ne pas oublier les index uniques partiels (`uq_active_employment`, `uq_active_short_code`, `uq_employer_ref`, les deux de `partner_highlights`) : ce sont eux qui portent les règles.

#### `core/src/ids.rs` — **à livrer à H+1**

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

#### `core/src/money.rs` — **à livrer à H+1**

```rust
pub struct Money(i64);          // francs entiers, jamais de flottant

impl Money {
    pub fn try_new(v: i64) -> Result<Self>       // refuse < 0
    pub fn checked_add(self, o: Money) -> Option<Money>
    pub fn checked_sub(self, o: Money) -> Option<Money>
    pub fn is_positive(self) -> bool
}
// Serialize/Deserialize → i64 brut. sqlx::Type transparent sur BIGINT.
```

#### `core/src/clock.rs` — **à livrer à H+1**

```rust
pub trait Clock: Send + Sync { fn now(&self) -> DateTime<Utc>; }
pub struct SystemClock;
pub struct FixedClock { at: Mutex<DateTime<Utc>> }   // + advance(Duration)
```

`FixedClock` est indispensable : sans lui, tester l'expiration à 5 minutes voudrait dire attendre 5 minutes.

#### `core/src/crypto/token_sig.rs`

**Ed25519, jamais HMAC.** Le partenaire doit pouvoir vérifier hors ligne avec la clé publique ; un HMAC l'obligerait à détenir la clé secrète du serveur, donc de quoi forger des jetons.

```rust
pub struct TokenPayload { jti: Jti, amt: i64, exp: DateTime<Utc>, iss: String }

pub fn sign(p: &TokenPayload, key: &SigningKey) -> String
// → "CP1." + b64url(json canonique) + "." + b64url(signature)

pub fn verify(s: &str, key: &VerifyingKey) -> Result<TokenPayload>
// découpe en 3, vérifie la signature AVANT de désérialiser
```

#### `core/src/ledger/hash.rs`

```rust
pub const GENESIS_HASH: [u8; 32] = [0u8; 32];

pub fn entry_hash(
    seq: i64, op: OperationId, acc: AccountId, dir: EntryDirection,
    amount: Money, recorded_at: DateTime<Utc>, prev: &[u8; 32],
) -> [u8; 32]
// SHA-256 sur une concaténation canonique.
// ⚠ DOCUMENTER LE FORMAT EN COMMENTAIRE : le changer plus tard
//   invalide toute la chaîne déjà écrite.
```

#### `core/src/ledger/mod.rs` — **le fichier le plus important du projet**

```rust
pub struct Posting {
    debit: AccountId, credit: AccountId, amount: Money,
    occurred_at: DateTime<Utc>, memo: Option<String>, created_by: Option<UserId>,
}

pub async fn lock_chain(tx) -> Result<()> {
    // SELECT pg_advisory_xact_lock(42)
    // sérialise le chaînage ; relâché au COMMIT/ROLLBACK
}

pub async fn lock_account(tx, id) -> Result<Account> {
    // SELECT * FROM accounts WHERE id = $1 FOR UPDATE
}

pub async fn post_operation(tx, kind, p: Posting) -> Result<LedgerOperation> {
    // 1. vérifier debit != credit, amount > 0
    // 2. INSERT ledger_operations
    // 3. lire le dernier (seq, hash) → prev
    // 4. INSERT écriture DEBIT  : hash = entry_hash(...)
    // 5. INSERT écriture CREDIT : prev = hash précédent
    // 6. UPDATE accounts : debit.settled -= amount ; credit.settled += amount
    //                      version += 1 sur les deux
    // → l'appelant a DÉJÀ pris lock_chain et lock_account
}

pub async fn place_hold(tx, id, amount) -> Result<()> {
    // vérifie settled - held >= amount, sinon InsufficientFunds
    // UPDATE accounts SET balance_held = balance_held + amount
}

pub async fn release_hold(tx, id, amount) -> Result<()>
```

#### `core/src/ledger/balance.rs`

```rust
pub async fn recompute_balance(conn, id) -> Money
// SUM(CASE direction WHEN 'credit' THEN amount ELSE -amount END)

pub async fn recompute_held(conn, id) -> Money
// SUM(amount) des payment_tokens actifs et non expirés

pub async fn verify_chain(conn, from_seq) -> Result<(), i64>
// rejoue la chaîne, renvoie le premier seq incohérent
```

#### `core/src/payments/authorize.rs`

```rust
pub async fn authorize(tx, clock, config, account_id, amount) -> Result<IssuedToken> {
    let acc = ledger::lock_account(tx, account_id)?;      // 1. verrou
    if acc.status != Active { return Err(AccountInactive) }
    ledger::place_hold(tx, account_id, amount)?;          // 2. réservation
                                                          //    (← futur plafond ICI)
    let jti  = Jti::new();
    let code = short_code::generate();                    // 3. jeton
    INSERT payment_tokens (jti, account_id, amount, code,
                           expires_at = now + config.token_ttl);
    let payload = TokenPayload { jti, amt, exp, iss };
    Ok(IssuedToken { jti, code, amount, expires_at, qr: sign(&payload, key) })
}
```

#### `core/src/payments/settle.rs` — **l'ordre est la protection**

```rust
pub async fn settle(tx, clock, partner, jti_or_code, scanned_at) -> Result<Payment> {

    // 1. IDEMPOTENCE — avant tout le reste
    if let Some(p) = repo::find_payment_by_jti(tx, jti)? {
        if p.partner_id == partner { return Ok(p); }      // rejeu → succès
        return Err(TokenAlreadyUsed);                      // autre → erreur
    }

    // 2. VERROUS
    ledger::lock_chain(tx)?;
    let token = repo::lock_token(tx, jti)?.ok_or(UnknownToken)?;
    let acc   = ledger::lock_account(tx, token.account_id)?;

    // 3. CONTRÔLES — jamais avant le verrou
    if token.status != Active          { return Err(TokenAlreadyUsed) }
    if token.expires_at <= clock.now() { return Err(TokenExpired) }     // horloge SERVEUR
    if acc.status != Active            { return Err(AccountInactive) }
    let partner_acc = partners::approved_account(tx, partner)?;

    // 4. ÉCRITURE
    let op = ledger::post_operation(tx, Payment, Posting {
        debit: token.account_id, credit: partner_acc,
        amount: token.amount, occurred_at: scanned_at,
    })?;
    ledger::release_hold(tx, token.account_id, token.amount)?;  // le hold devient réel
    repo::consume_token(tx, jti, op.id)?;
    repo::insert_payment(tx, op.id, jti, partner, entry_mode, scanned_at)
}
```

> **Le piège :** un contrôle de solde placé avant le verrou ne protège de rien. Entre la lecture et l'écriture, une autre requête passe. C'est le cas du double QR, il ne se voit qu'avec deux utilisateurs simultanés.

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

> Le compte système peut devenir négatif : c'est normal, c'est la source d'émission. La contrainte `balance_settled >= 0` doit être levée pour `owner_type = 'system'` ou ce compte pré-crédité d'un très gros montant au seed. **Choisir maintenant, pas à 4 h du matin.**

#### `api/src/routes/employee.rs` et `partner.rs`

Handlers de la forme imposée, quinze lignes maximum :

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

Routes : `GET /me/balance`, `GET /me/transactions`, `POST /me/payment-tokens`, `DELETE /me/payment-tokens/{jti}`, `GET /partner/summary`, `GET /partner/transactions`, `POST /partner/payments`, `POST /partner/payments/batch`.

Le batch est le seul cas particulier : **une transaction SQL par ligne**, un statut par élément, une ligne en échec ne fait pas tomber le lot.

#### `tests/invariants.rs` — **le point de contrôle 1**

```rust
#[sqlx::test] async fn i1_two_entries_summing_to_zero()
#[sqlx::test] async fn i2_cached_balance_matches_ledger()
#[sqlx::test] async fn i3_held_matches_active_tokens()
#[sqlx::test] async fn i4_balance_never_negative()          // attend une erreur
#[sqlx::test] async fn i5_held_within_settled()
#[sqlx::test] async fn i6_token_consumed_once()             // 2× settle → 1 paiement
#[sqlx::test] async fn i7_one_active_employment()           // attend une erreur
#[sqlx::test] async fn i8_entries_immutable()               // UPDATE direct → erreur
#[sqlx::test] async fn i9_global_sum_is_zero()
```

**Si ces neuf tests ne passent pas à H+6, tout le reste s'arrête et Giscard bascule sur le ledger.**

---

### 4.2 Fichiers de Giscard

#### `Cargo.toml` (workspace) — **H+0, bloquant pour tout le monde**

Trois membres, dépendances communes en `[workspace.dependencies]` : `tokio`, `axum 0.8`, `tower-http`, `sqlx 0.8`, `serde`, `thiserror`, `argon2`, `ed25519-dalek`, `sha2`, `subtle`, `chrono`, `uuid`, `rand`, `base64`, `tracing`, `validator`.

#### `core/src/lib.rs` — **écrit à H+0, plus jamais touché**

```rust
pub mod ids; pub mod money; pub mod clock; pub mod error; pub mod config;
pub mod crypto; pub mod ledger; pub mod payments; pub mod identity;
pub mod directory; pub mod partners; pub mod funding; pub mod reporting;
```

Tous les modules déclarés dès le départ, avec des fichiers contenant `todo!()`. **Le projet compile dès la première heure**, et plus personne n'a à modifier ce fichier ensuite. C'est ce qui évite les conflits de fusion à 3 h du matin.

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

`CoreError` → réponse HTTP. Table complète dans `data-dictionary.md` §6. Format :

```json
{ "error": "TOKEN_EXPIRED", "message": "…", "request_id": "…" }
```

**Jamais de détail SQL dans la réponse.** `Db(_)` devient `INTERNAL` / 500.

#### `api/src/routes/mod.rs` — **écrit à H+0, figé**

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

Chaque module expose `pub fn routes() -> Router<AppState>`. Sèdjro remplit `employee.rs` et `partner.rs` sans jamais toucher à ce fichier.

#### `api/src/extractors/auth.rs` — **la pièce la plus rentable de la nuit**

```rust
pub trait Role { const VALUE: UserRole; }
pub struct Employee; pub struct Partner; pub struct Admin;

pub struct AuthUser<R: Role>(pub AuthenticatedUser, PhantomData<R>);

impl<R: Role> FromRequestParts<AppState> for AuthUser<R> {
    // 1. lire le cookie "session"
    // 2. hacher, chercher la session, vérifier expires_at et revoked_at
    // 3. charger l'utilisateur, vérifier status == active
    // 4. si user.role != R::VALUE → 403
}
```

Le RBAC devient vérifié à la compilation : un handler d'espace partenaire qui recevrait `AuthUser<Employee>` ne compile pas.

#### `core/src/identity/`

```rust
// login.rs
pub async fn login(tx, clock, email, password, ip, ua) -> Result<String> {
    // ⚠ hacher même si l'utilisateur n'existe pas (compare avec un hash bidon)
    //   sinon le temps de réponse révèle les comptes existants
    // vérifier status == active
    // créer la session, renvoyer le jeton en clair (seul moment où il existe)
}

// session.rs
create_session   validate_session   revoke_session   revoke_all_for_user
```

Le jeton de session est **haché en base**, le clair ne vit que dans le cookie. Cookie : `http_only`, `secure`, `SameSite=Strict`.

#### `core/src/directory/`

```rust
create_employee_with_account(tx, ...)   // users → employees → accounts → employment_links
                                        // ⚠ cet ordre, à cause du cycle de FK
resolve_account_by_ref(conn, employer, employer_ref) -> AccountId   // topup + SIRH
account_of_employee(conn, user_id) -> AccountId                     // utilisé par Sèdjro
list_cities(conn)
```

#### `core/src/partners/`

```rust
// registration.rs
submit_registration(tx, ...)   // users + accounts + partners en 'pending'
                               // valider la cohérence service_mode / city_id

// review.rs
approve(tx, admin, id)         // status, reviewed_by/at, + audit_log
reject(tx, admin, id, reason)

// catalog.rs
search(conn, city, service_mode, q, cursor, limit)
// WHERE status = 'approved'
// pagination KEYSET : WHERE (trade_name, id) > ($cursor) ORDER BY trade_name, id
// ⚠ jamais OFFSET (exigence 3.4)

// highlights.rs
add(tx, admin, partner, placement, position)   // refuse si partenaire non 'approved'
remove(tx, admin, id)                          // renseigne removed_at, ne SUPPRIME PAS
list(conn, placement)                          // JOIN filtrant status = 'approved'

// repo.rs
approved_account(tx, partner_id) -> AccountId  // ← CONTRAT avec Sèdjro
```

#### `core/src/reporting/mod.rs`

Lecture seule. Trois requêtes suffisent pour la démo :

```rust
partner_summary(conn, partner, from, to)  // SUM des paiements crédités → total_received
                                          // ⚠ "encaissé", jamais "solde"
national_dashboard(conn, from, to)        // volume, nb transactions, partenaires actifs,
                                          // by_city + bloc online_partners séparé
employee_transactions(conn, account, cursor)
```

#### `api/src/routes/admin.rs`

`GET /admin/partners?status=pending` · `POST /admin/partners/{id}/approve` · `POST /admin/partners/{id}/reject` · `POST /admin/topups` · `GET /admin/highlights` · `POST /admin/highlights` · `DELETE /admin/highlights/{id}` · `GET /admin/dashboard` · `GET /admin/audit/verify`.

#### `scripts/seed.sql` — **sous-estimé, à ne pas bâcler**

Un admin, deux employeurs, quatre employés crédités, six partenaires approuvés dont un en ligne, un partenaire en attente pour démontrer la validation, deux mises en avant. Sans ce fichier, la démo commence par vingt minutes de saisie manuelle.

---

## 5. Déroulé de la nuit

| Créneau | Sèdjro | Giscard |
|---|---|---|
| **H+0 → H+1** | `0001_schema.sql`, puis `ids`, `money`, `clock` | workspace, `lib.rs`, `routes/mod.rs`, `main.rs`, `state.rs`, tous les fichiers créés avec `todo!()` |
| **jalon H+1** | **`cargo run` répond sur `/health`, migrations passées, tout compile.** `ids`/`money`/`clock` livrés à Giscard. Bouchon `approved_account` posé. | |
| **H+1 → H+6** | `ledger` en entier, puis `tests/invariants.rs` | `crypto/password`, `identity`, `extractors/auth`, `routes/auth`, `partners` registration + review |
| **jalon H+6** | **Les 9 invariants passent.** Sinon Giscard bascule sur le ledger et tout le reste attend. | |
| **H+6 → H+10** | repos décalé : l'un dort 4 h pendant que l'autre finit son bloc, puis on inverse | |
| **H+10 → H+16** | `token_sig`, `short_code`, `authorize`, `settle`, `routes/employee`, `routes/partner` | `catalog`, `routes/admin`, `topup` branché, `dto/*`, `seed.sql` |
| **jalon H+16** | **Un paiement complet passe par HTTP** : créditer, générer un jeton, l'encaisser, voir les deux soldes bouger. | |
| **H+16 → H+20** | `/payments/batch`, `/admin/audit/verify`, `tests/payments_flow.rs` | highlights, SIRH, tableau de bord, `openapi.json` pour le front |
| **H+20** | **GEL. Plus aucune fonctionnalité.** | |
| **H+20 → fin** | seed de démo, relecture des interdits, README, répétition du parcours **trois fois** | |

**Si le temps manque à H+16 :** couper d'abord les highlights et le tableau de bord. Ne jamais couper les tests du ledger.

---

## 6. Règles de coexistence

**Fichiers réservés.** Personne ne modifie un fichier de l'autre, même pour un import. On signale, l'autre corrige.

**Une branche chacun, fusion aux jalons.** `feat/ledger` et `feat/api`. Fusion à H+1, H+6, H+16. Pas de fusion entre les jalons, pas de `git push --force`.

**`cargo sqlx prepare --workspace` après chaque nouvelle requête SQL.** Sinon la compilation de l'autre casse sans raison apparente et vous perdez une heure à chercher.

**Le bouchon `approved_account`** posé par Sèdjro à H+1 est supprimé par Giscard quand `partners/repo.rs` est prêt. Le noter quelque part, c'est le genre de chose qu'on oublie.

**Décider à H+0**, pas à 4 h du matin : le compte système `MINISTRY_ISSUANCE` est-il autorisé à devenir négatif, ou pré-crédité au seed ?

---

## 7. Liste de vérification avant le rendu

- [ ] Les 9 invariants passent
- [ ] Un `UPDATE` direct sur `ledger_entries` échoue bien
- [ ] Deux `settle` du même `jti` par le même partenaire → un seul débit
- [ ] Un jeton expiré est refusé selon l'horloge serveur
- [ ] Deux `authorize` concurrents dépassant le solde → le second échoue
- [ ] Aucun `f32`/`f64` sur un chemin monétaire
- [ ] Aucun type `axum` dans `crates/core`
- [ ] Aucun `OFFSET` dans une pagination
- [ ] Signature Ed25519, pas HMAC
- [ ] Aucun secret ni `short_code` dans les logs
- [ ] `seed.sql` permet la démo complète sans saisie manuelle
- [ ] Le parcours de démo a été répété trois fois