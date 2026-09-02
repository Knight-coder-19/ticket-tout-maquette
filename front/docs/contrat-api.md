# Contrat d'API front / back — audit de lecture

> Audit de **lecture seule**. Aucun fichier du back ni du front n'a été modifié.
> Ce document est le seul écrit.

## Périmètre exact de l'audit

| Élément | Valeur |
|---|---|
| Dépôt | `G-SVR-500-COT-5-1-survivor-21` |
| Back lu sur | branche **`front`**, commit `a2b8ce7` |
| Front lu sur | **copie de travail**, branche `admin`, commit `16106e3` |
| Date | 2026-09-02 |

Deux avertissements de méthode, à lire avant le reste :

1. **Le répertoire `backend/` n'existe que sur trois branches** : `develop`, `front`
   et les branches `origin/feat/*`. Il est absent de `main`, `admin` et `partener`.
   `git diff develop front -- backend` ne rend aucune ligne : le back est identique
   partout où il existe. Le front, lui, est plus avancé sur `admin`/`partener` que sur
   `front`. Il n'existe donc **aucune branche portant à la fois le back et le front à
   jour** — l'audit croise deux points du dépôt, et c'est déjà en soi un constat.
2. La copie de travail a changé de branche **pendant** l'audit (`front` → `admin`,
   reflog `HEAD@{0}`). Le back a donc été lu via `git show front:<chemin>`, sans
   toucher à l'arbre de travail.

---

## 1. Le back : framework, point d'entrée, déclaration des routes

| Question | Réponse | Source |
|---|---|---|
| Langage | Rust, édition 2021, workspace de 4 crates (`core`, `api`, `worker`, `tests`) | `backend/Cargo.toml:1-7` |
| Framework web | **axum 0.8**, avec `axum-extra` (cookie, typed-header), `tower-http` (trace, cors, set-header, request-id, compression) | `backend/Cargo.toml:19-23` |
| Base de données | PostgreSQL via `sqlx 0.8` (postgres, uuid, chrono, macros, migrate) | `backend/Cargo.toml:26-35` |
| OpenAPI | `utoipa 5` + `utoipa-swagger-ui 9` | `backend/Cargo.toml:66-67` |
| Point d'entrée | `backend/crates/api/src/main.rs` | — |
| Déclaration des routes | `backend/crates/api/src/routes/*.rs`, un module par espace, assemblés dans `routes/mod.rs` | `backend/crates/api/src/routes/mod.rs:1-3` |

### Constat principal : **le back n'expose aujourd'hui aucune route**

Tous les fichiers de la crate `api` sont des **fichiers de commentaires**, sans une
seule ligne de Rust exécutable. Vérification par comptage :

```
crates/api/src/main.rs            3 lignes  (3 lignes de commentaire)
crates/api/src/routes/mod.rs      3 lignes  (3 lignes de commentaire)
crates/api/src/routes/auth.rs     3 lignes  ...
```

Les 27 fichiers de `crates/api/src/` totalisent **81 lignes**, toutes en `//`.
Il n'y a ni `Router::new()`, ni `.route(`, ni `async fn` handler, ni `struct` DTO.
`crates/api` n'a d'ailleurs pas de `Cargo.toml` propre lisible dans l'arbre — seul
le workspace le déclare comme membre (`backend/Cargo.toml:3`).

Côté `core`, seuls **6 fichiers sur 39** sont implémentés :
`lib.rs` (9 l.), `config.rs` (16 l.), `clock.rs` (55 l.), `error.rs` (56 l.),
`ids.rs` (85 l.), `money.rs` (195 l.). Tout le reste (`payments/`, `ledger/`,
`identity/`, `partners/`, `funding/`, `directory/`, `audit/`, `corrections/`,
`reporting/`) est en commentaires de 2 à 3 lignes.

Les migrations SQL, elles, sont **réelles** : `backend/migrations/0001_schema.sql`
(16 `CREATE TYPE`, 18 `CREATE TABLE`) et `0002_cities.sql` (jeu de communes).

**Conséquence pour la suite du document :** le tableau des routes ci-dessous ne
décrit pas ce que le back *expose*, mais ce que le dépôt *spécifie*. Les sources
sont nommées à chaque ligne. Là où la spécification se contredit ou se tait, c'est
écrit comme tel, jamais comblé.

---

## 2. Tableau des routes

### 2.1 Statut de chaque route

Aucune des routes ci-dessous n'est implémentée. La colonne « Déclarée dans »
distingue trois niveaux de source :

