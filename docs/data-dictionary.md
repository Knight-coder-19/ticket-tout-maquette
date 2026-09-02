# CartePro — Dictionnaire de données

> Contrat de nommage entre backend et frontend.
> Pour chaque entité : nom de colonne, type SQL, type Rust, et **si et comment elle est exposée** en JSON.
> Compagnon de `docs/data-model.md` (le pourquoi) et `docs/file-guide.md` (où le code vit).
>
> **Version 1.1** — intègre les amendements A1 à A4 (voir `CLAUDE.md` §3.1).

---

## 0. Conventions générales

| Sujet | Règle | Exemple |
|---|---|---|
| Casse | `snake_case` partout, JSON compris. Aucune traduction aux frontières. | `expires_at` |
| Identifiants | Chaîne UUID v4, jamais un nombre | `"3f9a…"` |
| Montants | **Nombre décimal en euros**, deux décimales au maximum. Jamais de chaîne. | `456.56` |
| Dates | ISO 8601 UTC avec `Z`, jamais d'heure locale | `"2026-08-31T14:23:05Z"` |
| Énumérations | Minuscules, identiques aux ENUM PostgreSQL | `"approved"` |
| Absence de valeur | `null`, jamais chaîne vide ni `0` | `"ended_at": null` |
| Codes d'erreur | `SCREAMING_SNAKE`, stables à vie | `TOKEN_EXPIRED` |

**Colonne « Exposé » :**

- **✅ nom** — présent en JSON sous ce nom
- **🌐** — présent **aussi** sur la surface publique non authentifiée (A3)
- **🔒** — interne, ne sort jamais de l'API
- **⚠️** — exposé uniquement à l'administration

> **Règle absolue :** le front ne se couple jamais au schéma SQL. Il consomme les payloads de la section 4. Les sections 2 et 3 existent pour partager un vocabulaire, pas pour être calquées.

---

## 1. Types de base

| Concept | SQL | Rust | JSON | TypeScript |
|---|---|---|---|---|
| Identifiant | `UUID` | `AccountId`, `Jti`, … (newtypes) | `string` | `string` |
| Montant | `BIGINT` (centimes) | `Money` | `number` en euros, ex. `456.56` | `number` |
| Date | `TIMESTAMPTZ` | `DateTime<Utc>` | `string` ISO | `string` |
| Date simple | `DATE` | `NaiveDate` | `string` `YYYY-MM-DD` | `string` |
| Texte | `TEXT` | `String` | `string` | `string` |
| Texte insensible | `CITEXT` | `String` | `string` | `string` |
| Décimal géo | `NUMERIC(9,6)` | `Decimal` | 🔒 dormant | — |
| Empreinte | `BYTEA` | `[u8; 32]` | 🔒 jamais exposé | — |

---

## 2. Types énumérés

Valeurs identiques des trois côtés. Toute nouvelle valeur est un changement cassant.

```ts
type UserRole           = "employee" | "partner" | "admin";
type UserStatus         = "active" | "suspended" | "closed";
type LinkStatus         = "active" | "ended";
type PartnerStatus      = "pending" | "approved" | "rejected" | "suspended" | "closed";
type AccountOwner       = "employee" | "partner" | "system";
type AccountStatus      = "active" | "suspended" | "closed";
type TokenStatus        = "active" | "consumed" | "expired" | "cancelled";
type OperationKind      = "topup" | "payment" | "compensation" | "closure_forfeit";
type EntryDirection     = "debit" | "credit";
type EntryMode          = "qr_scan" | "short_code";
type BatchStatus        = "draft" | "validated" | "rejected";

// A1
type ServiceMode        = "physical" | "online" | "both";
// A2
type HighlightPlacement = "minister_pick" | "public_featured";
```

---

## 3. Les tables

### 3.1 `users`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `UserId` | ✅ `id` |
| `email` | `CITEXT` UNIQUE | `String` | ✅ `email` |
| `password_hash` | `TEXT` | `String` | 🔒 |
| `role` | `user_role` | `UserRole` | ✅ `role` |
| `status` | `user_status` | `UserStatus` | ⚠️ `status` |
| `last_login_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | ⚠️ `last_login_at` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `created_at` |
| `updated_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | 🔒 |

