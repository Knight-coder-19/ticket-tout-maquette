# CartePro — Personal data and GDPR

> What personal data the backend holds, why, what protects it, and what is still missing.
> Companion to `docs/sovereignty.md` (where the data lives) and `docs/data-model.md` (how it is
> stored). Scope: the backend only. The front end keeps its own record.

This is a working record, not a legal opinion. Sections 1 to 4 describe what the code actually
does today; section 6 lists what is not done.

---

## 1. The personal data actually held

| Table | Personal data | Why it exists |
|---|---|---|
| `users` | e-mail, password digest, role, status, last login | authentication |
| `employees` | last name, first name, phone | identifying the beneficiary |
| `employment_links` | payroll reference, employer, start and end dates | establishing entitlement |
| `employers` | contact e-mail, contact phone | administrative contact |
| `partners` | trade and legal name, address, contact | the merchant directory, largely business data |
| `accounts` | balances | the amount a named person holds |
| `payment_tokens` | amount, issue and expiry times | in-flight authorisations |
| `payments`, `payment_attempts` | who paid, at which merchant, when, how much | the purchase history |
| `ledger_operations`, `ledger_entries` | amounts and instants, linked to an account | the accounting record |
| `sessions` | IP address, user agent | session security |
| `audit_log` | actor, IP address, JSON payload | administrative traceability |

### The sharp point: the purchase history is the sensitive part

Names and e-mail addresses are ordinary. What deserves attention is `payments` joined to
`partners`: it says where a named person spent money, when, and how much. Over ninety days that is a
behavioural profile — habits, neighbourhood, working hours.

And one category matters more than the others: **a payment at a pharmacy allows an inference about
health.** The data is not health data in the sense of Article 9, but it permits an inference of the
same nature, and it should be treated with the caution that implies. Concretely: the merchant
category should never be exposed on any surface that does not strictly need it, and any future
aggregate statistic by category must be checked for re-identification before it is published.

---

## 2. Data minimisation actually implemented

These are measures in the code, not intentions:

- **The partner never learns who paid.** `payments/repo.rs` computes the customer label in SQL as
  initials — `"K. A."` — with a `LEFT JOIN`; the full name never leaves PostgreSQL. An account with
  no employee record yields a dash rather than making the line disappear (decision 29).
- **The transaction export carries no name.** Its six columns are identifiers, a date, an integer
  and a status word. That property is locked by a test asserting the exact bytes
  (`crates/core/tests/csv_export.rs`).
- **The public surface is an allow-list, not a filter.** `PublicPartner` names each exposed field
  explicitly, and rule R9 forbids `#[serde(flatten)]` on it, precisely so that adding a column to
  the domain cannot silently publish it.
- **Coordinates are dormant.** `partners.latitude` and `partners.longitude` exist in the schema and
  are exposed nowhere.
- **The session token is never stored in clear.** Only its SHA-256 digest is kept; a database leak
  does not yield the means to impersonate anyone.

---

## 3. Security measures actually implemented

| Measure | Where |
|---|---|
| argon2id password hashing, explicit parameters | `crypto/password.rs` |
| Constant-time behaviour for unknown accounts | `login` hashes against a dummy digest, so response time does not reveal which accounts exist |
| Session tokens hashed at rest | `identity/session.rs`, decision 31 |
| Role separation enforced by the database | `cartepro_app` has no `UPDATE` or `DELETE` on the ledger, the audit log, the attempts or the compensations |
| Append-only accounting and audit trail | triggers `forbid_mutation()` plus revoked privileges, two independent layers |
| Compile-time checked access control | `AuthUser<R>` makes a handler for the wrong role fail to build |
| Asymmetric token signature | Ed25519, so a partner verifies offline without ever holding a secret |
| No secret in the logs | `crates/core` emits no log at all; no short code or token is ever printed |

---

## 4. The tension worth writing down: erasure against an immutable ledger

The right to erasure (Article 17) meets a system whose accounting record is, by design, impossible
to modify or delete — enforced by triggers and by revoked privileges, and verified by invariant I8.

These are not actually in conflict, but the answer has to be explicit:

- **The accounting record is kept.** It is processing necessary for compliance with a legal
  obligation and for the establishment of claims — Article 17(3)(b) and (e). Deleting a ledger entry
  would also break double-entry balance for every other party to that operation, including the
  merchant, who has their own right to their accounting record.
- **Identifying data is erasable.** `users` and `employees` are ordinary tables: name, first name,
  phone and e-mail can be overwritten or nulled.
- **Erasure therefore means severing the link, not deleting the history.** Once
  `accounts.owner_id` no longer resolves to an identified person, the ledger keeps amounts and
  instants that are no longer attributable. The amounts remain, the person disappears.
- **One consequence to accept:** `payments.partner_id` still says which merchant was paid, so the
  history remains re-identifiable by correlation if the person is otherwise known. That is a limit
  to state, not to hide.

This procedure is described here and **not implemented**. See section 6.

---

## 5. Data subject rights, as things stand

| Right | State |
|---|---|
| Access | partial — an employee reads their own balance and statement through `/me/*`; there is no single export of everything held about them |
| Rectification | possible — the identity tables accept `UPDATE`; no dedicated endpoint |
| Erasure | designed in section 4, **not implemented** |
| Portability | not available — the CSV export is reserved for administrators |
| Objection, restriction | not applicable to a service the person opts into |
| Automated decision-making | none — no profiling, no scoring, no automated refusal beyond an arithmetic balance check |

---

## 6. What is missing, plainly

1. **No retention policy anywhere.** `sessions` keeps an IP address and a user agent indefinitely;
   `audit_log` likewise. Nothing purges anything. A duration must be set per table, and a purge job
   must exist — a `DELETE` that the append-only tables will, by construction, refuse, so those need
   anonymisation rather than deletion.
2. **Erasure is not implemented.** Section 4 describes a procedure; no code performs it.
3. **No lawful basis is documented.** For a public scheme this is likely a public-interest task, but
   it must be written down by the sponsor, not assumed by us.
4. **No processor list and no data processing agreement**, because nothing is deployed. This becomes
   due at the same time as question Q1 of the sovereignty note.
5. **No self-service export** for an employee, which is what portability would require.
6. **No breach procedure**: who is notified, within what deadline, on what evidence. The audit log
   and the hash chain give the evidence; the procedure does not exist.

---

## 7. Two properties that help, and are worth claiming

The hash chain over `ledger_entries` means any tampering with the financial history is **detectable**
after the fact, by replaying `verify_chain`. Very few systems can demonstrate integrity that way.

And the append-only audit log records who did what on the administrative surface — approving a
partner, placing a highlight, crediting an account — with an actor and an IP address. That is exactly
the accountability evidence Article 5(2) asks for, provided the retention question in section 6 is
settled.
