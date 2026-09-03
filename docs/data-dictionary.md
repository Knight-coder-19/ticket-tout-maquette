# CartePro — Data dictionary

> Naming contract between backend and frontend.
> For each entity: column name, SQL type, Rust type, and **whether and how it is exposed** in JSON.
> Companion to `docs/data-model.md` (the why) and `docs/file-guide.md` (where the code lives).
>
> **Version 1.1** — incorporates amendments A1 to A4 (see `CLAUDE.md` §3.1).

---

## 0. General conventions

| Topic | Rule | Example |
|---|---|---|
| Case | `snake_case` everywhere, JSON included. No translation at the boundaries. | `expires_at` |
| Identifiers | UUID v4 string, never a number | `"3f9a…"` |
| Amounts | **Decimal number in euros**, two decimals at most. Never a string. | `456.56` |
| Dates | ISO 8601 UTC with `Z`, never local time | `"2026-08-31T14:23:05Z"` |
| Enums | Lowercase, identical to the PostgreSQL ENUMs | `"approved"` |
| Absence of a value | `null`, never an empty string nor `0` | `"ended_at": null` |
| Error codes | `SCREAMING_SNAKE`, stable for life | `TOKEN_EXPIRED` |

**The "Exposed" column:**

- **✅ name** — present in JSON under that name
- **🌐** — **also** present on the unauthenticated public surface (A3)
- **🔒** — internal, never leaves the API
- **⚠️** — exposed to administration only

> **Absolute rule:** the front end never couples itself to the SQL schema. It consumes the payloads of section 4. Sections 2 and 3 exist to share a vocabulary, not to be mirrored.

---

## 1. Base types

| Concept | SQL | Rust | JSON | TypeScript |
|---|---|---|---|---|
| Identifier | `UUID` | `AccountId`, `Jti`, … (newtypes) | `string` | `string` |
| Amount | `BIGINT` (cents) | `Money` | `number` in euros, e.g. `456.56` | `number` |
| Timestamp | `TIMESTAMPTZ` | `DateTime<Utc>` | ISO `string` | `string` |
| Plain date | `DATE` | `NaiveDate` | `string` `YYYY-MM-DD` | `string` |
| Text | `TEXT` | `String` | `string` | `string` |
| Case-insensitive text | `CITEXT` | `String` | `string` | `string` |
| Geographic decimal | `NUMERIC(9,6)` | `Decimal` | 🔒 dormant | — |
| Digest | `BYTEA` | `[u8; 32]` | 🔒 never exposed | — |

---

## 2. Enumerated types

Identical values on all three sides. Any new value is a breaking change.

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

## 3. The tables

### 3.1 `users`

| Column | SQL | Rust | Exposed |
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

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `id` | `UUID` PK | `EmployeeId` | ✅ `id` |
| `user_id` | `UUID` UNIQUE FK | `UserId` | 🔒 |
| `last_name` | `TEXT` | `String` | ✅ `last_name` |
| `first_name` | `TEXT` | `String` | ✅ `first_name` |
| `phone` | `TEXT NULL` | `Option<String>` | ✅ `phone` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `created_at` |

### 3.3 `employers`

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `id` | `UUID` PK | `EmployerId` | ⚠️ `id` |
| `legal_name` | `TEXT` | `String` | ✅ `legal_name` |
| `ifu` | `TEXT NULL` UNIQUE | `Option<String>` | ⚠️ `ifu` |
| `contact_email` | `CITEXT NULL` | `Option<String>` | ⚠️ `contact_email` |
| `contact_phone` | `TEXT NULL` | `Option<String>` | ⚠️ `contact_phone` |
| `status` | `user_status` | `UserStatus` | ⚠️ `status` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `created_at` |

