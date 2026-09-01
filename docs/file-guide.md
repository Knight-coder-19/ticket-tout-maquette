# CartePro — Guide fichier par fichier

> Les signatures données sont indicatives mais respectent les règles R1 à R9.
> Ordre de lecture conseillé : suivre l'ordre de ce document, il correspond à l'ordre de construction.
>
> **Version 1.1** — intègre les amendements A1 à A4 (voir `CLAUDE.md` §3.1).

**Légende de la colonne priorité :**
`P0` bloquant, à écrire en premier · `P1` cœur fonctionnel · `P2` complément · `P3` confort

---

## 1. `backend/` — racine du code

Le dépôt sépare le code de la documentation : tout ce qui suit vit sous `backend/`, tandis que
`docs/` et l'application de visualisation restent à la racine du dépôt, partagés par toute l'équipe.
Les chemins de ce document sont relatifs à `backend/`, sauf mention contraire.

| Fichier | Contenu |
|---|---|
| `Cargo.toml` | Workspace : `members = ["crates/core", "crates/api", "crates/worker"]`. Dépendances communes dans `[workspace.dependencies]`, les crates y référent par `workspace = true`. |
| `rust-toolchain.toml` | `channel = "stable"`. Fige la version pour toute l'équipe. |
| `.env.example` | Toutes les variables de la §10 de `CLAUDE.md`, valeurs de développement, secrets vides. Commité. `.env` ne l'est jamais. |
| `.sqlx/` | Généré par `cargo sqlx prepare --workspace`. À commiter, sinon la CI ne compile pas sans base. |
| `../docs/data-model.md` | Schéma détaillé et justifications. Hors de `backend/`. |
| `../docs/data-dictionary.md` | Contrat de nommage front/back. Hors de `backend/`. |
| `../docs/file-guide.md` | Ce fichier. Hors de `backend/`. |

---

## 2. `migrations/`

Le schéma tient en **un seul fichier**, `migrations/0001_schema.sql`, conformément à la répartition des tâches (`TASK-DISTRIBUTION-BACKEND.md` §4.1). Le découpage en douze migrations n'a de sens qu'une fois le schéma déployé quelque part : tant que rien n'a tourné, un fichier unique est plus simple à relire et à rejouer. `sqlx` refuse toute migration dont l'empreinte change après exécution, donc à partir du premier déploiement les corrections passeront par `0002_*.sql`, `0003_*.sql`, etc.

| Fichier | Contenu | Prio |
|---|---|---|
| `0001_schema.sql` | Extensions (`citext`, `pgcrypto`), les 13 énumérations, les 16 tables dans l'ordre de leurs dépendances, les `CHECK`, les index uniques partiels (`uq_active_employment`, `uq_active_short_code`, `uq_employer_ref`, les deux de `partner_highlights`, `uq_batch_file`), la fonction `forbid_mutation()` et ses déclencheurs sur `ledger_entries`, `ledger_operations` et `audit_log`, le rôle `cartepro_app` avec ses `GRANT`/`REVOKE`, et l'insertion des comptes système `MINISTRY_ISSUANCE` et `CLOSURE_FORFEIT`. | P0 |

> **Attention aux `REVOKE` :** une fois posés, les migrations doivent tourner avec un rôle différent de `cartepro_app`. D'où les deux `DATABASE_URL` de la §10.
>
> **Référentiel de villes :** l'insertion est absente tant que la question ouverte 1 du dictionnaire (référentiel français ou béninois) n'est pas tranchée.

---

## 3. `crates/core/` — le métier