### 3.2 `employees`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `EmployeeId` | ✅ `id` |
| `user_id` | `UUID` UNIQUE FK | `UserId` | 🔒 |
| `last_name` | `TEXT` | `String` | ✅ `last_name` |
| `first_name` | `TEXT` | `String` | ✅ `first_name` |
| `phone` | `TEXT NULL` | `Option<String>` | ✅ `phone` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `created_at` |

### 3.3 `employers`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `EmployerId` | ⚠️ `id` |
| `legal_name` | `TEXT` | `String` | ✅ `legal_name` |
| `ifu` | `TEXT NULL` UNIQUE | `Option<String>` | ⚠️ `ifu` |
| `contact_email` | `CITEXT NULL` | `Option<String>` | ⚠️ `contact_email` |
| `contact_phone` | `TEXT NULL` | `Option<String>` | ⚠️ `contact_phone` |
| `status` | `user_status` | `UserStatus` | ⚠️ `status` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `created_at` |

### 3.4 `employment_links`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `EmploymentLinkId` | ⚠️ `id` |
| `employee_id` | `UUID` FK | `EmployeeId` | 🔒 |
| `employer_id` | `UUID` FK | `EmployerId` | 🔒 |
| `employer_ref` | `TEXT` | `String` | ✅ `employer_ref` — le matricule |
| `account_id` | `UUID` FK | `AccountId` | 🔒 |
| `status` | `link_status` | `LinkStatus` | ⚠️ `status` |
| `started_at` | `DATE` | `NaiveDate` | ⚠️ `started_at` |
| `ended_at` | `DATE NULL` | `Option<NaiveDate>` | ⚠️ `ended_at` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | 🔒 |

### 3.5 `cities`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `CityId` | 🌐 `id` |
| `name` | `TEXT` | `String` | 🌐 `name` |
| `department` | `TEXT` | `String` | 🌐 `department` |

> **Question ouverte 1 :** référentiel français ou béninois ? Les partenaires de lancement sont à Paris, Toulouse et en Corrèze. Le cas échéant, `district` devient « arrondissement ou code postal ».

### 3.6 `partners` — *amendée par A1*

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `PartnerId` | 🌐 `id` |
| `user_id` | `UUID` UNIQUE FK | `UserId` | 🔒 |
| `account_id` | `UUID` UNIQUE FK | `AccountId` | 🔒 |
| `legal_name` | `TEXT` | `String` | ⚠️ `legal_name` |
| `trade_name` | `TEXT` | `String` | 🌐 `trade_name` — nom affiché |
| `category` | `TEXT` | `String` | 🌐 `category` |
| `ifu` | `TEXT NULL` | `Option<String>` | ⚠️ `ifu` |
| **`service_mode`** | `service_mode` | `ServiceMode` | 🌐 `service_mode` — **A1** |
| **`website_url`** | `TEXT NULL` | `Option<String>` | 🌐 `website_url` — **A1** |
| `city_id` | `UUID NULL` FK | `Option<CityId>` | ✅ via l'objet `city` — **nullable depuis A1** |
| `district` | `TEXT NULL` | `Option<String>` | ✅ `district` |
| `address_line` | `TEXT NULL` | `Option<String>` | ✅ `address_line` |
| `latitude` | `NUMERIC(9,6) NULL` | `Option<Decimal>` | 🔒 dormant |
| `longitude` | `NUMERIC(9,6) NULL` | `Option<Decimal>` | 🔒 dormant |
| `status` | `partner_status` | `PartnerStatus` | ✅ `status` |
| `submitted_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `submitted_at` |
| `reviewed_by` | `UUID NULL` FK | `Option<UserId>` | ⚠️ `reviewed_by` |
| `reviewed_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | ⚠️ `reviewed_at` |
| `review_reason` | `TEXT NULL` | `Option<String>` | ✅ `review_reason` (visible du partenaire en cas de rejet) |

```sql
-- A1
ALTER TABLE partners ADD CONSTRAINT physical_needs_city
  CHECK (service_mode = 'online' OR city_id IS NOT NULL);
```

> **Le badge « Partenaire Officiel du Ministère » (A4) n'est pas une colonne.** Le front l'affiche quand `status === "approved"`. Ne pas ajouter de champ pour cela.