### 3.4 `employment_links`

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `id` | `UUID` PK | `EmploymentLinkId` | ⚠️ `id` |
| `employee_id` | `UUID` FK | `EmployeeId` | 🔒 |
| `employer_id` | `UUID` FK | `EmployerId` | 🔒 |
| `employer_ref` | `TEXT` | `String` | ✅ `employer_ref` — the payroll reference |
| `account_id` | `UUID` FK | `AccountId` | 🔒 |
| `status` | `link_status` | `LinkStatus` | ⚠️ `status` |
| `started_at` | `DATE` | `NaiveDate` | ⚠️ `started_at` |
| `ended_at` | `DATE NULL` | `Option<NaiveDate>` | ⚠️ `ended_at` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | 🔒 |

### 3.5 `cities`

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `id` | `UUID` PK | `CityId` | 🌐 `id` |
| `name` | `TEXT` | `String` | 🌐 `name` |
| `department` | `TEXT` | `String` | 🌐 `department` |

> **Open question 1:** French or Beninese reference data? The launch partners are in Paris, Toulouse and Corrèze. If need be, `district` becomes "arrondissement or postcode".

### 3.6 `partners` — *amended by A1*

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `id` | `UUID` PK | `PartnerId` | 🌐 `id` |
| `user_id` | `UUID` UNIQUE FK | `UserId` | 🔒 |
| `account_id` | `UUID` UNIQUE FK | `AccountId` | 🔒 |
| `legal_name` | `TEXT` | `String` | ⚠️ `legal_name` |
| `trade_name` | `TEXT` | `String` | 🌐 `trade_name` — displayed name |
| `category` | `TEXT` | `String` | 🌐 `category` |
| `ifu` | `TEXT NULL` | `Option<String>` | ⚠️ `ifu` |
| **`service_mode`** | `service_mode` | `ServiceMode` | 🌐 `service_mode` — **A1** |
| **`website_url`** | `TEXT NULL` | `Option<String>` | 🌐 `website_url` — **A1** |
| `city_id` | `UUID NULL` FK | `Option<CityId>` | ✅ through the `city` object — **nullable since A1** |
| `district` | `TEXT NULL` | `Option<String>` | ✅ `district` |
| `address_line` | `TEXT NULL` | `Option<String>` | ✅ `address_line` |
| `latitude` | `NUMERIC(9,6) NULL` | `Option<Decimal>` | 🔒 dormant |
| `longitude` | `NUMERIC(9,6) NULL` | `Option<Decimal>` | 🔒 dormant |
| `status` | `partner_status` | `PartnerStatus` | ✅ `status` |
| `submitted_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `submitted_at` |
| `reviewed_by` | `UUID NULL` FK | `Option<UserId>` | ⚠️ `reviewed_by` |
| `reviewed_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | ⚠️ `reviewed_at` |
| `review_reason` | `TEXT NULL` | `Option<String>` | ✅ `review_reason` (visible to the partner on rejection) |

```sql
-- A1
ALTER TABLE partners ADD CONSTRAINT physical_needs_city
  CHECK (service_mode = 'online' OR city_id IS NOT NULL);
```

> **The "Official Ministry Partner" badge (A4) is not a column.** The front end displays it when `status === "approved"`. Do not add a field for it.

### 3.7 `partner_highlights` — *new table, A2*

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `id` | `UUID` PK | `HighlightId` | ⚠️ `id` |
| `partner_id` | `UUID` FK | `PartnerId` | 🌐 through the partner object |
| `placement` | `highlight_placement` | `HighlightPlacement` | ⚠️ `placement` |
| `position` | `INT` | `i32` | 🌐 `position` — display order |
| `created_by` | `UUID` FK | `UserId` | ⚠️ `created_by` |
| `created_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `created_at` |
| `removed_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | 🔒 |

```sql
CREATE UNIQUE INDEX ON partner_highlights (placement, partner_id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX ON partner_highlights (placement, position)   WHERE removed_at IS NULL;
```

The same partial-index pattern as everywhere else: uniqueness applies only to active highlights, the history stays intact. A removal sets `removed_at`, it never deletes the row (rule R6).

**Two rules carried by the code:** only an `approved` partner is eligible, and every placement or removal writes to `audit_log`. The second point matters: we must be able to say who put a given shop on the home page, and when.