### 3.1 Socle

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `lib.rs` | Déclaration et réexport des modules. Rien d'autre. | P0 |
| `config.rs` | `struct CoreConfig { token_ttl, resync_max_age, closure_grace, public_cache }`. Pas de lecture d'environnement ici, `api` la construit et l'injecte. | P0 |
| `clock.rs` | `trait Clock: Send + Sync { fn now(&self) -> DateTime<Utc>; }`, `SystemClock`, et `FixedClock { at: Mutex<DateTime<Utc>> }` avec `advance(Duration)` pour les tests. | P0 |
| `money.rs` | `struct Money(i64)` en **centimes d'euro**, champ privé. `try_new`, `checked_add`, `checked_sub`, `is_positive`, `zero`, `cents`, et `parse_euros(&str)` pour l'import CSV. `Display` rend `"456.56"`. `Serialize`/`Deserialize` convertissent aux frontières : euros décimaux en JSON, centimes en interne. `TryFrom<i64>` refusant le négatif. `sqlx::Type` transparent sur `BIGINT`. | P0 |
| `ids.rs` | Newtypes `AccountId`, `EmployeeId`, `EmployerId`, `PartnerId`, `OperationId`, `Jti`, `UserId`, `CityId`, `BatchId`, **`HighlightId`**. Écris une macro `newtype_id!` plutôt que dix blocs identiques. Chacun implémente `sqlx::Type`, `Serialize`, `Display`. | P0 |
| `error.rs` | `enum CoreError` agrégeant les erreurs de modules via `#[from]`. Le seul type que `api` a besoin de convertir. | P0 |

### 3.2 `crypto/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `password.rs` | `hash_password(&str) -> Result<String>`, `verify_password(&str, &str) -> Result<bool>`. argon2id, paramètres explicites. | P0 |
| `token_sig.rs` | `struct TokenPayload { jti, amt, exp, iss }`, `sign(&TokenPayload, &SigningKey) -> String`, `verify(&str, &VerifyingKey) -> Result<TokenPayload>`. **Ed25519, jamais HMAC** : le partenaire vérifie hors ligne avec la clé publique. Encodage canonique déterministe, format `CP1.<b64url payload>.<b64url sig>`. | P0 |
| `short_code.rs` | `generate_short_code(&mut impl Rng) -> String`. 8 caractères, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (ni `0`,`O`,`1`,`I`,`l`). Format d'affichage `XXXX-XXXX`. | P1 |

### 3.3 `ledger/` — le module critique

**Seul endroit du code qui écrit dans `accounts`, `ledger_operations` et `ledger_entries`.** À écrire en premier et à tester avant tout le reste.

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `mod.rs` | Voir signatures ci-dessous. | P0 |
| `hash.rs` | `const GENESIS_HASH: [u8; 32] = [0; 32];` et `fn entry_hash(seq, operation_id, account_id, direction, amount, recorded_at, prev_hash) -> [u8; 32]`. **Sérialisation canonique documentée en commentaire** : tout changement ultérieur invalide la chaîne existante. | P0 |
| `balance.rs` | `recompute_balance(conn, AccountId) -> Money`, `recompute_held(conn, AccountId) -> Money`, `verify_chain(conn, from_seq) -> Result<(), u64>` renvoyant le premier `seq` incohérent. Utilisé par les tests, le worker et `/admin/audit/verify`. | P0 |
| `repo.rs` | Les requêtes SQL. Aucune règle métier. | P0 |

```rust
pub struct Posting {
    pub debit: AccountId,
    pub credit: AccountId,
    pub amount: Money,
    pub occurred_at: DateTime<Utc>,
    pub memo: Option<String>,
    pub created_by: Option<UserId>,
}

/// Verrou global sérialisant le chaînage. À prendre AVANT tout verrou de compte.
pub async fn lock_chain(tx: &mut PgTransaction<'_>) -> Result<(), LedgerError>;

/// SELECT … FOR UPDATE sur le compte.
pub async fn lock_account(tx: &mut PgTransaction<'_>, id: AccountId)
    -> Result<Account, LedgerError>;

/// LE point d'entrée unique. Crée l'opération, les 2 écritures chaînées,
/// met à jour les caches de solde. Vérifie débit ≠ crédit et montant > 0.
pub async fn post_operation(
    tx: &mut PgTransaction<'_>,
    kind: OperationKind,
    posting: Posting,
) -> Result<LedgerOperation, LedgerError>;

/// Réserve des fonds (balance_held += amount). Échoue si disponible insuffisant.
pub async fn place_hold(tx: &mut PgTransaction<'_>, id: AccountId, amount: Money)
    -> Result<(), LedgerError>;

/// Libère une réservation.
pub async fn release_hold(tx: &mut PgTransaction<'_>, id: AccountId, amount: Money)
    -> Result<(), LedgerError>;
```