- **stub** — le nom de la route est écrit dans un commentaire de `crates/api/src/routes/*.rs` (c'est du code, mais inerte)
- **dico** — la forme des payloads vient de `docs/data-dictionary.md` §4
- **guide** — la table des routes de `docs/file-guide.md` §4.5

Le préfixe `/api/v1` vient de `docs/TASK-DISTRIBUTION-BACKEND.md:432-438`
(esquisse de `routes/mod.rs`) et de `docs/data-dictionary.md` §4. Il **n'apparaît
dans aucun fichier `.rs`** : les stubs écrivent les chemins sans préfixe
(`GET /me/balance`, `POST /partner/payments`…).

### 2.2 Surface publique — sans authentification (amendement A3)

| Méthode + chemin | Requête | Réponse succès | Erreurs | Auth | Déclarée dans |
|---|---|---|---|---|---|
| `GET /api/v1/public/featured-partners` | aucune | `200` — `PublicPartner[]` : `id` (string), `trade_name` (string), `category` (string), `service_mode` (`"physical"\|"online"\|"both"`), `city` (`CityRef\|null`, null si `online`), `district` (`string\|null`), `website_url` (`string\|null`), `position` (number) | `429 RATE_LIMITED` | **aucune**, aucun cookie requis | dico `data-dictionary.md:339-345` ; stub `routes/public.rs:1-3` ; guide `file-guide.md:284` |
| `GET /api/v1/public/cities` | aucune | `200` — `CityRef[]` : `{ id, name, department }` | `429` | aucune | dico `data-dictionary.md:352-353` |

En-têtes imposés sur ce sous-arbre : `Cache-Control: public, max-age=PUBLIC_CACHE_SECONDS`,
politique CORS **distincte, sans credentials** (`routes/public.rs:2-3`).
Champs explicitement interdits ici : montants, statistiques, `legal_name`, `ifu`,
adresse précise, contacts, dates de validation (`data-dictionary.md:356`).

### 2.3 Authentification

| Méthode + chemin | Requête | Réponse succès | Erreurs | Auth | Déclarée dans |
|---|---|---|---|---|---|
| `POST /api/v1/auth/login` | `{ email: string, password: string }` — les deux obligatoires | `200` — `{ user: { id, email, role: "employee"\|"partner"\|"admin", display_name } }`. **Le jeton de session n'est jamais dans le corps** : il est posé en cookie `HttpOnly`. | `401 UNAUTHORIZED`, `422 VALIDATION_FAILED`, `429 RATE_LIMITED` (limite par IP **et** par email) | aucune | dico `data-dictionary.md:361-366` ; stub `routes/auth.rs:1-3` |
| `POST /api/v1/auth/logout` | aucune | `204`, cookie effacé | `401` | cookie de session | dico `data-dictionary.md:368` |

Cookie : nom **`session`**, attributs `HttpOnly`, `Secure`, `SameSite=Strict`, `path="/"`.
Sources : `routes/auth.rs:2` (attributs), `TASK-DISTRIBUTION-BACKEND.md:456` (le nom),
`TASK-DISTRIBUTION-BACKEND.md:480`. Le jeton est **haché en base**
(`migrations/0001_schema.sql:241` — `token_hash BYTEA NOT NULL UNIQUE`), le clair ne
vit que dans le cookie.

### 2.4 Espace employé — `AuthUser<Employee>`

| Méthode + chemin | Requête | Réponse succès | Erreurs | Auth | Déclarée dans |
|---|---|---|---|---|---|
| `GET /api/v1/me/balance` | aucune | `200` — `{ settled: number, held: number, available: number, currency: string }`. `available = settled - held`, **c'est ce nombre qui s'affiche en grand**. | `401`, `403 ACCOUNT_INACTIVE` | cookie session, rôle `employee` | dico `data-dictionary.md:374-379` |
| `GET /api/v1/me/transactions?cursor=&limit=` | `cursor` (string opaque, optionnel), `limit` (number, optionnel, **plafonné à 100**) | `200` — `Paginated<EmployeeTransaction>` = `{ items: [...], next_cursor: string\|null }`. `EmployeeTransaction` : `id`, `kind` (`topup\|payment\|compensation\|closure_forfeit`), `amount` (number), `direction` (`"in"\|"out"`), `counterparty` (string), `occurred_at` (string ISO), `reference` (`string\|null`) | `401`, `422` | cookie session, `employee` | dico `data-dictionary.md:382-387` ; pagination `file-guide.md:265` |
| `GET /api/v1/me/minister-picks` | aucune | `200` — `MinisterPick[]` = `{ partner: CatalogItem, position: number }[]` | `401` | cookie session, `employee` | dico `data-dictionary.md:394-398` (amendement A2) |
| `POST /api/v1/me/payment-tokens` | `{ amount: number }` — **obligatoire**, euros décimaux, 2 décimales max, > 0 | `200`/`201` (statut non écrit) — `{ jti: string, short_code: string, amount: number, issued_at: string, expires_at: string, qr_payload: string }`. `expires_at = issued_at + 5 min`. `qr_payload` s'encode **tel quel**, sans transformation. | `401`, `403 ACCOUNT_INACTIVE`, `422 INSUFFICIENT_FUNDS`, `422 VALIDATION_FAILED` | cookie session, `employee` | dico `data-dictionary.md:401-409` ; stub `routes/employee.rs:1` |
| `DELETE /api/v1/me/payment-tokens/{jti}` | `jti` en chemin (UUID) | `204` | `401`, `404 TOKEN_NOT_FOUND` | cookie session, `employee` | dico `data-dictionary.md:412` |

⚠️ **Le statut HTTP de `POST /me/payment-tokens` n'est écrit nulle part.** Le
dictionnaire ne l'annote pas, contrairement aux `→ 204` explicites des routes
voisines. Ambiguïté relevée à `docs/data-dictionary.md:401`.

Le montant est **fixé à l'émission du jeton, par le salarié** — pas à la caisse.
Le back réserve alors les fonds (`held`), et `settle` ne prend aucun montant :
`core/src/payments/authorize.rs:1-3` et `core/src/payments/settle.rs:1-3`.

### 2.5 Espace partenaire — `AuthUser<Partner>`

| Méthode + chemin | Requête | Réponse succès | Erreurs | Auth | Déclarée dans |
|---|---|---|---|---|---|
| `GET /api/v1/partner/summary?from=&to=` | `from`, `to` (dates, optionnalité non écrite) | `200` — `{ total_received: number, transaction_count: number, period_from: string, period_to: string, is_official_partner: boolean }`. `total_received` n'est **pas** un solde. | `401`, `403 PARTNER_NOT_APPROVED` | cookie session, `partner` | dico `data-dictionary.md:418-424` |
| `GET /api/v1/partner/transactions?from=&to=&cursor=` | `from`, `to`, `cursor` | `200` — `PartnerTransaction` : `id`, `amount` (number), `entry_mode` (`"qr_scan"\|"short_code"`), `occurred_at`, `synced_at`, `customer_label` (`"K. A."` — **jamais le nom complet**). L'enveloppe n'est pas annotée `Paginated<T>` bien qu'un `cursor` soit accepté. | `401`, `403` | cookie session, `partner` | dico `data-dictionary.md:427-434` |
| `POST /api/v1/partner/payments` | `{ jti: string\|null, short_code: string\|null, scanned_at: string }` — **exactement un** de `jti`/`short_code`. `scanned_at` = horodatage local, indicatif. **Aucun champ `amount`.** | `200` — `{ id, jti, amount, entry_mode, occurred_at, synced_at, status: "settled" }`. Un rejeu par le **même** partenaire renvoie `200` avec la transaction existante. | `404 TOKEN_NOT_FOUND`, `410 TOKEN_EXPIRED`, `409 TOKEN_ALREADY_USED` (autre partenaire), `403 PARTNER_NOT_APPROVED`, `403 ACCOUNT_INACTIVE`, `429` | cookie session, `partner` | dico `data-dictionary.md:437-450`, idempotence `:645` |
| `POST /api/v1/partner/payments/batch` | `{ items: SettleRequest[] }` | `200` — `{ results: [{ jti, status: "settled"\|"failed", payment: PaymentResponse\|null, error: string\|null }] }`. **Une ligne en échec ne fait jamais tomber le lot.** | `401`, `403`, `422 ResyncTooLate` (délai `RESYNC_MAX_AGE_HOURS`) | cookie session, `partner` | dico `data-dictionary.md:453-462` ; stub `routes/partner.rs:2-3` |

### 2.6 Catalogue — tout utilisateur authentifié

| Méthode + chemin | Requête | Réponse succès | Erreurs | Auth | Déclarée dans |
|---|---|---|---|---|---|
| `GET /api/v1/catalog?city=&service_mode=&q=&cursor=` | tous optionnels ; `service_mode` ∈ `physical\|online\|both` | `200` — `Paginated<CatalogItem>`. `CatalogItem` : `id`, `trade_name`, `category`, `service_mode`, `city` (`CityRef\|null`), `district`, `address_line`, `website_url`, `is_official_partner` (boolean, dérivé de `status === "approved"`) | `401`, `422` | cookie session (rôle non contraint) | dico `data-dictionary.md:469-479` ; stub `routes/catalog.rs:1-3` |
| `GET /api/v1/cities` | aucune | `200` — `CityRef[]` | `401` | cookie session | dico `data-dictionary.md:483` |

Filtre serveur : `status = 'approved'` uniquement ; pagination keyset sur
`(trade_name, id)` ; un partenaire `online` remonte quel que soit le filtre ville
(`file-guide.md:158`).

### 2.7 Administration — `AuthUser<Admin>` + couche d'audit

| Méthode + chemin | Requête | Réponse succès | Erreurs | Déclarée dans |
|---|---|---|---|---|
| `GET /api/v1/admin/partners?status=pending&cursor=` | `status` (PartnerStatus), `cursor` | `200` — `PartnerReviewItem` : `id`, `legal_name`, `trade_name`, `category`, `ifu` (`string\|null`), `service_mode`, `city`, `district`, `address_line`, `website_url`, `contact_email`, `status`, `submitted_at`. Enveloppe non annotée. | `401`, `403` | dico `data-dictionary.md:490-505` |
| `POST /api/v1/admin/partners/{id}/approve` | aucune | `204` | `404`, `403` | dico `:507` |
| `POST /api/v1/admin/partners/{id}/reject` | `{ reason: string }` — obligatoire | statut **non écrit** | `422`, `404` | dico `:508-510` |
| `GET /api/v1/admin/highlights?placement=minister_pick` | `placement` (`minister_pick\|public_featured`) | `200` — `HighlightItem` : `id`, `partner: PartnerRef`, `placement`, `position`, `created_by`, `created_at` | `401`, `403` | dico `:512-520` |
| `POST /api/v1/admin/highlights` | `{ partner_id: string, placement: HighlightPlacement, position: number\|null }` — `null` = ajouter en fin | statut **non écrit** | `422 HIGHLIGHT_NOT_ELIGIBLE`, `409 HIGHLIGHT_DUPLICATE` | dico `:522-526` |
| `DELETE /api/v1/admin/highlights/{id}` | `id` en chemin | `204` — renseigne `removed_at`, **ne supprime pas la ligne** | `404` | dico `:528` |
| `PUT /api/v1/admin/highlights/reorder` | `{ placement: HighlightPlacement, ordered_ids: string[] }` — liste **complète** | statut **non écrit** | `422` | dico `:530-535` |
| `POST /api/v1/admin/topups` | `{ employer_id: string, employer_ref: string, amount: number, reference: string\|null }` | statut **non écrit** | `422`, `404` | dico `:537-543` |
| `POST /api/v1/admin/topup-batches` | **multipart** (nom du champ fichier non écrit) | `200` — `BatchPreview` : `batch_id`, `file_name`, `line_count`, `total_amount`, `status: BatchStatus`, `errors: { line, employer_ref, reason }[]` | `409 DUPLICATE_BATCH`, `422 BATCH_HAS_ERRORS` | dico `:545-554` |
| `POST /api/v1/admin/topup-batches/{id}/validate` | aucune | `204` | `422 BATCH_HAS_ERRORS`, `404` | dico `:556` |
| `POST /api/v1/admin/compensations` | `{ original_operation_id: string, reason: string }` | statut **non écrit** | `422` (compenser une compensation est refusé, `file-guide.md:218`) | dico `:558-559` |
| `GET /api/v1/admin/dashboard?from=&to=` | `from`, `to` | `200` — `total_volume`, `transaction_count`, `active_partners`, `pending_partners`, `active_employees`, `by_city: { city, volume, transaction_count }[]`, `online_partners: { volume, transaction_count }` | `401`, `403` | dico `:561-573` |
| `GET /api/v1/admin/audit/verify` | aucune | `200` — `{ valid: boolean, checked_entries: number, first_invalid_seq: number\|null }` | `401`, `403` | dico `:575-580` |

Le stub `routes/admin.rs:1-3` mentionne en plus **« account suspension »**, pour
laquelle **aucune route n'existe dans le dictionnaire §4.7**. Ambiguïté relevée.

### 2.8 Intégration SIRH — authentification par client applicatif

| Méthode + chemin | Requête | Réponse succès | Erreurs | Auth | Déclarée dans |
|---|---|---|---|---|---|
| `GET /api/v1/integration/employees/{employer_ref}/balance` | `employer_ref` en chemin (le matricule) | `200` — `{ employer_ref, settled, held, available, currency, as_of }` | `401`, `404`, `429` (limite par `api_client`) | **en-tête d'autorisation** vérifié contre un secret haché ; **HTTPS obligatoire, sans exception de développement**. L'`employer_id` est déduit de l'authentification, **jamais du chemin** (décision 12). | dico `data-dictionary.md:588-596` ; stub `extractors/api_client.rs:1-3` ; `routes/integration.rs:1-3` |

⚠️ **Le schéma d'authentification n'est jamais nommé.** `extractors/api_client.rs:2`
dit « read from the authorization header against the hashed secret » ;
`file-guide.md:263` dit « lit l'en-tête d'autorisation ». Ni `Basic`, ni `Bearer`,
ni un en-tête maison ne sont écrits. La table `api_clients`
(`migrations/0001_schema.sql:254-262`) porte `client_id TEXT UNIQUE` et
`secret_hash TEXT` — compatible avec `Basic`, mais ce n'est pas écrit.

### 2.9 Hors API métier

| Route | Source | Remarque |
|---|---|---|
| `GET /health` → `"ok"` | `TASK-DISTRIBUTION-BACKEND.md:439` | Présent uniquement dans cette esquisse, absent du dictionnaire §4. Pas de préfixe `/api/v1`. |
| `GET /docs` (Swagger UI) | `crates/api/src/openapi.rs:1` | **En développement uniquement.** |

---

## 3. Conventions transverses du back

| Sujet | Règle | Source |
|---|---|---|
| **Casse des champs** | `snake_case` **partout, JSON compris**. « Aucune traduction aux frontières. » Ex. `expires_at`, `trade_name`, `next_cursor`. | `docs/data-dictionary.md:15` |
| **Dates** | **ISO 8601 UTC avec `Z`**, jamais d'heure locale. Ex. `"2026-08-31T14:23:05Z"`. La précision (secondes ? millisecondes ?) n'est pas écrite ; l'exemple du dictionnaire est à la seconde, celui du QR aussi (`:615`). En base : `TIMESTAMPTZ` → `chrono::DateTime<Utc>` (`Cargo.toml:57-58`). Type `DATE` séparé, sérialisé `YYYY-MM-DD`. | `data-dictionary.md:18`, `:40-41` |
| **Montants** | **Nombre décimal en euros, 2 décimales maximum. Jamais une chaîne, jamais des centimes sur le fil.** `456.56`, `3.99`, `25` (= 25,00 €). Stockage interne en centimes entiers (`BIGINT`), invisible du front. Négatif ou > 2 décimales → `422`. | `data-dictionary.md:17`, `:39`, `:312-314` ; **confirmé dans le code** : `core/src/money.rs:145` `serializer.serialize_f64(self.0 as f64 / SUBUNIT as f64)` ; désérialisation `money.rs:159-185` acceptant f64, u64, i64 **et string** |
| **Devise** | `currency` vaut **toujours `"EUR"`** (code ISO 4217). | `docs/decisions.md:114-115` (amendement A5) |
| **Identifiants** | Chaîne **UUID v4**, jamais un nombre. Newtypes Rust (`UserId`, `Jti`, `AccountId`…) sérialisés en transparent. | `data-dictionary.md:16`, `:38` ; `core/src/ids.rs:20-22`, `:75-85` |
| **Énumérations** | Minuscules, identiques aux ENUM PostgreSQL. Toute nouvelle valeur est un changement cassant. | `data-dictionary.md:19`, `:51` ; `migrations/0001_schema.sql:4-16` |
| **Absence de valeur** | `null`, jamais chaîne vide ni `0`. | `data-dictionary.md:20` |
| **Pagination** | **Keyset uniquement, jamais `OFFSET`.** Paramètres `cursor` (base64 opaque encapsulant `(valeur_de_tri, id)`) et `limit` (**plafonné à 100**). Enveloppe : `{ items: T[], next_cursor: string \| null }`, `null` = fin de liste. | `data-dictionary.md:319-322` ; `extractors/pagination.rs:1-3` ; `file-guide.md:265` |
| **Erreurs** | Corps **plat** : `{ error: string, message: string, request_id: string }`. `error` est un code **`SCREAMING_SNAKE`, stable à vie** — « le front réagit sur `error`, jamais sur `message` ». `Db(_)` devient `INTERNAL`/500, aucun détail SQL. | `data-dictionary.md:325-329`, `:623-644` ; `crates/api/src/error.rs:1-3` ; `TASK-DISTRIBUTION-BACKEND.md:422-426` |
| **`request_id`** | En-tête `X-Request-Id`, généré ou repris, renvoyé dans la réponse **et** dans chaque corps d'erreur. | `middleware/request_id.rs:1-3` |
| **CORS** | **Non déterminé dans le code.** La seule trace est la variable `PUBLIC_ORIGIN=https://cartepro.example` (`backend/.env.example:13`) et deux commentaires : « CORS is strict: one origin with credentials for the authenticated surfaces, a separate policy without credentials for `/public` » (`middleware/security_headers.rs:3-4`). **Aucune liste d'origines autorisées n'existe.** Le `localhost:3000` du front n'est écrit nulle part. | voir §5 |
| **En-têtes de sécurité** | HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, CSP sur **chaque** réponse. Rejet de toute requête dont `X-Forwarded-Proto != https` hors développement. | `middleware/security_headers.rs:1-3` |
| **Rate limiting** | Différencié : `/auth/login` par IP **et** par email ; `/partner/payments` par partenaire (surtout la saisie de `short_code`) ; `/integration` par `api_client` ; `/public` par IP, plus strictement. `X-Forwarded-For` n'est lu que si la connexion vient de `TRUSTED_PROXY`. | `middleware/rate_limit.rs:1-4` |
| **Réseau** | `BIND_ADDR=127.0.0.1:8080`. L'application n'est jamais exposée directement : Caddy termine TLS. | `backend/.env.example:12`, `:10-11` |
| **TTL du jeton de paiement** | `TOKEN_TTL_SECONDS=300` (5 min). | `backend/.env.example:29` |
| **TTL de session** | `SESSION_TTL_HOURS=12`. | `backend/.env.example:28` |

### Codes d'erreur du back (table complète)

| Code | HTTP | Sens |
|---|---|---|
| `UNAUTHORIZED` | 401 | session absente ou expirée |
| `FORBIDDEN` | 403 | mauvais rôle |
| `VALIDATION_FAILED` | 422 | format invalide |
| `TOKEN_NOT_FOUND` | 404 | `jti` ou `short_code` inconnu |
| `TOKEN_EXPIRED` | 410 | jeton périmé |
| `TOKEN_ALREADY_USED` | 409 | consommé par un **autre** partenaire |
| `INSUFFICIENT_FUNDS` | 422 | disponible < montant |
| `PARTNER_NOT_APPROVED` | 403 | partenaire non agréé |
| `ACCOUNT_INACTIVE` | 403 | compte suspendu ou clôturé |
| `DUPLICATE_BATCH` | 409 | fichier déjà importé |
| `BATCH_HAS_ERRORS` | 422 | lignes invalides |
| `HIGHLIGHT_NOT_ELIGIBLE` | 422 | partenaire non `approved` |
| `HIGHLIGHT_DUPLICATE` | 409 | déjà mis en avant à cet emplacement |
| `RATE_LIMITED` | 429 | trop de tentatives |
| `INTERNAL` | 500 | erreur serveur |

Source : `docs/data-dictionary.md:626-643`. Les variantes correspondantes existent
**réellement** dans le code : `core/src/error.rs:11-56` (`CoreError`) — la seule
partie du contrat d'erreur qui soit compilable aujourd'hui. Elle couvre aussi
`ResyncTooLate` (`error.rs:48-49`), qui n'a **pas** de code HTTP dans la table du
dictionnaire. Ambiguïté relevée.

---

## 4. Ce que le front appelle aujourd'hui

### 4.1 Inventaire des appels réseau

Une recherche `fetch(|axios|appelApi|routesApi` sur tout `front/src` ne rend que
**deux appels HTTP réels**, tous deux dans `encaissement.service.ts` :

| # | Appel front | Fichier:ligne | Route back correspondante |
|---|---|---|---|
| 1 | `GET ${BASE}/payment-tokens/{token}` | `front/src/lib/services/encaissement.service.ts:64` | **aucune** |
| 2 | `POST ${BASE}/transactions` | `front/src/lib/services/encaissement.service.ts:96` | **aucune** (la plus proche est `POST /api/v1/partner/payments`) |

`BASE` = `env.baseApi` = `"/api"` en mode mocks, sinon `NEXT_PUBLIC_API_URL` brut,
**sans préfixe de version** (`front/src/lib/config/env.ts:34`).

### 4.2 Ce qui n'appelle rien

| Élément | État | Fichier |
|---|---|---|
| Client HTTP unique `appelApi` | lève `new Error("Non implemente")` | `front/src/lib/api/client.ts:26` |
| Table de chemins `routesApi` | définie, **jamais importée nulle part** | `front/src/lib/api/routes.ts:6-24` |
| `ServiceSalarie`, `ServicePartenaire`, `ServiceAdministration`, `ServiceAuth` | **interfaces TypeScript seulement**, aucune implémentation | `front/src/lib/services/{salarie,partenaire,administration,auth}.service.ts` |
| Point d'entrée des services | `export {}` + TODO | `front/src/lib/services/index.ts:10-13` |
| Adaptateurs mocks | **5 fichiers vides (0 ligne)** | `front/src/mocks/adapters/*.ts` |
| `useSolde`, `useCodePaiement` | lèvent `"Non implemente"` | `front/src/lib/hooks/useSolde.ts:9`, `useCodePaiement.ts:12` |
| `formaterDate`, `secondesRestantes`, `formaterMontant`, `formulerSolde` | lèvent `"Non implemente"` | `front/src/lib/utils/date.ts`, `utils/montant.ts` |
| `erreurs.ts`, `idempotence.ts`, `qr/`, `luhn.ts`, `empreinte.ts`, `texte.ts` | **fichiers vides** | `front/src/lib/…` |
| Tests unitaires et e2e | **fichiers vides** | `front/tests/**` |

### 4.3 Les routes que le front se sert à lui-même

Le front héberge deux route handlers Next.js qui tiennent lieu de backend :

| Route | Requête | Réponse | Fichier |
|---|---|---|---|
| `POST /api/payment-tokens` | `{ employeeId: string }` (obligatoire, non vide) | `201` — `{ token, employeeId, issuedAt, expiresAt, usedAt: null }`, dates ISO 8601 | `front/src/app/api/payment-tokens/route.ts:70-102` |
| `GET /api/payment-tokens/{token}` | `token` en chemin | `200` — `{ token, employee: { id, name }, expiresAt }` | `front/src/app/api/payment-tokens/[token]/route.ts:25-53` |

Leurs erreurs : `400 invalid_request`, `404 unknown_employee`, `403 account_inactive`,
`402 empty_balance`, `404 unknown_token`, `409 token_used`, `410 token_expired` —
corps `{ error: { code, message } }` (`route.ts:30-36`, `[token]/route.ts:17-23`).

**`POST /api/transactions` n'existe pas** : `encaissement.service.ts:96` appelle une
route que le front ne sert pas et que le back ne spécifie pas. En mode mocks,
l'encaissement échoue donc en `404`, avec `code = "inconnu"`.

---

## 5. Tableau des divergences front / back

Classement : **bloquante** = l'appel échoue, ou pire, réussit avec une valeur
fausse. **cosmétique** = renommage ou détail de présentation, sans perte de donnée.

| # | Divergence | Front | Back | Gravité |
|---|---|---|---|---|
| **D1** | **Le back n'expose aucune route.** 27 fichiers de la crate `api`, 81 lignes, toutes en commentaire. | 2 appels `fetch` | 0 handler | **bloquante** |
| **D2** | **Unité monétaire — facteur 100 silencieux.** Le back envoie et attend des **euros décimaux** (`money.rs:145` : `serialize_f64(cents / 100)`) ; le front type tout montant en **centimes entiers**. Un `2500` du front serait lu **2500,00 €** par le back. `decisions.md:69-71` signale explicitement que « cette erreur d'un facteur cent est silencieuse ». | `MontantCentimes = number` — `types/domaine.ts:9-10`, `types/encaissement.ts:9`, `mocks/magasin.ts:6-7` | euros décimaux, 2 déc. max — `data-dictionary.md:17`, `:312-314` ; `money.rs:145` | **bloquante** |
| **D3** | **Préfixe d'URL.** `routesApi` écrit `/api/v1/...` mais n'est utilisé par aucun appel. Le seul client réel concatène `NEXT_PUBLIC_API_URL` + `/payment-tokens`, sans `/api/v1`. | `env.ts:34` + `encaissement.service.ts:64,96` | `/api/v1/<espace>/...` — `TASK-DISTRIBUTION-BACKEND.md:432-438` | **bloquante** |
| **D4** | **Modèle d'encaissement incompatible.** Le front fait saisir le montant **au caissier** et l'envoie au règlement. Le back fixe le montant **à l'émission du jeton par le salarié**, réserve les fonds, et `settle` ne reçoit **aucun** montant. | `DemandeEncaissement { token, partnerId, amount, idempotencyKey, channel }` — `encaissement.service.ts:83-90` ; écran `EtapeMontant.tsx` (160 l.) | `SettleRequest { jti\|short_code, scanned_at }` — `data-dictionary.md:437-441` ; `payments/authorize.rs:1-3`, `settle.rs:1` | **bloquante** |
| **D5** | **Chemin d'encaissement inexistant des deux côtés.** `POST /transactions` n'est ni servi par le front (pas de `front/src/app/api/transactions/route.ts`) ni spécifié par le back. | `encaissement.service.ts:96` | — | **bloquante** |
| **D6** | **Résolution de jeton sans consommation.** Le front lit un jeton avant d'encaisser. Le back n'a **aucune** route équivalente : ni le dictionnaire §4.5 ni `routes/partner.rs:1-3` n'exposent un `GET` de jeton. | `GET /payment-tokens/{token}` — `encaissement.service.ts:64` | absente | **bloquante** |
| **D7** | **Forme du corps d'erreur.** Le front lit `corps.error.code` (objet imbriqué). Le back renvoie `error` comme **chaîne**. `("TOKEN_EXPIRED").code` vaut `undefined` → le front retomberait sur `"inconnu"` **pour toutes les erreurs**, et afficherait un message générique là où il doit distinguer « jeton expiré » de « solde insuffisant ». | `{ error: { code, message } }` — `encaissement.service.ts:16,36-37` ; `app/api/payment-tokens/route.ts:30-36` | `{ error, message, request_id }` — `data-dictionary.md:325-329` | **bloquante** |
| **D8** | **Casse des codes d'erreur.** | `"token_expired"`, `"unknown_token"`, `"account_inactive"` — `types/encaissement.ts:33-42` | `TOKEN_EXPIRED`, `TOKEN_NOT_FOUND`, `ACCOUNT_INACTIVE` — `data-dictionary.md:21`, `:632-640` | **bloquante** (comparaison de chaînes, aucun `switch` ne tombe juste) |
| **D9** | **Codes d'erreur sans équivalent.** Le front définit `insufficient_funds`, `partner_inactive`, `invalid_amount`, `reseau`, `inconnu`. `partner_inactive` n'existe pas côté back (`PARTNER_NOT_APPROVED` est autre chose) ; `invalid_amount` correspondrait à `VALIDATION_FAILED`. Les mocks émettent `empty_balance` (402) et `unknown_employee` (404), absents du back. | `types/encaissement.ts:33-42` ; `app/api/payment-tokens/route.ts:83-90` | `data-dictionary.md:626-643` | **bloquante** |
| **D10** | **Enveloppe de pagination.** Offset contre keyset : deux modèles incompatibles, pas un renommage. Le front n'a nulle part où mettre `next_cursor`, et le back ne peut pas produire `total` (il ne compte pas). | `ReponsePaginee<T> { elements, page, taillePage, total }` — `types/api.ts:7-12` | `Paginated<T> { items, next_cursor }` — `data-dictionary.md:319-322` | **bloquante** |
| **D11** | **Aucun credential envoyé.** Les deux `fetch` du front ne passent pas `credentials: "include"`. Le back authentifie par cookie de session. En cross-origin (front sur un port, back sur un autre), le cookie ne partirait pas → `401` systématique. | `encaissement.service.ts:64-66`, `:96-100` | cookie `session`, `SameSite=Strict` — `TASK-DISTRIBUTION-BACKEND.md:456,480` | **bloquante** |
| **D12** | **Clé d'idempotence.** Le front en forge une par tentative et l'envoie dans le corps. Le back n'a **aucun** champ ni en-tête d'idempotence : il déduplique sur `token_jti`. `ARCHITECTURE.md:60` liste pourtant « en-tête de clé d'idempotence » comme attendu du back. | `idempotencyKey` dans le corps — `encaissement.service.ts:87-88` | idempotence sur `token_jti` — `TASK-DISTRIBUTION-BACKEND.md:35`, `:302` ; `payments/settle.rs:1-2` | **bloquante** |
| **D13** | **Le drapeau de rejeu.** Le front lit `__replayed` et affiche « déjà encaissé » plutôt que « encaissé ». Le back ne renvoie pas ce champ : sa `PaymentResponse` a `status: "settled"` dans les deux cas, et rien ne distingue un rejeu. | `__replayed?: boolean` — `encaissement.service.ts:113`, `types/encaissement.ts:25-30` | `data-dictionary.md:443-450`, `:645` | **bloquante** |
| **D14** | **Identité du salarié au comptoir.** Le front affiche `employee.name`, le nom complet. Le back refuse par principe de le transmettre au partenaire et n'envoie que `customer_label` (`"K. A."`). | `employee: { id, name }` — `types/encaissement.ts:14` | `customer_label` — `data-dictionary.md:433` ; glossaire `:661` | **bloquante** (l'écran affiche une donnée que le back ne fournira jamais) |
| **D15** | **Langue et casse des champs métier.** Le front modélise en français camelCase, le back impose `snake_case` anglais **sans traduction aux frontières**. Touche `Transaction`, `Solde`, `CodePaiement`, `Partenaire`, `Categorie`, `DemandePartenaire`. | `montant`, `libelle`, `estMisEnAvant`, `motifDecision`, `expireLe` — `types/domaine.ts:12-61` | `amount`, `trade_name`, `position`, `reason`, `expires_at` — `data-dictionary.md:15` | **bloquante** (aucun champ ne correspond ; ce n'est pas un renommage cosmétique mais une couche d'adaptation entière qui manque) |
| **D16** | **Valeurs d'énumération.** | `"validee"\|"annulee"\|"contre_ecriture"` (`domaine.ts:28`), `"en_attente"\|"valide"\|"refuse"\|"suspendu"` (`:50`), `"salarie"\|"partenaire"\|"administration"` (`constantes.ts:16`) | `topup\|payment\|compensation\|closure_forfeit` (`data-dictionary.md:61`), `pending\|approved\|rejected\|suspended\|closed` (`:57`), `employee\|partner\|admin` (`:54`) | **bloquante** |
| **D17** | **Horodatages : type sur le fil.** Le front convertit toute date en **millisecondes numériques** dès la frontière et accepte aussi bien un nombre qu'une chaîne (`typeof valeur === "number" ? valeur : Date.parse(...)`). Le back n'envoie que de l'ISO 8601. La conversion fonctionne, mais la branche « nombre » accepte silencieusement un contrat que le back n'émet pas. | `encaissement.service.ts:48-58` | ISO 8601 UTC `Z` — `data-dictionary.md:18` | **cosmétique** (fonctionne aujourd'hui ; à resserrer) |
| **D18** | **Nom du champ jeton.** | `token` (une seule valeur) | `jti` (UUID) **et** `short_code` (8 car.), deux champs distincts | **cosmétique** |
| **D19** | **Alphabet et longueur du code court.** Le mock front tire **16 caractères** dans un alphabet de **32** incluant `L`. Le back impose **8 caractères** dans un alphabet de 30 excluant `0 O 1 I l`, affiché `XXXX-XXXX`. | `route.ts:22-23` | `crypto/short_code.rs:1-3` ; exemple `"K7M2-P4XQ"` `data-dictionary.md:400` | **cosmétique** (mock uniquement — mais le lira à voix haute au comptoir) |
| **D20** | **Casse des champs de jeton.** `issuedAt`/`expiresAt`/`createdAt` contre `issued_at`/`expires_at`/`occurred_at`. | `magasin.ts:44-53`, `encaissement.service.ts:110-119` | `data-dictionary.md:15`, `:402-404` | **cosmétique** |
| **D21** | **Port du backend.** Le front documente `http://localhost:8000`, le back écoute sur `127.0.0.1:8080`. | `front/.env.example:16` | `backend/.env.example:12` | **cosmétique** |
| **D22** | **TTL du jeton.** Les deux valent 300 s / 5 min. **Concordant** — noté pour mémoire. | `constantes.ts:7`, `magasin.ts:18`, `front/.env.example:20` | `backend/.env.example:29` | — |

---

## 6. Ambiguïtés relevées — points où je me suis arrêté

Chacune est un endroit où deux lectures du dépôt sont défendables. Aucune n'a été
tranchée dans ce document.

| # | Ambiguïté | Où j'ai hésité |
|---|---|---|
| **A1** | **Le montant dans le QR est-il en centimes ou en euros ?** L'exemple de charge utile donne `"amt": 2500`, ce qui se lit naturellement « 2500 centimes = 25,00 € ». Mais l'amendement A5 impose les euros décimaux sur le fil, auquel cas `2500` vaut 2500 €. La section 5 n'a pas été relue après A5. | `docs/data-dictionary.md:615` contre `docs/data-dictionary.md:312-314` et `docs/decisions.md:62-71` |
| **A2** | **La surface publique est-elle sous `/api/v1` ?** L'esquisse de routeur monte cinq sous-arbres et **ne monte pas `/public`** — elle est antérieure à l'amendement A3. Le dictionnaire écrit `/api/v1/public/...`, le guide et le stub écrivent `/public/...`. | `docs/TASK-DISTRIBUTION-BACKEND.md:432-439` contre `docs/data-dictionary.md:339` et `docs/file-guide.md:284` |
| **A3** | **Statut HTTP de six routes d'écriture.** `POST /me/payment-tokens`, `POST /admin/partners/{id}/reject`, `POST /admin/highlights`, `PUT /admin/highlights/reorder`, `POST /admin/topups`, `POST /admin/compensations` renvoient un corps mais **aucun statut n'est écrit** — alors que les routes à `204` sont, elles, annotées. `200` ou `201` ? Je n'ai pas voulu deviner. | `docs/data-dictionary.md:401`, `:508`, `:522`, `:530`, `:537`, `:558` |
| **A4** | **Le schéma d'authentification SIRH n'est jamais nommé.** « En-tête d'autorisation » et « secret haché », rien de plus. `Basic` serait cohérent avec `client_id` + `secret_hash`, mais ce n'est écrit nulle part. | `crates/api/src/extractors/api_client.rs:1-3` ; `docs/file-guide.md:263` ; `migrations/0001_schema.sql:254-262` |
| **A5** | **Les origines CORS ne sont écrites nulle part.** Une seule variable, `PUBLIC_ORIGIN=https://cartepro.example`, et deux commentaires disant « une origine avec credentials » sans dire laquelle en développement. Le front Next tourne par défaut sur `localhost:3000`, jamais mentionné côté back. | `backend/.env.example:13` ; `crates/api/src/middleware/security_headers.rs:3-4` |
| **A6** | **`ResyncTooLate` n'a pas de code HTTP.** La variante existe dans `CoreError`, `error.rs:1-3` demande de la couvrir, mais la table §6 du dictionnaire ne lui donne ni code stable ni statut. | `crates/core/src/error.rs:48-49` ; `crates/api/src/error.rs:2` ; table `docs/data-dictionary.md:626-643` |
| **A7** | **Enveloppe de pagination appliquée de façon inégale.** `GET /me/transactions` et `GET /catalog` sont annotés `Paginated<T>`. `GET /partner/transactions` et `GET /admin/partners` acceptent un `cursor` mais leur réponse n'est **pas** annotée `Paginated<T>` : liste nue, ou enveloppe implicite ? | `docs/data-dictionary.md:427-434`, `:490-505` contre `:387`, `:479` |
| **A8** | **Suspension de compte : route mentionnée, jamais spécifiée.** `routes/admin.rs:1` demande de câbler « account suspension ». Aucune route correspondante en §4.7. | `crates/api/src/routes/admin.rs:1` contre `docs/data-dictionary.md:487-580` |
| **A9** | **Précision des horodatages.** « ISO 8601 UTC avec `Z` » — mais les exemples sont tous à la seconde (`2026-08-31T14:23:05Z`) tandis que les mocks du front émettent des millisecondes (`new Date(...).toISOString()` → `.000Z`). Le back accepte-t-il les millisecondes ? Non écrit. | `docs/data-dictionary.md:18` contre `front/src/app/api/payment-tokens/route.ts:96-97` |
| **A10** | **`docs/decisions.md` est un TODO.** Les 12 décisions de cadrage ne sont pas rédigées, seul l'amendement A5 l'est. Or les payloads renvoient à « décision 8 », « décision 9 », « décision 11 », « décision 12 » comme à des textes existants. | `docs/decisions.md:1-6` |
| **A11** | **Le nom du champ fichier du multipart** de `POST /admin/topup-batches` n'est écrit nulle part. | `docs/data-dictionary.md:545` |

---

## 7. Ce que le back n'expose pas encore

Rappel : **le back n'expose rien du tout**. Cette section distingue donc les écrans
du front qui ont une route **spécifiée** en face (elle reste à écrire) de ceux qui
n'ont **rien du tout** — ni route, ni module `core`, ni table en base.

### 7.1 Écrans avec une route spécifiée en face

| Écran front | Route spécifiée |
|---|---|
| `(salarie)/salarie/paiement` | `POST /api/v1/me/payment-tokens` |
| `(salarie)/salarie/historique` | `GET /api/v1/me/transactions` |
| `(salarie)/salarie/partenaires` | `GET /api/v1/catalog` + `GET /api/v1/cities` |
| `(salarie)/salarie` (accueil, solde) | `GET /api/v1/me/balance` + `GET /api/v1/me/minister-picks` |
| `(partenaire)/partenaire/encaissement` | `POST /api/v1/partner/payments` (+ `/batch` pour `FileAttente.tsx`) |
| `(partenaire)/partenaire/transactions` | `GET /api/v1/partner/transactions` |
| `(partenaire)/partenaire/tableau-de-bord` | `GET /api/v1/partner/summary` |
| `(administration)/administration/validations` | `GET /api/v1/admin/partners?status=pending` + `approve` / `reject` |
| `(administration)/administration/mise-en-avant` | les 4 routes `/api/v1/admin/highlights` |
| `(administration)/administration/tableau-de-bord` | `GET /api/v1/admin/dashboard` |
| `(administration)/administration/registre` → `ControleIntegrite.tsx` | `GET /api/v1/admin/audit/verify` |
| `(administration)/administration/registre` → `DialogueAnnulation.tsx` | `POST /api/v1/admin/compensations` |
| `(administration)/administration/recharges` → `FormulaireRechargement.tsx` | `POST /api/v1/admin/topups`, `POST /api/v1/admin/topup-batches`, `.../validate` |
| `(public)/` et `(public)/partenaires` | `GET /api/v1/public/featured-partners` + `GET /api/v1/public/cities` |
| `(auth)/connexion` | `POST /api/v1/auth/login` |

### 7.2 Écrans sans aucune route en face

| Écran front | Ce qui manque côté back |
|---|---|
| `(auth)/inscription` → `FormulaireSalarie.tsx` | **Rien.** Aucune route d'inscription salarié, aucun module `core`. `directory/employees.rs` parle de création d'employé, mais par l'administration. |
| `(auth)/inscription` → `FormulairePartenaire.tsx` et `(partenaire)/partenaire/inscription` | `core/src/partners/registration.rs` existe (`submit_registration`, `file-guide.md:156`) mais **aucune route HTTP ne l'expose** : la table `file-guide.md:283-290` n'en mentionne aucune, et le dictionnaire §4 non plus. Un module métier sans porte d'entrée. |
| `(administration)/administration/reclamations` et `.../reclamations/[id]` (`FileReclamations`, `FilMessages`, `DialogueCloture`, `DossierBeneficiaire`, `OperationVisee`) | **Rien du tout.** Aucune occurrence de « réclamation », « claim » ou « dispute` dans `backend/` ni `docs/`. Pas de table, pas de module, pas de route. C'est le manque le plus large. |
| `(salarie)/salarie/demandes` et `.../demandes/[id]` | **Rien du tout.** Même constat : aucun endroit du back ne modélise une demande émise par un salarié. |
| `(administration)/administration/salaries` et `.../salaries/[id]` (`RechercheSalaries`, `FicheSalarie`, `SoldeEtCredits`, `OperationsSalarie`, `DialogueStatut`, `DialogueRegularisation`) | La §4.7 du dictionnaire **ne contient aucune route employé**. Ni recherche, ni fiche, ni solde vu par l'admin, ni changement de statut. `DialogueRegularisation` se rapprocherait de `POST /admin/compensations`, mais rien ne le dit. |
| `(administration)/administration/transactions` (`TableauNational`, `FiltresTransactions`) | Aucune route de liste des transactions nationales. `GET /admin/dashboard` rend des agrégats, pas des lignes. |
| `(administration)/administration/comptes` (`TableauPartenaires`, `DialogueMotif`) | `GET /admin/partners` couvre la liste. La **suspension** d'un compte — l'objet du `DialogueMotif` — est mentionnée dans `routes/admin.rs:1` mais spécifiée nulle part (voir A8). |
| `(administration)/administration/recharges` → `ListeBeneficiaires.tsx`, `DerniersMouvements.tsx` | Aucune route de **lecture** des rechargements : la §4.7 n'expose que des `POST`. |
| `(partenaire)/partenaire/compte` → `Reversements.tsx` | Aucune notion de reversement côté back. Le glossaire est explicite : `total_received` « n'est pas dépensable » (`data-dictionary.md:661`) — il n'existe donc ni solde partenaire, ni flux de reversement. |
| `(partenaire)/partenaire/compte` → `CarteSceau.tsx`, `FicheEtablissement.tsx` | Aucune route « mon établissement » côté partenaire. `is_official_partner` n'apparaît que dans `GET /partner/summary`. |
| `(partenaire)/partenaire/catalogue` | `GET /api/v1/catalog` exige une session (`file-guide.md:288`) et liste **les partenaires**. Qu'un partenaire consulte le catalogue est cohérent, mais aucun texte ne le confirme : le rôle admis sur `/catalog` n'est pas écrit. |
| `(administration)/administration/api` (`DocumentationApi`, `TableauEndpoints`, `ExempleAppel`) | Seul `GET /docs` (Swagger UI) existe, **en développement uniquement** (`openapi.rs:1`). Aucune route servant `openapi.json` en production. |
| `(public)/cgu`, `/mentions-legales`, `/accessibilite` | Contenu statique, aucune route attendue. |

### 7.3 Dans l'autre sens : routes spécifiées sans écran

| Route | Écran front |
|---|---|
| `GET /api/v1/integration/employees/{employer_ref}/balance` | aucun — surface SIRH, machine à machine |
| `DELETE /api/v1/me/payment-tokens/{jti}` | aucun écran ne l'appelle ; l'annulation d'un code par le salarié n'est câblée nulle part |
| `POST /api/v1/auth/logout` | aucun appel dans `front/src` |
| `GET /health` | — |

---

## 8. Ce qu'il faut savoir avant d'écrire la moindre ligne d'intégration

Trois points, dans l'ordre où ils feront mal.

1. **L'unité monétaire (D2).** C'est la seule divergence qui produit une valeur
   fausse au lieu d'une erreur. `docs/decisions.md:69-71` demande d'ailleurs qu'elle
   soit « annoncée à l'équipe front de vive voix ». Ce document en est la trace
   écrite ; il ne remplace pas l'annonce.
2. **Le modèle d'encaissement (D4).** Ce n'est pas un désaccord de nommage mais deux
   conceptions du paiement : « le caissier tape le montant » contre « le salarié
   autorise un montant ». `EtapeMontant.tsx` (160 lignes, l'écran le plus abouti du
   front) implémente la première. Le back tout entier — réservation de fonds,
   signature Ed25519 du montant dans le QR, `checked_sub` refusant le négatif —
   repose sur la seconde. Un des deux est à refaire.
3. **La génération de types (§8 du dictionnaire).** Le contrat prévoit
   `DTO Rust → utoipa → openapi.json → openapi-typescript → types.ts`, et interdit
   explicitement les interfaces recopiées à la main. `front/src/types/domaine.ts` et
   `types/api.ts` sont recopiés à la main. Tant que la chaîne de génération n'existe
   pas, chaque divergence de ce document se reformera en silence.

---

*Document produit par lecture seule du dépôt. Aucun fichier du back ni du front
n'a été modifié, aucun serveur lancé, aucune dépendance installée.*