### 3.8 `accounts`

The central table, **almost entirely internal**. The front end never sees an `account` object, only computed balances.

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `id` | `UUID` PK | `AccountId` | 🔒 |
| `owner_type` | `account_owner` | `AccountOwner` | 🔒 |
| `owner_id` | `UUID NULL` | `Option<Uuid>` | 🔒 |
| `system_code` | `TEXT NULL` UNIQUE | `Option<String>` | 🔒 |
| `payment_handle` | `TEXT NULL` UNIQUE | `Option<String>` | 🔒 dormant (flow 2) |
| `balance_settled` | `BIGINT` | `Money` | ✅ `settled` (employee only) |
| `balance_held` | `BIGINT` | `Money` | ✅ `held` (employee only) |
| — computed — | — | `Money` | ✅ `available` = `settled - held` |
| `status` | `account_status` | `AccountStatus` | ⚠️ `status` |
| `version` | `BIGINT` | `i64` | 🔒 |
| `opened_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | 🔒 |
| `closed_at` | `TIMESTAMPTZ NULL` | `Option<DateTime<Utc>>` | ⚠️ `closed_at` |

> **Vocabulary, not to be confused.** On the employee side: `settled`, `held`, `available`. On the partner side: `total_received`, never "balance". They are not the same thing (decision 9) and displaying it as a balance would be wrong.

### 3.9 `payment_tokens`

| Column | SQL | Rust | Exposed |
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

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `id` | `UUID` PK | `OperationId` | ✅ `id` (transaction identifier) |
| `kind` | `operation_kind` | `OperationKind` | ✅ `kind` |
| `amount` | `BIGINT` | `Money` | ✅ `amount` |
| `memo` | `TEXT NULL` | `Option<String>` | ⚠️ `memo` |
| `created_by` | `UUID NULL` FK | `Option<UserId>` | ⚠️ |
| `occurred_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ✅ `occurred_at` |
| `recorded_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ⚠️ `recorded_at` |

> `occurred_at` is the real moment (the scan at the merchant's), `recorded_at` the moment it reached the server. In degraded mode they differ. **Displayed lists sort on `occurred_at`.**

### 3.11 `ledger_entries`

🔒 **Entirely internal.** No column is ever exposed. The front end does not know this table exists.

| Column | SQL | Rust |
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

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `operation_id` | `UUID` PK FK | `OperationId` | ✅ `id` |
| `token_jti` | `UUID` UNIQUE FK | `Jti` | ✅ `jti` |
| `partner_id` | `UUID` FK | `PartnerId` | ✅ through `partner` |
| `from_account` | `UUID` FK | `AccountId` | 🔒 |
| `entry_mode` | `entry_mode` | `EntryMode` | ✅ `entry_mode` |
| `scanned_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ✅ `scanned_at` |
| `synced_at` | `TIMESTAMPTZ` | `DateTime<Utc>` | ✅ `synced_at` |

### 3.13 `topups`

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `operation_id` | `UUID` PK FK | `OperationId` | ✅ `id` |
| `batch_id` | `UUID NULL` FK | `Option<BatchId>` | ⚠️ `batch_id` |
| `employer_id` | `UUID` FK | `EmployerId` | ✅ through `employer_name` |
| `to_account` | `UUID` FK | `AccountId` | 🔒 |
| `reference` | `TEXT NULL` | `Option<String>` | ✅ `reference` |

### 3.14 `compensations`

| Column | SQL | Rust | Exposed |
|---|---|---|---|
| `operation_id` | `UUID` PK FK | `OperationId` | ✅ `id` |
| `original_operation_id` | `UUID` FK | `OperationId` | ✅ `original_id` |
| `reason` | `TEXT` | `String` | ✅ `reason` |
| `approved_by` | `UUID` FK | `UserId` | ⚠️ `approved_by` |

### 3.15 `topup_batches`

| Column | SQL | Rust | Exposed |
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

🔒 **Entirely internal**, except for `audit_log` which is consulted by administration.