> `post_operation` ne prend jamais de `PgPool`, seulement une transaction en cours. C'est ce qui garantit qu'elle ne peut pas s'exécuter hors du verrou de l'appelant.

### 3.4 `payments/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `mod.rs` | Types `PaymentToken`, `Payment`, `TokenStatus`, `EntryMode`, `enum PaymentError`. Réexports. | P0 |
| `authorize.rs` | `authorize(tx, clock, config, account_id, amount) -> Result<IssuedToken, PaymentError>`. Verrouille le compte, vérifie statut et disponible, appelle `place_hold`, génère `jti` + `short_code`, insère le jeton, signe et renvoie `IssuedToken`. **Le futur plafond de la décision 8 s'insère ici.** | P0 |
| `settle.rs` | `settle(tx, clock, config, partner, jti_or_code, scanned_at) -> Result<Payment, PaymentError>`. Structure imposée : idempotence, verrous, contrôles, écriture. Voir §7 de `CLAUDE.md`. | P0 |
| `expire.rs` | `expire_stale_tokens(pool, clock) -> Result<u64>` : passe les jetons échus en `expired` et libère les holds, par lots. Appelé par le worker et paresseusement à la lecture de solde. | P1 |
| `repo.rs` | `find_payment_by_jti`, `lock_token`, `lock_token_by_short_code`, `consume_token`, `insert_payment`, `cancel_token`, `list_partner_payments`. | P0 |

Trois cas à distinguer dans les erreurs de `settle`, c'est ce dont dépend le client hors ligne :

| Situation | Retour |
|---|---|
| même partenaire, même `jti`, déjà réglé | `Ok(payment)` — le front retire la ligne de sa file |
| autre partenaire a consommé le jeton | `Err(TokenAlreadyUsed)` — le front signale |
| jeton expiré côté serveur | `Err(TokenExpired)` — le front signale |