### 3.7 `partner_highlights` — *nouvelle table, A2*

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `HighlightId` | ⚠️ `id` |
| `partner_id` | `UUID` FK | `PartnerId` | 🌐 via l'objet partenaire |
| `placement` | `highlight_placement` | `HighlightPlacement` | ⚠️ `placement` |
| `position` | `INT` | `i32` | 🌐 `position` — ordre d'affichage |
| `created_by` | `UUID` FK | `UserId` | ⚠️ `created_by` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `created_at` |
| `removed_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | 🔒 |

```sql
CREATE UNIQUE INDEX ON partner_highlights (placement, partner_id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX ON partner_highlights (placement, position)   WHERE removed_at IS NULL;
```

Même motif d'index partiel que partout ailleurs : l'unicité ne porte que sur les mises en avant actives, l'historique reste intact. Un retrait renseigne `removed_at`, il ne supprime jamais la ligne (règle R6).

**Deux règles portées par le code :** seul un partenaire `approved` est éligible, et toute pose ou retrait écrit dans `audit_log`. Le second point compte : il faudra pouvoir dire qui a placé tel commerce en page d'accueil, et quand.

### 3.8 `accounts`

Table centrale, **presque entièrement interne**. Le front ne voit jamais un objet `account`, seulement des soldes calculés.

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `AccountId` | 🔒 |
| `owner_type` | `account_owner` | `AccountOwner` | 🔒 |
| `owner_id` | `UUID NULL` | `Option<Uuid>` | 🔒 |
| `system_code` | `TEXT NULL` UNIQUE | `Option<String>` | 🔒 |
| `payment_handle` | `TEXT NULL` UNIQUE | `Option<String>` | 🔒 dormant (flux 2) |
| `balance_settled` | `BIGINT` | `Money` | ✅ `settled` (employé uniquement) |
| `balance_held` | `BIGINT` | `Money` | ✅ `held` (employé uniquement) |
| — calculé — | — | `Money` | ✅ `available` = `settled - held` |
| `status` | `account_status` | `AccountStatus` | ⚠️ `status` |
| `version` | `BIGINT` | `i64` | 🔒 |
| `opened_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | 🔒 |
| `closed_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | ⚠️ `closed_at` |

> **Vocabulaire, à ne pas confondre.** Côté employé : `settled`, `held`, `available`. Côté partenaire : `total_received`, jamais « solde ». Ce n'est pas la même chose (décision 9) et l'afficher comme un solde serait faux.

### 3.9 `payment_tokens`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `jti` | `UUID` PK | `Jti` | ✅ `jti` |
| `account_id` | `UUID` FK | `AccountId` | 🔒 |
| `amount` | `BIGINT` | `Money` | ✅ `amount` |
| `short_code` | `TEXT` | `String` | ✅ `short_code` |
| `status` | `token_status` | `TokenStatus` | ✅ `status` |
| `issued_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ✅ `issued_at` |
| `expires_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ✅ `expires_at` |
| `resolved_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | 🔒 |

### 3.10 `ledger_operations`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `OperationId` | ✅ `id` (identifiant de transaction) |
| `kind` | `operation_kind` | `OperationKind` | ✅ `kind` |
| `amount` | `BIGINT` | `Money` | ✅ `amount` |
| `memo` | `TEXT NULL` | `Option<String>` | ⚠️ `memo` |
| `created_by` | `UUID NULL` FK | `Option<UserId>` | ⚠️ |
| `occurred_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ✅ `occurred_at` |
| `recorded_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `recorded_at` |

> `occurred_at` est le moment réel (scan chez le commerçant), `recorded_at` le moment d'arrivée au serveur. En mode dégradé ils diffèrent. **Les listes affichées trient sur `occurred_at`.**

### 3.11 `ledger_entries`

🔒 **Intégralement interne.** Aucune colonne n'est jamais exposée. Le front ne connaît pas l'existence de cette table.

| Colonne | SQL | Rust |
|---|---|---|
| `seq` | `BIGSERIAL` PK | `i64` |
| `operation_id` | `UUID` FK | `OperationId` |
| `account_id` | `UUID` FK | `AccountId` |
| `direction` | `entry_direction` | `EntryDirection` |
| `amount` | `BIGINT` | `Money` |
| `recorded_at` | `TIMESTAMPTZ` | `DateTime<Utc>` |
| `prev_hash` | `BYTEA` | `[u8; 32]` |
| `hash` | `BYTEA` UNIQUE | `[u8; 32]` |

### 3.12 `payments`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `operation_id` | `UUID` PK FK | `OperationId` | ✅ `id` |
| `token_jti` | `UUID` UNIQUE FK | `Jti` | ✅ `jti` |
| `partner_id` | `UUID` FK | `PartnerId` | ✅ via `partner` |
| `from_account` | `UUID` FK | `AccountId` | 🔒 |
| `entry_mode` | `entry_mode` | `EntryMode` | ✅ `entry_mode` |
| `scanned_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ✅ `scanned_at` |
| `synced_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ✅ `synced_at` |

### 3.13 `topups`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `operation_id` | `UUID` PK FK | `OperationId` | ✅ `id` |
| `batch_id` | `UUID NULL` FK | `Option<BatchId>` | ⚠️ `batch_id` |
| `employer_id` | `UUID` FK | `EmployerId` | ✅ via `employer_name` |
| `to_account` | `UUID` FK | `AccountId` | 🔒 |
| `reference` | `TEXT NULL` | `Option<String>` | ✅ `reference` |

### 3.14 `compensations`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `operation_id` | `UUID` PK FK | `OperationId` | ✅ `id` |
| `original_operation_id` | `UUID` FK | `OperationId` | ✅ `original_id` |
| `reason` | `TEXT` | `String` | ✅ `reason` |
| `approved_by` | `UUID` FK | `UserId` | ⚠️ `approved_by` |

### 3.15 `topup_batches`

| Colonne | SQL | Rust | Exposé |
|---|---|---|---|
| `id` | `UUID` PK | `BatchId` | ⚠️ `id` |
| `employer_id` | `UUID` FK | `EmployerId` | ⚠️ `employer_id` |
| `file_name` | `TEXT` | `String` | ⚠️ `file_name` |
| `file_hash` | `BYTEA` | `[u8; 32]` | 🔒 |
| `line_count` | `INT` | `i32` | ⚠️ `line_count` |
| `total_amount` | `BIGINT` | `Money` | ⚠️ `total_amount` |
| `status` | `batch_status` | `BatchStatus` | ⚠️ `status` |
| `uploaded_by` | `UUID` FK | `UserId` | ⚠️ `uploaded_by` |
| `uploaded_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `uploaded_at` |
| `validated_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | ⚠️ `validated_at` |

### 3.16 `sessions`, `api_clients`, `audit_log`

🔒 **Entièrement internes**, à l'exception d'`audit_log` consulté par l'administration.

`sessions` : `id`, `user_id`, `token_hash`, `ip_address`, `user_agent`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`.
`api_clients` : `id`, `employer_id`, `client_id`, `secret_hash`, `label`, `status`, `last_used_at`, `created_at`.
`audit_log` : `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `payload`, `ip_address`, `created_at`.

---

## 4. Payloads de l'API

**C'est la seule section que le front doit lire.** Types TypeScript prêts à copier.

> **Montants.** Tout champ typé `number` désignant une somme est un **montant en euros, décimal, à deux décimales au maximum** : `456.56`, `3.99`, `25` (qui vaut 25,00 €). Le backend refuse les valeurs négatives et celles à plus de deux décimales, avec un `422`. La devise est l'euro partout, et le champ `currency` vaut toujours `"EUR"`.
>
> Le stockage interne est en centimes entiers, mais cela ne concerne pas le front : il n'apparaît jamais dans un payload.

### 4.1 Enveloppes communes

```ts
interface Paginated<T> {
  items: T[];
  next_cursor: string | null;   // null = fin de liste
}

interface ApiError {
  error: string;        // code stable, ex. "TOKEN_EXPIRED"
  message: string;      // pour l'humain, jamais pour du code
  request_id: string;
}

interface CityRef    { id: string; name: string; department: string; }
interface PartnerRef { id: string; trade_name: string; category: string; }
```

### 4.2 Surface publique — A3, sans authentification

**Aucun autre champ que ceux listés ici ne doit y apparaître.** Voir règle R9.

```ts
// GET /api/v1/public/featured-partners
interface PublicPartner {
  id: string;
  trade_name: string;
  category: string;
  service_mode: ServiceMode;
  city: CityRef | null;          // null si service_mode === "online"
  district: string | null;
  website_url: string | null;
  position: number;              // ordre voulu par l'administration
}
type PublicFeaturedList = PublicPartner[];

// GET /api/v1/public/cities
type PublicCityList = CityRef[];
```

Interdit sur cette surface : montants, statistiques, `legal_name`, `ifu`, adresse précise, contacts, dates de validation, identifiants internes autres que `partner.id`. Seuls les partenaires `approved` y figurent.

### 4.3 Authentification

```ts
// POST /api/v1/auth/login
interface LoginRequest  { email: string; password: string; }
interface LoginResponse {
  user: { id: string; email: string; role: UserRole; display_name: string; };
}
// Le jeton de session est posé en cookie httpOnly. Il n'apparaît JAMAIS dans le corps.

// POST /api/v1/auth/logout  → 204
```

### 4.4 Espace employé

```ts
// GET /api/v1/me/balance
interface BalanceResponse {
  settled: number;      // total possédé
  held: number;         // réservé par des jetons actifs
  available: number;    // settled - held  ← c'est CE nombre qu'on affiche en grand
  currency: string;     // code ISO 4217
}

// GET /api/v1/me/transactions?cursor=&limit=
interface EmployeeTransaction {
  id: string;
  kind: OperationKind;
  amount: number;
  direction: "in" | "out";      // "in" = rechargement, "out" = paiement
  counterparty: string;         // trade_name du partenaire, ou legal_name de l'employeur
  occurred_at: string;
  reference: string | null;
}
type EmployeeTransactionList = Paginated<EmployeeTransaction>;

// GET /api/v1/me/minister-picks    ← A2
interface MinisterPick {
  partner: CatalogItem;
  position: number;
}
type MinisterPickList = MinisterPick[];

// POST /api/v1/me/payment-tokens
interface AuthorizeRequest  { amount: number; }
interface IssuedTokenResponse {
  jti: string;
  short_code: string;      // "K7M2-P4XQ", affiché sous le QR
  amount: number;
  issued_at: string;
  expires_at: string;      // issued_at + 5 min
  qr_payload: string;      // à encoder tel quel dans le QR, sans transformation
}

// DELETE /api/v1/me/payment-tokens/{jti}  → 204
```

### 4.5 Espace partenaire

```ts
// GET /api/v1/partner/summary?from=&to=
interface PartnerSummary {
  total_received: number;      // PAS un solde (décision 9)
  transaction_count: number;
  period_from: string;
  period_to: string;
  is_official_partner: boolean;   // A4 — dérivé de status === "approved"
}

// GET /api/v1/partner/transactions?from=&to=&cursor=
interface PartnerTransaction {
  id: string;
  amount: number;
  entry_mode: EntryMode;
  occurred_at: string;         // = scanned_at, ce que le commerçant reconnaît
  synced_at: string;
  customer_label: string;      // "K. A." — jamais le nom complet
}

// POST /api/v1/partner/payments
interface SettleRequest {
  jti: string | null;          // renseigné si scan
  short_code: string | null;   // renseigné si saisie manuelle. Exactement un des deux.
  scanned_at: string;          // horodatage local du scan, indicatif
}
interface PaymentResponse {
  id: string;
  jti: string;
  amount: number;
  entry_mode: EntryMode;
  occurred_at: string;
  synced_at: string;
  status: "settled";
}

// POST /api/v1/partner/payments/batch  — resynchronisation hors ligne
interface BatchSettleRequest { items: SettleRequest[]; }
interface BatchSettleResult {
  jti: string;
  status: "settled" | "failed";
  payment: PaymentResponse | null;
  error: string | null;        // code d'erreur si failed
}
interface BatchSettleResponse { results: BatchSettleResult[]; }
// Une ligne en échec ne fait jamais tomber le lot. Le front retire de sa file
// toute ligne "settled", et signale les "failed".
```

### 4.6 Catalogue — *amendé par A1*

```ts
// GET /api/v1/catalog?city=&service_mode=&q=&cursor=
interface CatalogItem {
  id: string;
  trade_name: string;
  category: string;
  service_mode: ServiceMode;      // A1
  city: CityRef | null;           // null si "online"
  district: string | null;
  address_line: string | null;
  website_url: string | null;     // A1
  is_official_partner: boolean;   // A4
}
type CatalogList = Paginated<CatalogItem>;

// GET /api/v1/cities
type CityList = CityRef[];
```

### 4.7 Administration

```ts
// GET /api/v1/admin/partners?status=pending&cursor=
interface PartnerReviewItem {
  id: string;
  legal_name: string;
  trade_name: string;
  category: string;
  ifu: string | null;
  service_mode: ServiceMode;
  city: CityRef | null;
  district: string | null;
  address_line: string | null;
  website_url: string | null;
  contact_email: string;
  status: PartnerStatus;
  submitted_at: string;
}

// POST /api/v1/admin/partners/{id}/approve  → 204
// POST /api/v1/admin/partners/{id}/reject
interface RejectRequest { reason: string; }

// ── Mises en avant (A2) ──────────────────────────────
// GET /api/v1/admin/highlights?placement=minister_pick
interface HighlightItem {
  id: string;
  partner: PartnerRef;
  placement: HighlightPlacement;
  position: number;
  created_by: string;
  created_at: string;
}

// POST /api/v1/admin/highlights
interface CreateHighlightRequest {
  partner_id: string;
  placement: HighlightPlacement;
  position: number | null;      // null = ajouter en fin de liste
}
// DELETE /api/v1/admin/highlights/{id}  → 204  (renseigne removed_at, ne supprime pas)

// PUT /api/v1/admin/highlights/reorder
interface ReorderRequest {
  placement: HighlightPlacement;
  ordered_ids: string[];        // liste complète, dans l'ordre voulu
}

// ── Rechargements ────────────────────────────────────
// POST /api/v1/admin/topups
interface TopupRequest {
  employer_id: string;
  employer_ref: string;         // le matricule (décision 12)
  amount: number;
  reference: string | null;
}

// POST /api/v1/admin/topup-batches  (multipart)
interface BatchPreview {
  batch_id: string;
  file_name: string;
  line_count: number;
  total_amount: number;
  status: BatchStatus;
  errors: BatchLineError[];     // si non vide, la validation sera refusée
}
interface BatchLineError { line: number; employer_ref: string; reason: string; }

// POST /api/v1/admin/topup-batches/{id}/validate  → 204

// POST /api/v1/admin/compensations
interface CompensationRequest { original_operation_id: string; reason: string; }

// GET /api/v1/admin/dashboard?from=&to=
interface Dashboard {
  total_volume: number;
  transaction_count: number;
  active_partners: number;
  pending_partners: number;
  active_employees: number;
  by_city: { city: CityRef; volume: number; transaction_count: number }[];
  online_partners: {                       // A1 — les partenaires sans ville
    volume: number;
    transaction_count: number;
  };
}

// GET /api/v1/admin/audit/verify
interface ChainVerification {
  valid: boolean;
  checked_entries: number;
  first_invalid_seq: number | null;
}
```

> **A1, point à ne pas rater :** sans le bloc `online_partners`, le volume des commerces en ligne disparaît du tableau de bord national, puisqu'ils n'appartiennent à aucune ville. La somme des `by_city` ne vaut alors plus `total_volume`.

### 4.8 Intégration SIRH

```ts
// GET /api/v1/integration/employees/{employer_ref}/balance
interface SirhBalance {
  employer_ref: string;
  settled: number;
  held: number;
  available: number;
  currency: string;
  as_of: string;
}
```

---

## 5. Le contenu du QR

Format retourné dans `qr_payload`, encodé tel quel par le front. Le partenaire hors ligne le décode et **vérifie la signature sans réseau**.

```
CP1.<base64url(payload_json)>.<base64url(signature)>
```

`payload_json` :

```json
{ "jti": "…", "amt": 2500, "exp": "2026-08-31T14:28:05Z", "iss": "cartepro" }
```

**Signature : Ed25519.** Le serveur signe avec sa clé privée, l'application partenaire embarque la clé publique et vérifie localement.

> **Point de sécurité :** ne pas utiliser HMAC ici. Le HMAC exigerait que le partenaire détienne la clé secrète du serveur pour vérifier, ce qui lui donnerait de quoi forger des jetons. La vérification hors ligne impose une signature **asymétrique**.

**L'expiration contenue dans le QR est indicative.** La seule qui fait foi est celle vérifiée par le serveur au règlement, contre son horloge (décision 2). L'app partenaire l'utilise pour l'affichage et pour refuser localement l'évident, pas comme autorité.

---

## 6. Codes d'erreur

Stables à vie. Le front réagit sur `error`, jamais sur `message`.

| Code | HTTP | Sens | Ce que le front fait |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | session absente ou expirée | redirige vers la connexion |
| `FORBIDDEN` | 403 | mauvais rôle | écran d'erreur |
| `VALIDATION_FAILED` | 422 | format invalide | affiche les champs fautifs |
| `TOKEN_NOT_FOUND` | 404 | `jti` ou `short_code` inconnu | « code introuvable » |
| `TOKEN_EXPIRED` | 410 | jeton périmé | « jeton expiré, demander un nouveau QR » |
| `TOKEN_ALREADY_USED` | 409 | consommé par un autre | « déjà encaissé » — retirer de la file |
| `INSUFFICIENT_FUNDS` | 422 | disponible < montant | « solde insuffisant » |
| `PARTNER_NOT_APPROVED` | 403 | partenaire non agréé | écran de statut |
| `ACCOUNT_INACTIVE` | 403 | compte suspendu ou clôturé | écran de statut |
| `DUPLICATE_BATCH` | 409 | fichier déjà importé | « ce fichier a déjà été traité » |
| `BATCH_HAS_ERRORS` | 422 | lignes invalides | affiche `errors[]` |
| `HIGHLIGHT_NOT_ELIGIBLE` | 422 | partenaire non `approved` (A2) | « partenaire non agréé » |
| `HIGHLIGHT_DUPLICATE` | 409 | déjà mis en avant à cet emplacement | ignorer |
| `RATE_LIMITED` | 429 | trop de tentatives | temporisation |
| `INTERNAL` | 500 | erreur serveur | message générique + `request_id` |

**Cas particulier de l'idempotence :** un règlement rejoué par le **même** partenaire renvoie `200` avec la transaction existante, pas une erreur. C'est un succès, pas un conflit. Seul un jeton consommé par un **autre** partenaire donne `TOKEN_ALREADY_USED`.

---

## 7. Glossaire

À utiliser tel quel dans le code, l'interface et les conversations. Les confusions de cette liste ont des conséquences visibles.

| Terme | Sens exact | À ne pas confondre avec |
|---|---|---|
| **settled** | ce que le compte employé possède | `available`, qui est net des réservations |
| **held** | réservé par des jetons actifs, non dépensé | déjà dépensé |
| **available** | `settled - held`. **Le chiffre affiché en grand.** | `settled` |
| **total_received** | cumul encaissé par un partenaire | un solde : ce n'est pas dépensable (décision 9) |
| **jeton / token** | autorisation de payer un montant précis, 5 min | le QR, qui n'en est que la représentation |
| **short_code** | 8 caractères pour la saisie manuelle | un code PIN ou un mot de passe |
| **occurred_at** | moment réel du scan | `synced_at`, moment d'arrivée au serveur |
| **operation** | mouvement d'argent, toute nature confondue | `payment`, qui n'en est qu'une nature |
| **compensation** | opération inverse corrigeant une erreur | annulation : rien n'est jamais annulé (décision 4) |
| **employer_ref** | matricule, unique **par employeur** | un identifiant national |
| **partner** | un point de vente unique (décision 11) | une entreprise à plusieurs boutiques |
| **service_mode** | physique, en ligne, ou les deux (A1) | le statut d'agrément |
| **highlight** | mise en avant décidée par l'administration (A2) | le badge officiel, qui découle du statut |
| **is_official_partner** | dérivé de `status === "approved"` (A4) | un champ stocké : il n'existe pas en base |
| **valider** (partenaire) | confirmer un encaissement → `settle` | **valider** (admin) : approuver une inscription → `approve` |

Le dernier point mérite attention : le sujet emploie le même mot pour deux actions sans rapport. Dans le code, `settle` et `approve`. Dans l'interface, « Encaisser » et « Approuver ».

---

## 8. Génération automatique

Ce document fige le vocabulaire, il ne remplace pas la vérification mécanique.

```
DTO Rust → utoipa → openapi.json → openapi-typescript → types.ts
```

Le front importe `types.ts` généré, jamais des interfaces recopiées à la main. Un champ renommé côté backend casse alors le build du front immédiatement, au lieu de produire un `undefined` silencieux le jour de l'intégration.

Ajouter la génération à la CI et publier `openapi.json` à chaque merge.