`sessions`: `id`, `user_id`, `token_hash`, `ip_address`, `user_agent`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`.
`api_clients`: `id`, `employer_id`, `client_id`, `secret_hash`, `label`, `status`, `last_used_at`, `created_at`.
`audit_log`: `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `payload`, `ip_address`, `created_at`.

---

## 4. API payloads

**This is the only section the front end needs to read.** TypeScript types ready to copy.

> **Amounts.** Every field typed `number` that denotes a sum is an **amount in euros, decimal, two decimals at most**: `456.56`, `3.99`, `25` (which means €25.00). The backend refuses negative values and those with more than two decimals, with a `422`. The currency is the euro everywhere, and the `currency` field is always `"EUR"`.
>
> Internal storage is in whole cents, but that does not concern the front end: it never appears in a payload.

### 4.1 Common envelopes

```ts
interface Paginated<T> {
  items: T[];
  next_cursor: string | null;   // null = end of list
}

interface ApiError {
  error: string;        // stable code, e.g. "TOKEN_EXPIRED"
  message: string;      // for humans, never for code
  request_id: string;
}

interface CityRef    { id: string; name: string; department: string; }
interface PartnerRef { id: string; trade_name: string; category: string; }
```

### 4.2 Public surface — A3, no authentication

**No field other than those listed here must appear on it.** See rule R9.

```ts
// GET /api/v1/public/featured-partners
interface PublicPartner {
  id: string;
  trade_name: string;
  category: string;
  service_mode: ServiceMode;
  city: CityRef | null;          // null if service_mode === "online"
  district: string | null;
  website_url: string | null;
  position: number;              // order chosen by administration
}
type PublicFeaturedList = PublicPartner[];

// GET /api/v1/public/cities
type PublicCityList = CityRef[];
```

Forbidden on this surface: amounts, statistics, `legal_name`, `ifu`, precise address, contacts, approval dates, internal identifiers other than `partner.id`. Only `approved` partners appear there.

### 4.3 Authentication

```ts
// POST /api/v1/auth/login
interface LoginRequest  { email: string; password: string; }
interface LoginResponse {
  user: { id: string; email: string; role: UserRole; display_name: string; };
}
// The session token is set as an httpOnly cookie. It NEVER appears in the body.

// POST /api/v1/auth/logout  -> 204
```

### 4.4 Employee space

```ts
// GET /api/v1/me/balance
interface BalanceResponse {
  settled: number;      // total held by the account
  held: number;         // reserved by active tokens
  available: number;    // settled - held  <- THIS is the number displayed large
  currency: string;     // ISO 4217 code
}

// GET /api/v1/me/transactions?cursor=&limit=
interface EmployeeTransaction {
  id: string;
  kind: OperationKind;
  amount: number;
  direction: "in" | "out";      // "in" = top-up, "out" = payment
  counterparty: string;         // partner's trade_name, or employer's legal_name
  occurred_at: string;
  reference: string | null;
}
type EmployeeTransactionList = Paginated<EmployeeTransaction>;

// GET /api/v1/me/minister-picks    <- A2
interface MinisterPick {
  partner: CatalogItem;
  position: number;
}
type MinisterPickList = MinisterPick[];

// POST /api/v1/me/payment-tokens
interface AuthorizeRequest  { amount: number; }
interface IssuedTokenResponse {
  jti: string;
  short_code: string;      // "K7M2-P4XQ", displayed under the QR code
  amount: number;
  issued_at: string;
  expires_at: string;      // issued_at + 5 min
  qr_payload: string;      // encode as-is into the QR code, without transformation
}

// DELETE /api/v1/me/payment-tokens/{jti}  -> 204
```

### 4.5 Partner space