### 3.5 `identity/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `mod.rs` | `struct AuthenticatedUser { id, role, status }`, `enum IdentityError`. | P0 |
| `login.rs` | `login(tx, clock, email, password, ip, ua) -> Result<SessionToken>`. Vérifie le mot de passe **même si l'utilisateur n'existe pas** (hachage à vide), pour ne pas révéler les comptes existants par le temps de réponse. Refuse si `status != active`. | P0 |
| `session.rs` | `create_session`, `validate_session(conn, token_hash, clock)`, `revoke_session`, `revoke_all_for_user` (appelé à la suspension d'un compte). | P0 |
| `repo.rs` | Requêtes `users` et `sessions`. | P0 |

### 3.6 `directory/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `mod.rs` | Types `Employee`, `Employer`, `EmploymentLink`, `City`, `enum DirectoryError`. | P1 |
| `employees.rs` | `create_employee_with_account(tx, …)` : crée `users`, `employees`, `accounts`, puis `employment_links` — dans cet ordre, à cause du cycle de FK. `resolve_by_employer_ref(conn, employer_id, ref)` pour le SIRH et l'import. | P1 |
| `employment.rs` | `end_employment(tx, clock, config, link_id)` : clôture le rattachement, puis le compte, puis émet l'opération `closure_forfeit` vers `CLOSURE_FORFEIT` si le solde est non nul, en respectant `closure_grace`. | P2 |
| `employers.rs` | CRUD employeurs. `UPDATE` autorisé ici, c'est du bloc identité. | P1 |
| `cities.rs` | `list_cities(conn)`. Lecture seule, servie aussi sur la surface publique. | P1 |
| `repo.rs` | Requêtes. | P1 |

### 3.7 `partners/` — *amendé par A1 et A2*

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `mod.rs` | `struct Partner`, `enum PartnerStatus`, **`enum ServiceMode`**, `enum PartnerError`. | P1 |
| `registration.rs` | `submit_registration(tx, …)` crée `users` + `accounts` + `partners` en statut `pending`. **A1 :** valide la cohérence `service_mode` / `city_id` avant l'insertion, en plus du `CHECK` en base. | P1 |
| `review.rs` | `approve(tx, admin, partner_id)`, `reject(tx, admin, partner_id, reason)`. Renseignent `reviewed_by`/`reviewed_at`/`review_reason` et écrivent dans `audit_log`. **`approve` doit aussi vérifier qu'aucune mise en avant n'existe pour un partenaire qui redeviendrait non éligible.** | P1 |
| `catalog.rs` | `search(conn, city, service_mode, query, cursor, limit)`. Filtre `status = 'approved'`. Pagination keyset sur `(trade_name, id)`. **A1 :** `service_mode` est un filtre optionnel ; un partenaire `online` remonte quel que soit le filtre ville. | P1 |
| **`highlights.rs`** | **A2.** Voir signatures ci-dessous. | P2 |
| `repo.rs` | `approved_account(tx, partner_id) -> Result<AccountId>` : erreur si le partenaire n'est pas `approved`. Appelée par `settle`. | P0 |

```rust
// core/src/partners/highlights.rs  — A2

/// Pose une mise en avant. Refuse si le partenaire n'est pas `approved`
/// (HighlightNotEligible) ou s'il l'est déjà à cet emplacement (HighlightDuplicate).
/// Écrit dans audit_log. position = None → ajoute en fin de liste.
pub async fn add(
    tx: &mut PgTransaction<'_>,
    admin: UserId,
    partner: PartnerId,
    placement: HighlightPlacement,
    position: Option<i32>,
) -> Result<Highlight, PartnerError>;

/// Retire une mise en avant : renseigne removed_at, ne supprime JAMAIS la ligne (R6).
/// Écrit dans audit_log.
pub async fn remove(tx: &mut PgTransaction<'_>, admin: UserId, id: HighlightId)
    -> Result<(), PartnerError>;

/// Réordonne l'ensemble d'un emplacement. Reçoit la liste complète des ids
/// dans l'ordre voulu. Les positions étant sous index unique partiel,
/// écrire en deux temps (décaler hors plage, puis réassigner) ou différer
/// la contrainte le temps de la transaction.
pub async fn reorder(
    tx: &mut PgTransaction<'_>,
    admin: UserId,
    placement: HighlightPlacement,
    ordered: &[HighlightId],
) -> Result<(), PartnerError>;

/// Lecture. `only_approved` est toujours vrai en pratique : un partenaire
/// suspendu après sa mise en avant ne doit plus apparaître.
pub async fn list(
    conn: &mut PgConnection,
    placement: HighlightPlacement,
) -> Result<Vec<HighlightWithPartner>, PartnerError>;
```

> **Piège de `reorder` :** l'index unique partiel sur `(placement, position)` interdit deux lignes de même position, y compris transitoirement pendant une permutation. Décale d'abord les positions concernées hors de la plage utilisée (par exemple en négatif), puis réassigne. Un test dédié pour la permutation de deux voisins.
>
> **Piège de `list` :** un partenaire mis en avant puis suspendu resterait affiché si la jointure ne filtre pas sur `status = 'approved'`. Le filtre est dans la requête, pas dans le code appelant.

### 3.8 `funding/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `mod.rs` | Types `Topup`, `TopupBatch`, `BatchStatus`, `enum FundingError`. | P1 |
| `topup.rs` | `topup(tx, admin, employer_id, account_id, amount, reference)` : `post_operation` depuis `MINISTRY_ISSUANCE`, puis `INSERT` dans `topups`. | P1 |
| `batch.rs` | `parse_and_stage(tx, admin, employer_id, file_name, bytes)` : empreinte SHA-256, refus des doublons, parsing, résolution des matricules, prévisualisation avec liste d'erreurs. Puis `validate_batch(tx, admin, batch_id)` produisant une opération par ligne. **Un lot avec une seule erreur est rejeté en entier.** | P2 |
| `csv.rs` | Parsing et validation de format. Colonnes : `matricule`, `montant`, `reference` optionnelle. Email accepté comme clé alternative. | P2 |
| `repo.rs` | Requêtes. | P1 |

### 3.9 `corrections/`, `reporting/`, `audit/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `corrections/mod.rs` | `compensate(tx, admin, original_operation_id, reason)` : lit l'opération d'origine, émet une opération inverse par `post_operation`, insère dans `compensations`. Refuse de compenser une compensation. | P2 |
| `reporting/mod.rs` | **Lecture seule uniquement.** `employee_balance`, `employee_transactions`, `partner_summary`, `partner_transactions`, `national_dashboard`. Raisonne sur `occurred_at`. **A1 :** le tableau de bord national doit produire un bloc `online_partners` séparé, sinon le volume des commerces sans ville disparaît et la somme des `by_city` ne vaut plus `total_volume`. | P2 |
| `audit/mod.rs` | `log(tx, actor, action, entity_type, entity_id, payload, ip)`. Insertion seule. | P1 |

---

## 4. `crates/api/` — la couche HTTP

### 4.1 Socle

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `main.rs` | Init `tracing`, lecture de l'environnement, construction de `AppState`, `PgPoolOptions`, montage du routeur, écoute sur `BIND_ADDR`, arrêt gracieux sur `SIGTERM`. Ne lance **pas** les migrations en production. | P0 |
| `state.rs` | `#[derive(Clone)] struct AppState { db: PgPool, clock: Arc<dyn Clock>, signing_key: Arc<SigningKey>, config: CoreConfig, env: Environment }`. Clonable à coût nul grâce aux `Arc`. | P0 |
| `error.rs` | `struct ApiError(CoreError)` + `impl IntoResponse`. Table de correspondance ci-dessous. Injecte le `request_id` dans chaque réponse d'erreur. | P0 |
| `openapi.rs` | Agrégation `utoipa`, Swagger UI sur `/docs` en développement uniquement. | P3 |

| Erreur métier | Statut | Code JSON |
|---|---|---|
| `UnknownToken` | 404 | `TOKEN_NOT_FOUND` |
| `TokenExpired` | 410 | `TOKEN_EXPIRED` |
| `TokenAlreadyUsed` | 409 | `TOKEN_ALREADY_USED` |
| `InsufficientFunds` | 422 | `INSUFFICIENT_FUNDS` |
| `PartnerNotApproved` | 403 | `PARTNER_NOT_APPROVED` |
| `AccountInactive` | 403 | `ACCOUNT_INACTIVE` |
| `HighlightNotEligible` | 422 | `HIGHLIGHT_NOT_ELIGIBLE` |
| `HighlightDuplicate` | 409 | `HIGHLIGHT_DUPLICATE` |
| `DuplicateBatch` | 409 | `DUPLICATE_BATCH` |
| `Unauthorized` | 401 | `UNAUTHORIZED` |
| `Db(_)` | 500 | `INTERNAL` — **jamais** le détail SQL dans la réponse |

### 4.2 `middleware/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `request_id.rs` | Génère ou reprend `X-Request-Id`, le place dans le span `tracing` et dans la réponse. | P1 |
| `security_headers.rs` | HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, CSP. Plus le refus des requêtes dont `X-Forwarded-Proto != https` hors développement. | P1 |
| `rate_limit.rs` | Limites différenciées : `/auth/login` par IP et par email ; `/partner/payments` par partenaire, strictement pour la saisie de `short_code` ; `/integration` par `api_client` ; **`/public` par IP, plus strictement que le reste (A3)**. Ne lit `X-Forwarded-For` que si la connexion vient de `TRUSTED_PROXY`. | P1 |
| `admin_audit.rs` | Sur le sous-arbre `/admin` : enregistre acteur, méthode, chemin, IP et statut dans `audit_log`, pour les requêtes ayant abouti. | P2 |

### 4.3 `extractors/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `auth.rs` | `trait Role { const VALUE: UserRole; }`, marqueurs `Employee`, `Partner`, `Admin`, et `struct AuthUser<R: Role>(pub AuthenticatedUser)` implémentant `FromRequestParts`. Lit le cookie, valide la session, compare le rôle, rejette en 401 ou 403. **C'est la pièce qui rend le RBAC vérifiable à la compilation.** | P0 |
| `api_client.rs` | `struct ApiClientAuth { client_id, employer_id }`. Lit l'en-tête d'autorisation, vérifie le secret haché, refuse hors HTTPS sans exception. | P2 |
| `validated.rs` | `struct ValidatedJson<T: Validate>(pub T)`. Désérialise puis valide le **format**. Jamais de règle métier ici. | P1 |
| `pagination.rs` | `struct Pagination { cursor: Option<Cursor>, limit: u32 }`. Curseur opaque base64 encapsulant `(valeur_de_tri, id)`. Limite plafonnée à 100. | P1 |

### 4.4 `dto/`

Un fichier par espace : `public.rs`, `employee.rs`, `partner.rs`, `admin.rs`, `catalog.rs`, `integration.rs`. C'est pour l'architecture.

Chacun contient les structures de requête et de réponse, avec `Serialize`/`Deserialize`, `utoipa::ToSchema`, et des `impl From<DomainType> for ResponseDto`.

**Règle :** les types de `core` ne sont jamais sérialisés directement. Un DTO est une décision d'exposition, pas un raccourci. Cela évite de divulguer un champ interne le jour où on l'ajoute au domaine.

**`dto/public.rs` mérite une vigilance particulière (règle R9).** Il ne contient qu'un seul type, `PublicPartner`, dont chaque champ est une décision explicite. Ne jamais y ajouter un `#[serde(flatten)]` ni réutiliser `CatalogItem` : c'est par là que fuiterait un champ non voulu.

Montants toujours en euros décimaux, deux décimales au maximum : `"amount": 456.56`. La conversion vers les centimes entiers du stockage est faite par `Money`, jamais dans un DTO ni dans un handler : aucun `* 100` ni `/ 100` ne doit apparaître ailleurs que dans `core/src/money.rs`.

### 4.5 `routes/`

| Fichier | Routes | Prio |
|---|---|---|
| `mod.rs` | Assemble les **cinq** sous-arbres avec leurs couches respectives, et la pile globale de middlewares dans l'ordre de la §9 de `CLAUDE.md`. | P0 |
| **`public.rs`** | **A3, sans authentification.** `GET /public/featured-partners`, `GET /public/cities`. Réponses identiques pour tout le monde, donc `Cache-Control: public, max-age=PUBLIC_CACHE_SECONDS`. Rate limiting strict. CORS distinct, sans credentials. Aucun extractor d'authentification dans les signatures. | P2 |
| `auth.rs` | `POST /auth/login`, `POST /auth/logout`. | P0 |
| `employee.rs` | `GET /me/balance`, `GET /me/transactions`, **`GET /me/minister-picks`**, `POST /me/payment-tokens`, `DELETE /me/payment-tokens/{jti}`. | P0 |
| `partner.rs` | `GET /partner/summary`, `GET /partner/transactions`, `POST /partner/payments`, `POST /partner/payments/batch`. | P0 |
| `catalog.rs` | `GET /catalog` (avec filtre `service_mode`), `GET /cities`. | P1 |
| `admin.rs` | Validation partenaires, suspension, **mises en avant (4 routes)**, rechargements, lots, compensations, tableau de bord, `GET /admin/audit/verify`. | P1 |
| `integration.rs` | `GET /integration/employees/{employer_ref}/balance`. Déduit l'`employer_id` de `ApiClientAuth`, jamais du chemin. | P2 |

Forme imposée d'un handler, sans exception :

```rust
async fn settle_payment(
    AuthUser(partner): AuthUser<Partner>,
    State(app): State<AppState>,
    ValidatedJson(body): ValidatedJson<SettleRequest>,
) -> Result<Json<PaymentResponse>, ApiError> {
    let mut tx = app.db.begin().await?;
    let payment = payments::settle(
        &mut tx, &*app.clock, &app.config,
        partner.into(), body.jti, body.scanned_at,
    ).await?;
    tx.commit().await?;
    Ok(Json(payment.into()))
}
```

Le lot de resynchronisation est le seul cas particulier : chaque ligne dans sa propre transaction, un statut par élément. Une ligne en échec ne fait jamais tomber le lot.

---

## 5. `crates/worker/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `main.rs` | Trois boucles `tokio::time::interval` : expiration des jetons (60 s), reprise des soldes des comptes clôturés hors délai de grâce (quotidien), vérification incrémentale de la chaîne de hash (horaire). Journalise chaque exécution. Binaire distinct de l'API : il peut tomber sans interrompre les paiements. | P2 |

---

## 6. `crates/tests/`

Les tests d'intégration vivent dans un paquet dédié, `crates/tests/`, membre du workspace. Placés à la racine de `backend/`, ils n'appartenaient à aucun paquet et Cargo ne les compilait jamais. Les fichiers ci-dessous sont donc sous `crates/tests/tests/`.

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `common/mod.rs` | `setup_db()` avec `testcontainers` ou `sqlx::test`, fabriques (`make_employee`, `make_approved_partner`, `make_online_partner`, `credit`), et un `FixedClock` partagé. | P0 |
| `invariants.rs` | Un test par invariant I1 à I9. **À écrire avant toute fonctionnalité.** I8 vérifie qu'un `UPDATE` direct sur `ledger_entries` échoue bien. | P0 |
| `payments_flow.rs` | Parcours nominal complet, solde insuffisant, partenaire suspendu, jeton annulé, compte clôturé. | P0 |
| `degraded_mode.rs` | Les cinq scénarios de la §12 de `CLAUDE.md`. C'est le fichier qui prouve l'exigence 2.2. | P0 |
| `rbac.rs` | Chaque espace refuse les rôles étrangers. Un employé ne peut pas appeler `/partner/payments`. | P1 |
| **`public_surface.rs`** | **A3.** La réponse ne contient aucun champ hors de la liste `PublicPartner` ; aucun partenaire non `approved` ; un partenaire suspendu après mise en avant disparaît ; le rate limiting répond 429 ; aucun cookie n'est requis. **A1 :** un partenaire `online` remonte sans ville. | P2 |

---

## 7. `deploy/`

| Fichier | Contenu attendu | Prio |
|---|---|---|
| `Caddyfile` | Terminaison TLS, `reverse_proxy 127.0.0.1:8080`, propagation de `X-Forwarded-Proto` et `X-Forwarded-For`. | P2 |
| `docker-compose.yml` | Services `db` (postgres:16), `caddy`, `api`, `worker`. En développement, `db` seul suffit. | P1 |
| `Dockerfile` | Build multi-étapes : `cargo chef` pour le cache des dépendances, image finale `debian:bookworm-slim`. Deux binaires produits. | P3 |

---

## 8. Message à donner à Claude Code pour la génération

Pour n'obtenir que l'arborescence, sans contenu :

> Crée l'arborescence complète décrite dans `docs/file-guide.md`, sous `backend/`. Génère les répertoires et les fichiers vides, à ces exceptions près : `Cargo.toml` du workspace et des trois crates avec leurs dépendances de la §4 de `CLAUDE.md` ; `rust-toolchain.toml` ; `.env.example` ; `.gitignore`. Chaque fichier `.rs` créé vide doit contenir uniquement un commentaire d'en-tête de deux lignes rappelant son rôle et sa priorité d'après ce guide. Ne génère aucune implémentation, aucun `struct`, aucune fonction. Les fichiers de `migrations/` sont pris en charge par Claude Code (voir §2).

---

## 9. Ordre de remplissage conseillé

```
1.  migrations/0001_schema.sql                 puis `cargo sqlx migrate run`
2.  core: ids, money, clock, error, config
3.  core/ledger: hash, repo, mod, balance
4.  crates/tests/tests/invariants.rs                       ← ne pas avancer tant que ça ne passe pas
5.  core/crypto: password, token_sig (Ed25519), short_code
6.  core/identity + api/extractors/auth.rs
7.  core/payments: authorize, settle
8.  tests/payments_flow.rs, tests/degraded_mode.rs
9.  api: state, error, routes/auth, routes/employee, routes/partner
10. core/directory, core/partners (registration, review, catalog) + routes
11. core/funding: topup puis batch
12. core/partners/highlights + routes admin + routes/public   ← A2, A3
13. tests/public_surface.rs
14. core/reporting + routes/admin (dashboard avec bloc online_partners)
15. core/corrections, api/routes/integration
16. worker
17. middlewares P1, deploy
```

L'étape 4 est le point de contrôle. Un ledger dont les invariants ne sont pas prouvés rend sans valeur tout ce qui se construit dessus.