```ts
// GET /api/v1/partner/summary?from=&to=
interface PartnerSummary {
  total_received: number;      // NOT a balance (decision 9)
  transaction_count: number;
  period_from: string;
  period_to: string;
  is_official_partner: boolean;   // A4 — derived from status === "approved"
}

// GET /api/v1/partner/transactions?from=&to=&cursor=
interface PartnerTransaction {
  id: string;
  amount: number;
  entry_mode: EntryMode;
  occurred_at: string;         // = scanned_at, what the merchant recognises
  synced_at: string;
  customer_label: string;      // "K. A." — never the full name
}

// POST /api/v1/partner/payments
interface SettleRequest {
  jti: string | null;          // set if scanned
  short_code: string | null;   // set if typed manually. Exactly one of the two.
  scanned_at: string;          // local timestamp of the scan, indicative
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

// POST /api/v1/partner/payments/batch  — offline resynchronisation
interface BatchSettleRequest { items: SettleRequest[]; }
interface BatchSettleResult {
  jti: string | null;          // null if the line carried an unknown short_code
  status: "settled" | "failed";
  payment: PaymentResponse | null;
  error: string | null;        // error code if failed
}
interface BatchSettleResponse { results: BatchSettleResult[]; }
// results[i] answers items[i], and the batch preserves the order received: it is the rank,
// not the jti, that maps back to the local queue.
// A failing line never brings down the batch. The front end removes every "settled"
// line from its queue, and reports the "failed" ones.
```

### 4.6 Catalogue — *amended by A1*

```ts
// GET /api/v1/catalog?city=&service_mode=&q=&cursor=
interface CatalogItem {
  id: string;
  trade_name: string;
  category: string;
  service_mode: ServiceMode;      // A1
  city: CityRef | null;           // null if "online"
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

// POST /api/v1/admin/partners/{id}/approve  -> 204
// POST /api/v1/admin/partners/{id}/reject
interface RejectRequest { reason: string; }

// -- Highlights (A2) ---------------------------------
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
  position: number | null;      // null = append at the end of the list
}
// DELETE /api/v1/admin/highlights/{id}  -> 204  (sets removed_at, does not delete)

// PUT /api/v1/admin/highlights/reorder
interface ReorderRequest {
  placement: HighlightPlacement;
  ordered_ids: string[];        // complete list, in the desired order
}

// -- Top-ups -----------------------------------------
// POST /api/v1/admin/topups
interface TopupRequest {
  employer_id: string;
  employer_ref: string;         // the payroll reference (decision 12)
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
  errors: BatchLineError[];     // if non-empty, validation will be refused
}
interface BatchLineError { line: number; employer_ref: string; reason: string; }

// POST /api/v1/admin/topup-batches/{id}/validate  -> 204

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
  online_partners: {                       // A1 — the partners with no city
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

> **A1, the point not to miss:** without the `online_partners` block, the volume of online shops disappears from the national dashboard, since they belong to no city. The sum of `by_city` then no longer equals `total_volume`.

### 4.8 HR-system integration

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

## 5. The contents of the QR code

The format returned in `qr_payload`, encoded as-is by the front end. The offline partner decodes it and **verifies the signature with no network**.

```
CP1.<base64url(payload_json)>.<base64url(signature)>
```

`payload_json`:

```json
{ "jti": "…", "amt": 2500, "exp": "2026-08-31T14:28:05Z", "iss": "cartepro" }
```

**Signature: Ed25519.** The server signs with its private key, the partner application embeds the public key and verifies locally.

> **Security point:** do not use HMAC here. HMAC would require the partner to hold the server's secret key in order to verify, which would give them the means to forge tokens. Offline verification requires an **asymmetric** signature.

**The expiry contained in the QR code is indicative.** The one that counts is checked by the server at settlement, but **against the instant of the scan and not against the clock at reception time**: a token scanned during its validity window is settled even if the synchronisation only arrives hours later. That is what makes the offline queue usable.

The server bounds the `scanned_at` the front end sends it with three limits, and the front end must know them:

- beyond `RESYNC_MAX_AGE_HOURS` of age, the line is refused with `RESYNC_TOO_LATE` — it is lost, it must be removed from the queue and the merchant must be told;
- a `scanned_at` later than the server clock is **clamped** to it, with no error: a till whose clock runs fast gains nothing, but it breaks nothing either;
- a `scanned_at` earlier than the token's issuance is refused with `TOKEN_EXPIRED`.

The partner application uses the QR code's expiry for display and to refuse the obvious locally, not as an authority.

---

## 6. Error codes

Stable for life. The front end reacts to `error`, never to `message`.

| Code | HTTP | Meaning | What the front end does |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | session missing or expired | redirects to login |
| `FORBIDDEN` | 403 | wrong role | error screen |
| `VALIDATION_FAILED` | 422 | invalid format | shows the offending fields |
| `TOKEN_NOT_FOUND` | 404 | unknown `jti` or `short_code` | "code not found" |
| `TOKEN_EXPIRED` | 410 | token out of date | "token expired, ask for a new QR code" |
| `TOKEN_ALREADY_USED` | 409 | consumed by someone else | "already settled" — remove from the queue |
| `INSUFFICIENT_FUNDS` | 422 | available < amount | "insufficient balance" |
| `PARTNER_NOT_APPROVED` | 403 | partner not approved | status screen |
| `ACCOUNT_INACTIVE` | 403 | account suspended or closed | status screen |
| `RESYNC_TOO_LATE` | 422 | offline settlement older than `RESYNC_MAX_AGE_HOURS` | "line too old" — remove from the queue, it will never go through |
| `DUPLICATE_BATCH` | 409 | file already imported | "this file has already been processed" |
| `BATCH_HAS_ERRORS` | 422 | invalid lines | shows `errors[]` |
| `HIGHLIGHT_NOT_ELIGIBLE` | 422 | partner not `approved` (A2) | "partner not approved" |
| `HIGHLIGHT_DUPLICATE` | 409 | already highlighted at that placement | ignore |
| `RATE_LIMITED` | 429 | too many attempts | back off |
| `INTERNAL` | 500 | server error | generic message + `request_id` |

**The special case of idempotence:** a settlement replayed by the **same** partner returns `200` with the existing transaction, not an error. It is a success, not a conflict. Only a token consumed by **another** partner gives `TOKEN_ALREADY_USED`.

---

## 7. Glossary

To be used as-is in the code, the interface and conversations. The confusions in this list have visible consequences.

| Term | Exact meaning | Not to be confused with |
|---|---|---|
| **settled** | what the employee account holds | `available`, which is net of reservations |
| **held** | reserved by active tokens, not spent | already spent |
| **available** | `settled - held`. **The figure displayed large.** | `settled` |
| **total_received** | cumulative amount received by a partner | a balance: it is not spendable (decision 9) |
| **token** | authorisation to pay a precise amount, 5 min | the QR code, which is only its representation |
| **short_code** | 8 characters for manual entry | a PIN or a password |
| **occurred_at** | the real moment of the scan | `synced_at`, the moment it reached the server |
| **operation** | a movement of money, of any nature | `payment`, which is only one of its natures |
| **compensation** | reversing operation correcting a mistake | cancellation: nothing is ever cancelled (decision 4) |
| **employer_ref** | payroll reference, unique **per employer** | a national identifier |
| **partner** | a single point of sale (decision 11) | a company with several shops |
| **service_mode** | physical, online, or both (A1) | approval status |
| **highlight** | a placement decided by administration (A2) | the official badge, which follows from status |
| **is_official_partner** | derived from `status === "approved"` (A4) | a stored field: it does not exist in the database |
| **settle** (partner) | confirm a settlement -> `settle` | **approve** (admin): approve a registration -> `approve` |

The last point deserves attention: the specification uses the same French word for two unrelated actions. In the code, `settle` and `approve`. In the interface, "Encaisser" and "Approuver".

---

## 8. Automatic generation

This document freezes the vocabulary, it does not replace mechanical verification.

```
Rust DTO -> utoipa -> openapi.json -> openapi-typescript -> types.ts
```

The front end imports the generated `types.ts`, never hand-copied interfaces. A field renamed on the backend then breaks the front-end build immediately, instead of producing a silent `undefined` on integration day.

Add the generation to CI and publish `openapi.json` on every merge.
