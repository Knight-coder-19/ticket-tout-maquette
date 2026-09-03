/**
 * Les types du réseau, tels que le back les sert.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AVERTISSEMENT DE PROVENANCE — à lire avant de faire confiance à ce fichier
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Au 2026-09-02, le back n'expose AUCUNE route et ne définit AUCUN DTO en
 * Rust. Les sept fichiers de `backend/crates/api/src/dto/` sont des fichiers
 * de commentaires : 18 lignes en tout, pas une `struct`, pas un `derive`.
 * Vérifiable en une commande :
 *
 *     git show front:backend/crates/api/src/dto/employee.rs
 *
 * Chaque type ci-dessous porte donc sa source. Deux niveaux, jamais mélangés :
 *
 *   - « Source : backend/... »   le fichier Rust dit quelque chose de la forme
 *                                (même en commentaire) ;
 *   - « Source : docs/... — non encore implémenté côté back »
 *                                la forme n'existe QUE dans la documentation.
 *
 * Le second niveau est le cas général. Aucun de ces types n'a jamais été
 * confronté à une réponse réelle.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RÈGLE D'USAGE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Ces types ne servent QUE dans `src/lib/api/adaptateurs.ts`.
 * Aucun composant, aucun hook, aucun service ne doit en importer un : ils
 * décrivent le fil, pas le domaine. Le domaine est dans `types/domaine.ts`
 * et `types/encaissement.ts`, et il ne bouge pas quand le back change d'avis.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI DES `type` ET PAS DES `interface`
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un alias de type littéral reçoit une signature d'index implicite ; une
 * `interface` non. Cela rend chaque type ci-dessous assignable à
 * `Readonly<Record<string, unknown>>`, ce qui permet à `centimesDepuis()` de
 * lire un champ par son nom sans un seul `as` ni un seul `any`. C'est la
 * seule raison de ce choix — ne pas le convertir en `interface`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CONVENTIONS DU BACK (docs/data-dictionary.md:15-21)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   Casse       snake_case partout, JSON compris. Aucune traduction aux
 *               frontières — c'est le rôle des adaptateurs, pas du back.
 *   Identifiants chaîne UUID v4, jamais un nombre.
 *   Montants    nombre décimal EN EUROS, deux décimales au maximum. `456.56`.
 *               Confirmé dans le code : backend/crates/core/src/money.rs:145
 *               sérialise `serialize_f64(self.0 as f64 / SUBUNIT as f64)`
 *               avec `SUBUNIT = 100` (money.rs:13).
 *   Dates       ISO 8601 UTC avec `Z`. `"2026-08-31T14:23:05Z"`.
 *   Énumérations minuscules, identiques aux ENUM PostgreSQL.
 *   Absence     `null`, jamais chaîne vide ni `0`.
 *   Codes err.  SCREAMING_SNAKE, stables à vie.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. ÉNUMÉRATIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : docs/data-dictionary.md:54-69 — non encore implémenté côté back
 *          en tant que DTO, mais les ENUM PostgreSQL correspondants existent
 *          réellement : backend/migrations/0001_schema.sql:4-16.
 *
 * « Valeurs identiques des trois côtés. Toute nouvelle valeur est un
 * changement cassant. » (data-dictionary.md:51)
 */
export type UserRole = "employee" | "partner" | "admin";
export type UserStatus = "active" | "suspended" | "closed";
export type LinkStatus = "active" | "ended";
export type PartnerStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "closed";
export type AccountOwner = "employee" | "partner" | "system";
export type AccountStatus = "active" | "suspended" | "closed";
export type TokenStatus = "active" | "consumed" | "expired" | "cancelled";
/**
 * `operation_kind` (`0001_schema.sql:11`) — les quatre valeurs du schéma.
 *
 * ⚠ `regularisation` EST NOTRE AJOUT. Aucune des quatre ne décrit une
 * correction administrative : `topup` est un financement adressé par matricule
 * (`funding/topup.rs:1`), `compensation` reverse une opération connue et exige
 * un `original_operation_id` NOT NULL (`corrections/mod.rs:1`). Le détail du
 * raisonnement est dans `mocks/registre.ts`.
 *
 * Si le back refuse cet ajout, c'est ici et dans l'ENUM que cela se voit.
 */
export type OperationKind =
  | "topup"
  | "payment"
  | "compensation"
  | "closure_forfeit"
  | "regularisation";
export type EntryDirection = "debit" | "credit";
export type EntryMode = "qr_scan" | "short_code";
export type BatchStatus = "draft" | "validated" | "rejected";
export type ServiceMode = "physical" | "online" | "both";
export type HighlightPlacement = "minister_pick" | "public_featured";

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. ENVELOPPES COMMUNES
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : docs/data-dictionary.md:319-322 — non encore implémenté côté back.
 * L'extracteur correspondant est décrit en commentaire :
 * backend/crates/api/src/extractors/pagination.rs:1-3 — curseur opaque base64
 * encapsulant `(valeur_de_tri, id)`, limite plafonnée à 100, keyset seulement,
 * jamais d'OFFSET.
 *
 * ⚠ Incompatible avec `ReponsePaginee` du front (offset : page / taillePage /
 * total). Ce n'est pas un renommage : le back ne compte pas les lignes et ne
 * peut donc pas produire `total`. Voir front/docs/contrat-api.md, divergence
 * D10. Aucun adaptateur ne convertit l'un vers l'autre : il n'y a pas de
 * conversion honnête possible.
 */
export type Paginated<T> = {
  items: T[];
  /** `null` = fin de liste. */
  next_cursor: string | null;
};

/**
 * Source : docs/data-dictionary.md:324-328 — non encore implémenté côté back.
 * Décrit aussi en commentaire dans backend/crates/api/src/error.rs:1-3
 * (« emitting { error, message, request_id } ») et dans
 * docs/TASK-DISTRIBUTION-BACKEND.md:422-426.
 *
 * `error` est une CHAÎNE PLATE, pas un objet. « Le front réagit sur `error`,
 * jamais sur `message`. » (data-dictionary.md:626)
 */
export type ApiError = {
  /** Code stable à vie, SCREAMING_SNAKE. Ex. `"TOKEN_EXPIRED"`. */
  error: string;
  /** Pour l'humain, jamais pour du code. */
  message: string;
  /** Écho de l'en-tête X-Request-Id (middleware/request_id.rs:1-3). */
  request_id: string;
};

/**
 * Source : front/src/app/api/payment-tokens/route.ts:30-36 et
 *          front/src/app/api/payment-tokens/[token]/route.ts:17-23.
 *
 * Ce n'est PAS la forme du back. C'est celle que servent les routes de
 * simulation du front, et que lit `encaissement.service.ts:16,36-37`.
 * Elle est déclarée ici parce que `depuisErreur()` doit accepter les deux
 * tant que le back n'a pas tranché. Voir contrat-api.md, divergence D7.
 */
export type ErreurImbriquee = {
  error: {
    code: string;
    message: string;
  };
};

/**
 * Source : docs/data-dictionary.md:330 — non encore implémenté côté back.
 * La table `cities` existe : backend/migrations/0001_schema.sql:18-24.
 */
export type CityRef = {
  id: string;
  name: string;
  department: string;
};

/**
 * Source : docs/data-dictionary.md:331 — non encore implémenté côté back.
 */
export type PartnerRef = {
  id: string;
  trade_name: string;
  category: string;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. SURFACE PUBLIQUE — amendement A3, sans authentification
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : backend/crates/api/src/dto/public.rs:1-3 — le fichier Rust NOMME
 * les huit champs (« id, trade_name, category, service_mode, city, district,
 * website_url, position ») mais ne les type pas : aucune `struct` n'est
 * écrite. Les types viennent de docs/data-dictionary.md:340-349.
 *
 * Règle R9, citée dans le fichier Rust : « never a #[serde(flatten)], never a
 * reuse of CatalogItem: that is how contacts, amounts or an internal id would
 * leak. » Interdits ici : montants, statistiques, legal_name, ifu, adresse
 * précise, contacts, dates de validation (data-dictionary.md:356).
 *
 * ⚠ Ce type ne porte PAS `is_official_partner` : sur cette surface, seuls les
 * partenaires `approved` figurent, la question ne se pose donc pas.
 */
export type PublicPartner = {
  id: string;
  trade_name: string;
  category: string;
  service_mode: ServiceMode;
  /** `null` si `service_mode === "online"`. */
  city: CityRef | null;
  district: string | null;
  website_url: string | null;
  /** Ordre voulu par l'administration. */
  position: number;
};

/** Source : docs/data-dictionary.md:350 — non encore implémenté côté back. */
export type PublicFeaturedList = PublicPartner[];

/** Source : docs/data-dictionary.md:353 — non encore implémenté côté back. */
export type PublicCityList = CityRef[];

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. AUTHENTIFICATION
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : docs/data-dictionary.md:362 — non encore implémenté côté back.
 * Route câblée nulle part : backend/crates/api/src/routes/auth.rs:1-3.
 */
export type LoginRequest = {
  email: string;
  password: string;
};

/**
 * Source : docs/data-dictionary.md:363-365 — non encore implémenté côté back.
 *
 * « Le jeton de session est posé en cookie httpOnly. Il n'apparaît JAMAIS
 * dans le corps. » (data-dictionary.md:366) Cookie nommé `session`,
 * `HttpOnly` + `Secure` + `SameSite=Strict`
 * (TASK-DISTRIBUTION-BACKEND.md:456,480 ; routes/auth.rs:2).
 */
export type LoginResponse = {
  user: {
    id: string;
    email: string;
    role: UserRole;
    display_name: string;
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. ESPACE EMPLOYÉ
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : backend/crates/api/src/dto/employee.rs:1 — le fichier Rust nomme
 * les trois champs (« balance { settled, held, available } ») sans les typer.
 * Types et quatrième champ : docs/data-dictionary.md:375-380.
 *
 * `available = settled - held`. C'est CE nombre qui s'affiche en grand
 * (data-dictionary.md:378, glossaire :660).
 *
 * ⚠ Ce type ne porte AUCUN horodatage. `Solde.misAJourLe` du domaine n'a donc
 * pas de source ici : voir `depuisSolde()` dans adaptateurs.ts. `SirhBalance`,
 * elle, porte `as_of` — l'asymétrie n'est expliquée nulle part.
 */
export type BalanceResponse = {
  /** Total possédé. Euros décimaux. */
  settled: number;
  /** Réservé par des jetons actifs. Euros décimaux. */
  held: number;
  /** `settled - held`. Euros décimaux. */
  available: number;
  /** Code ISO 4217. Vaut toujours `"EUR"` (docs/decisions.md:114-115). */
  currency: string;
};

/**
 * Source : docs/data-dictionary.md:383-391 — non encore implémenté côté back.
 * Mentionné sans détail dans dto/employee.rs:2 (« transaction page »).
 */
export type EmployeeTransaction = {
  id: string;
  kind: OperationKind;
  /** Euros décimaux. Voir l'avertissement en tête de fichier. */
  amount: number;
  /** `"in"` = rechargement, `"out"` = paiement. */
  direction: "in" | "out";
  /** `trade_name` du partenaire, ou `legal_name` de l'employeur. */
  counterparty: string;
  occurred_at: string;
  /**
   * ⚠ AMBIGU. Déclaré `string | null` à data-dictionary.md:390, sans un mot
   * sur ce qu'il contient. `TopupRequest` porte aussi un champ `reference`
   * (:542), ce qui suggère la référence du rechargement — mais rien ne le
   * dit, et surtout rien ne dit qu'il porterait l'`original_operation_id`
   * d'une compensation. `depuisTransaction()` ne s'en sert donc pas pour
   * remplir `transactionOrigineId`.
   */
  reference: string | null;
};

/** Source : docs/data-dictionary.md:392 — non encore implémenté côté back. */
export type EmployeeTransactionList = Paginated<EmployeeTransaction>;

/**
 * Source : docs/data-dictionary.md:395-398 (amendement A2) — non encore
 * implémenté côté back. Cité dans dto/employee.rs:2 (« minister picks »).
 */
export type MinisterPick = {
  partner: CatalogItem;
  position: number;
};

/** Source : docs/data-dictionary.md:399 — non encore implémenté côté back. */
export type MinisterPickList = MinisterPick[];

/**
 * Source : backend/crates/api/src/dto/employee.rs:2 (« authorize request »)
 * et docs/data-dictionary.md:402. Non encore implémenté côté back.
 *
 * Le montant est fixé À L'ÉMISSION, par le salarié — pas à la caisse. C'est
 * `authorize()` qui le lit, réserve les fonds et signe le jeton :
 * backend/crates/core/src/payments/authorize.rs:1-3.
 */
export type AuthorizeRequest = {
  /** Euros décimaux, deux décimales au maximum, strictement positif. */
  amount: number;
};

/**
 * Source : backend/crates/api/src/dto/employee.rs:2-3 — le fichier Rust nomme
 * cinq des six champs (« jti, short_code, amount, expires_at, qr_payload »),
 * `issued_at` ne vient que de docs/data-dictionary.md:405.
 *
 * ⚠ CONTRADICTION NON RÉSOLUE. dto/employee.rs:3 écrit « Amounts stay plain
 * integers », ce qui décrirait des centimes entiers. docs/decisions.md:62-71
 * (amendement A5) impose au contraire des euros décimaux sur le fil, et
 * money.rs:145 le confirme dans le code compilable. Le commentaire du DTO est
 * antérieur à A5 et n'a pas été relu. `centimesDepuis()` traite les deux cas
 * plutôt que de parier sur l'un — voir adaptateurs.ts.
 *
 * ⚠ Le statut HTTP de cette réponse n'est écrit nulle part : 200 ou 201 ?
 * data-dictionary.md:401 ne l'annote pas, alors que les routes à 204 le sont.
 */
export type IssuedTokenResponse = {
  /** UUID du jeton (core/src/ids.rs:81 — `newtype_id!(Jti)`). */
  jti: string;
  /** Huit caractères, affiché `"K7M2-P4XQ"` sous le QR. */
  short_code: string;
  amount: number;
  issued_at: string;
  /** `issued_at + 5 min` (TOKEN_TTL_SECONDS=300, backend/.env.example:29). */
  expires_at: string;
  /** À encoder tel quel dans le QR, sans transformation. */
  qr_payload: string;
};

/**
 * Source : docs/data-dictionary.md:606-620 — non encore implémenté côté back.
 *
 * Contenu décodé de `qr_payload`, dont l'enveloppe est
 * `CP1.<base64url(payload_json)>.<base64url(signature)>`, signature Ed25519.
 *
 * Déclaré ici pour mémoire : le front n'a aucune raison de le décoder (c'est
 * l'application partenaire hors ligne qui le fait), et `adaptateurs.ts` ne
 * fournit volontairement aucune conversion pour ce type.
 */
export type ChargeUtileQr = {
  jti: string;
  /**
   * ⚠ UNKNOWN — unité indéterminée, et c'est le point où j'ai hésité le plus
   * longtemps. L'exemple de data-dictionary.md:612 donne `"amt": 2500`, ce qui
   * se lit spontanément « 2500 centimes = 25,00 € ». Mais l'amendement A5
   * (docs/decisions.md:62-71) impose les euros décimaux sur le fil, auquel cas
   * `2500` vaut 2500 €. La section 5 du dictionnaire n'a pas été relue après
   * A5, et rien dans le Rust ne tranche : crypto/token_sig.rs:1-3 ne décrit
   * pas la charge utile. Un facteur cent sépare les deux lectures.
   */
  amt: unknown;
  /** Expiration INDICATIVE. Seule celle vérifiée par le serveur fait foi. */
  exp: string;
  iss: string;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. ESPACE PARTENAIRE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : backend/crates/api/src/dto/partner.rs:1 (« summary ») et
 * docs/data-dictionary.md:419-425. Non encore implémenté côté back.
 *
 * `total_received` n'est PAS un solde : « ce n'est pas dépensable »
 * (glossaire, data-dictionary.md:661). Il n'existe aucune notion de
 * reversement côté back.
 */
export type PartnerSummary = {
  /** Cumul encaissé sur la période. Euros décimaux. */
  total_received: number;
  transaction_count: number;
  period_from: string;
  period_to: string;
  /** Amendement A4 — dérivé de `status === "approved"`, jamais stocké. */
  is_official_partner: boolean;
};

/**
 * Source : backend/crates/api/src/dto/partner.rs:1 (« transaction page ») et
 * docs/data-dictionary.md:428-435. Non encore implémenté côté back.
 *
 * ⚠ `customer_label` vaut `"K. A."` — JAMAIS le nom complet
 * (data-dictionary.md:434). L'écran d'encaissement du front affiche
 * aujourd'hui `employee.name` : voir contrat-api.md, divergence D14.
 */
export type PartnerTransaction = {
  id: string;
  /** Euros décimaux. */
  amount: number;
  entry_mode: EntryMode;
  /** `= scanned_at`, ce que le commerçant reconnaît. */
  occurred_at: string;
  /** Moment d'arrivée au serveur. */
  synced_at: string;
  customer_label: string;
};

/**
 * Source : docs/data-dictionary.md:438-442 — non encore implémenté côté back.
 *
 * ⚠ CONFLIT DE NOMMAGE NON RÉSOLU. Le dictionnaire décrit deux champs
 * nullables, `jti` et `short_code`, « exactement un des deux ». Le Rust dit
 * autre chose : dto/partner.rs:2 parle d'une « settle request carrying
 * token_ref plus scanned_at », et core/src/payments/mod.rs:1 déclare bien un
 * type `TokenRef` (« scanned jti or typed short code »), c'est-à-dire une
 * union d'un seul champ. Le corps JSON réel n'est donc pas décidé. La forme
 * ci-dessous est celle du contrat publié, qui fait autorité par défaut.
 *
 * ⚠ AUCUN CHAMP `amount` — et c'est volontaire : le montant a été fixé à
 * l'émission du jeton et les fonds sont déjà réservés
 * (core/src/payments/settle.rs:1). Le front envoie aujourd'hui un montant à
 * l'encaissement : voir contrat-api.md, divergence D4.
 */
export type SettleRequest = {
  /** Renseigné si scan. */
  jti: string | null;
  /** Renseigné si saisie manuelle. Exactement un des deux. */
  short_code: string | null;
  /** Horodatage local du scan, INDICATIF (invariant I7, data-model.md:123). */
  scanned_at: string;
};

/**
 * Source : backend/crates/api/src/dto/partner.rs:2 (« payment response ») et
 * docs/data-dictionary.md:443-451. Non encore implémenté côté back.
 *
 * ⚠ Ce type ne porte NI l'identité du salarié (refus délibéré, cf.
 * `customer_label`), NI de marqueur de rejeu. Un règlement rejoué par le même
 * partenaire renvoie `200` avec cette même forme et `status: "settled"` :
 * rien ne le distingue d'un premier encaissement (data-dictionary.md:645).
 * Le domaine du front attend les deux : voir divergences D13 et D14, et
 * `depuisEncaissement()` dans adaptateurs.ts.
 */
export type PaymentResponse = {
  id: string;
  jti: string;
  /** Euros décimaux. */
  amount: number;
  entry_mode: EntryMode;
  occurred_at: string;
  synced_at: string;
  status: "settled";
};

/**
 * Source : docs/data-dictionary.md:454-461 — non encore implémenté côté back.
 * Cité dans dto/partner.rs:2-3 : « a per-row status so a failing row never
 * drops the batch ».
 */
export type BatchSettleRequest = {
  items: SettleRequest[];
};

/** Source : docs/data-dictionary.md:455-460 — non encore implémenté. */
export type BatchSettleResult = {
  jti: string;
  status: "settled" | "failed";
  payment: PaymentResponse | null;
  /** Code d'erreur SCREAMING_SNAKE si `status === "failed"`. */
  error: string | null;
};

/** Source : docs/data-dictionary.md:461 — non encore implémenté. */
export type BatchSettleResponse = {
  results: BatchSettleResult[];
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. CATALOGUE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : backend/crates/api/src/dto/catalog.rs:1 — le fichier Rust ne nomme
 * que « the approved-partner entry with city and neighbourhood », sans un
 * seul champ typé. Les neuf champs viennent de
 * docs/data-dictionary.md:470-480.
 *
 * ⚠ `category` est une CHAÎNE, pas un identifiant. Le schéma n'a aucune table
 * de catégories (backend/migrations/0001_schema.sql, 18 tables, aucune
 * `categories`). Le domaine du front attend un `categorieId: Identifiant`
 * (types/domaine.ts:22) : l'adaptateur passe le libellé tel quel et le dit.
 *
 * ⚠ Aucun champ de mise en avant. `Partenaire.estMisEnAvant` n'a donc pas de
 * source ici : voir `depuisPartenaire()`.
 */
export type CatalogItem = {
  id: string;
  trade_name: string;
  /** Libellé, pas un identifiant. Voir ci-dessus. */
  category: string;
  service_mode: ServiceMode;
  /** `null` si `service_mode === "online"`. */
  city: CityRef | null;
  district: string | null;
  address_line: string | null;
  website_url: string | null;
  /** Amendement A4 — dérivé de `status === "approved"`. */
  is_official_partner: boolean;
};

/** Source : docs/data-dictionary.md:481 — non encore implémenté côté back. */
export type CatalogList = Paginated<CatalogItem>;

/** Source : docs/data-dictionary.md:484 — non encore implémenté côté back. */
export type CityList = CityRef[];

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. ADMINISTRATION
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : backend/crates/api/src/dto/admin.rs:1 (« partner review ») et
 * docs/data-dictionary.md:491-505. Non encore implémenté côté back.
 *
 * ⚠ Ce type ne porte NI `siren` NI objet social. `ifu` est un identifiant
 * fiscal, ce n'est pas un SIREN, et il est nullable là où le domaine du front
 * exige un `siren: string` non nul (types/domaine.ts:55). Voir
 * `depuisDemandePartenaire()` : ces deux champs sont demandés à l'appelant
 * plutôt qu'inventés à partir d'`ifu`.
 */
export type PartnerReviewItem = {
  id: string;
  legal_name: string;
  trade_name: string;
  category: string;
  /** Identifiant fiscal. N'est pas un SIREN. */
  ifu: string | null;
  service_mode: ServiceMode;
  city: CityRef | null;
  district: string | null;
  address_line: string | null;
  website_url: string | null;
  contact_email: string;
  status: PartnerStatus;
  submitted_at: string;
};

/**
 * ⚠ UNKNOWN — enveloppe indéterminée, même raison que
 * `PartnerTransactionList`. `GET /api/v1/admin/partners?status=&cursor=`
 * accepte un curseur (data-dictionary.md:490) sans que sa réponse soit
 * annotée `Paginated<T>` (:491-505).
 */
export type PartnerReviewList = unknown;

/** Source : docs/data-dictionary.md:509 — non encore implémenté côté back. */
export type RejectRequest = {
  /** Obligatoire. « Un refus sans motif enregistré n'est pas opposable. » */
  reason: string;
};

/**
 * ⚠ UNKNOWN — corps de réponse jamais spécifié.
 * `POST /api/v1/admin/partners/{id}/reject` (data-dictionary.md:508) n'est
 * annoté ni `→ 204` ni d'un type de réponse, contrairement à `/approve`
 * juste au-dessus (:507) qui est explicitement `→ 204`. Le silence est-il un
 * oubli ou un corps non nul ? Non tranché.
 */
export type RejectResponse = unknown;

/**
 * Source : docs/data-dictionary.md:513-520 (amendement A2) — non encore
 * implémenté côté back. Cité dans dto/admin.rs:1-2.
 */
export type HighlightItem = {
  id: string;
  partner: PartnerRef;
  placement: HighlightPlacement;
  position: number;
  created_by: string;
  created_at: string;
};

/** Source : docs/data-dictionary.md:523-527 — non encore implémenté. */
export type CreateHighlightRequest = {
  partner_id: string;
  placement: HighlightPlacement;
  /** `null` = ajouter en fin de liste. */
  position: number | null;
};

/**
 * ⚠ UNKNOWN — corps de réponse jamais spécifié
 * (data-dictionary.md:522). Même silence que `RejectResponse`.
 */
export type CreateHighlightResponse = unknown;

/** Source : docs/data-dictionary.md:531-534 — non encore implémenté. */
export type ReorderRequest = {
  placement: HighlightPlacement;
  /** Liste COMPLÈTE, dans l'ordre voulu. */
  ordered_ids: string[];
};

/**
 * ⚠ UNKNOWN — corps de réponse jamais spécifié
 * (data-dictionary.md:530).
 */
export type ReorderResponse = unknown;

/** Source : docs/data-dictionary.md:538-543 — non encore implémenté. */
export type TopupRequest = {
  employer_id: string;
  /** Le matricule, unique par employeur (décision 12). */
  employer_ref: string;
  /** Euros décimaux. */
  amount: number;
  reference: string | null;
};

/**
 * ⚠ UNKNOWN — corps de réponse jamais spécifié
 * (data-dictionary.md:537).
 */
export type TopupResponse = unknown;

/**
 * Source : backend/crates/api/src/dto/admin.rs:1 (« batch upload and its
 * preview ») et docs/data-dictionary.md:546-553. Non encore implémenté.
 *
 * ⚠ La requête est un `multipart`, dont le NOM DU CHAMP FICHIER n'est écrit
 * nulle part (data-dictionary.md:545). Aucun type de requête n'est donc
 * déclaré ici : je ne l'invente pas.
 */
export type BatchPreview = {
  batch_id: string;
  file_name: string;
  line_count: number;
  /** Euros décimaux. */
  total_amount: number;
  status: BatchStatus;
  /** Si non vide, la validation sera refusée. */
  errors: BatchLineError[];
};

/** Source : docs/data-dictionary.md:554 — non encore implémenté. */
export type BatchLineError = {
  line: number;
  employer_ref: string;
  reason: string;
};

/** Source : docs/data-dictionary.md:559 — non encore implémenté. */
export type CompensationRequest = {
  original_operation_id: string;
  reason: string;
};

/**
 * ⚠ UNKNOWN — corps de réponse jamais spécifié
 * (data-dictionary.md:558).
 */
export type CompensationResponse = unknown;

/**
 * Source : backend/crates/api/src/dto/admin.rs:2 (« dashboard ») et
 * docs/data-dictionary.md:562-573. Non encore implémenté côté back.
 *
 * Le bloc `online_partners` est indispensable : sans lui, la somme des
 * `by_city` ne vaut plus `total_volume`, les commerces en ligne
 * n'appartenant à aucune ville (data-dictionary.md:583).
 */
export type Dashboard = {
  /** Euros décimaux. */
  total_volume: number;
  transaction_count: number;
  active_partners: number;
  pending_partners: number;
  active_employees: number;
  by_city: {
    city: CityRef;
    volume: number;
    transaction_count: number;
  }[];
  /** Amendement A1 — les partenaires sans ville. */
  online_partners: {
    volume: number;
    transaction_count: number;
  };
};

/**
 * Source : backend/crates/api/src/dto/admin.rs:2 (« the chain verification
 * result ») et docs/data-dictionary.md:576-580. Non encore implémenté.
 *
 * Correspond à l'invariant I5 (docs/data-model.md:104-112) : `verify_chain`
 * renvoie le premier `seq` incohérent.
 */
export type ChainVerification = {
  valid: boolean;
  checked_entries: number;
  first_invalid_seq: number | null;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. INTÉGRATION SIRH
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Source : backend/crates/api/src/dto/integration.rs:1 — le fichier Rust dit
 * « the employee balance response keyed by employer_ref. Expose no internal
 * id. » Les six champs viennent de docs/data-dictionary.md:589-596.
 *
 * Seule forme de solde du contrat qui porte un horodatage (`as_of`) : c'est
 * pourquoi `depuisSoldeSirh()` n'a besoin d'aucun complément, là où
 * `depuisSolde()` en exige un.
 *
 * ⚠ Le schéma d'authentification de cette route n'est jamais nommé :
 * extractors/api_client.rs:1-3 dit « read from the authorization header
 * against the hashed secret », sans dire Basic, Bearer ou autre. Sans objet
 * pour ce type, mais bloquant pour qui voudra l'appeler.
 */
export type SirhBalance = {
  employer_ref: string;
  settled: number;
  held: number;
  available: number;
  currency: string;
  as_of: string;
};

/* ===========================================================================
 * 10. NOTRE PROPOSITION -- pas le contrat du back
 * =========================================================================== */

/**
 * Une ligne du journal des decisions.
 *
 * ATTENTION : le back n'expose AUCUNE route de lecture d'`audit_log`. Le
 * journal, lui, est bien le sien -- table `audit_log`
 * (`0001_schema.sql:265-274`), alimentee par `review.rs:1-2`, et decrite
 * « consultee par l'administration » (`data-dictionary.md:300`). Mais la
 * section 4.7 n'en sert aucune ligne : la seule route d'audit du contrat est
 * `GET /admin/audit/verify` (:575-580), qui rend une verification de chaine,
 * pas un journal.
 *
 * Les champs ci-dessous sont donc les COLONNES de leur table, en snake_case
 * (`data-dictionary.md:304`), servies par une route que nous proposons. A
 * confirmer avec l'equipe back avant que quoi que ce soit s'y appuie
 * durablement.
 */
export type LigneJournal = {
  id: string;
  actor_id: string | null;
  /** Verbe libre. Le notre : `partner.approved`, `partner.rejected`. */
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

/** Enveloppe de la meme route. `Paginated<T>` du contrat (:319-322). */
export type JournalList = Paginated<LigneJournal>;

/**
 * Une ligne du registre des comptes partenaires.
 *
 * ⚠ NOTRE PROPOSITION, servie par `GET /api/v1/admin/partner-accounts`. Le
 * contrat n'a qu'une liste de partenaires, `GET /admin/partners?status=&cursor=`
 * (:490), qui sert `PartnerReviewItem` : les treize premiers champs ci-dessous,
 * et rien de plus.
 *
 * Les cinq derniers sont de nous, avec les noms déjà écrits ailleurs dans leur
 * contrat pour ne pas en inventer :
 *   - `reviewed_by`, `reviewed_at`, `review_reason` — colonnes de `partners`
 *     (`0001_schema.sql:115-117`), exposées à l'administration selon la §3.6
 *     (:156-158) mais absentes du DTO de la §4.7 ;
 *   - `total_received`, `transaction_count` — noms de `PartnerSummary`
 *     (:419-421), que le contrat définit pour l'espace partenaire.
 */
export type PartnerAccountItem = PartnerReviewItem & {
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  /** Cumul encaissé, en euros décimaux. */
  total_received: number;
  transaction_count: number;
};

/** Enveloppe de la même route. `Paginated<T>` du contrat (:319-322). */
export type PartnerAccountList = Paginated<PartnerAccountItem>;

/**
 * Une écriture du registre, telle que la sert
 * `GET /api/v1/admin/ledger-entries`.
 *
 * ⚠ NOTRE PROPOSITION. Le contrat n'expose aucune lecture du journal : la
 * section 4.7 n'en contient pas, et `GET /admin/audit/verify` (:575-580) rend
 * un booléen et deux compteurs, pas des lignes.
 *
 * Les noms sont les COLONNES de `ledger_entries` et `ledger_operations`
 * (`0001_schema.sql:160-185`), en snake_case comme le reste du contrat. Les
 * quatre derniers champs sont des jointures servies pour éviter à l'écran de
 * les faire lui-même — un identifiant de compte ne dit rien à un agent.
 */
export type LedgerEntryItem = {
  seq: number;
  operation_id: string;
  account_id: string;
  account_owner_type: "employee" | "partner" | "system" | null;
  account_owner_id: string | null;
  account_system_code: string | null;
  direction: EntryDirection;
  /** Euros décimaux, comme tout montant du contrat. */
  amount: number;
  recorded_at: string;
  /** Empreinte de l'écriture précédente, 64 hexadécimaux. */
  prev_hash: string;
  hash: string;
  kind: OperationKind | null;
  memo: string | null;
  occurred_at: string | null;
  created_by: string | null;
  /** Identifiant de l'opération qui a annulé celle-ci, `null` sinon. */
  compensated_by: string | null;
  compensation_reason: string | null;
};

/** Enveloppe de la même route. `Paginated<T>` du contrat (:319-322). */
export type LedgerEntryList = Paginated<LedgerEntryItem>;

/**
 * L'état du compte d'un partenaire, vu par son titulaire.
 *
 * ⚠ NOTRE PROPOSITION, servie par `GET /api/v1/partner/account`. La section 4.5
 * du contrat n'expose aucune route de ce genre, alors que la section 3.6 dit
 * `review_reason` « visible du partenaire en cas de rejet » (:158) : l'intention
 * est écrite, la route manque.
 *
 * Les noms sont les colonnes de `partners` (`0001_schema.sql:98-124`).
 */
export type PartnerAccountStatus = {
  id: string;
  /** Le nom affiché. 🌐 en section 3.6 : rien de sensible. */
  trade_name: string;
  /**
   * La raison sociale et l'identifiant fiscal.
   *
   * ⚠️ en section 3.6 — « exposé uniquement à l'administration ». Ce marqueur
   * dit qu'ils ne vont pas au CATALOGUE : la section 4.6 les interdit
   * nommément sur la surface publique (:356), aux côtés des montants et des
   * contacts. Il protège un commerçant des autres, pas de lui-même.
   *
   * Ici le lecteur EST le titulaire : ce sont les valeurs qu'il a lui-même
   * déclarées à l'adhésion, et que `PartnerReviewItem` (:492-496) sert déjà
   * telles quelles à l'agent qui instruit son dossier. Les lui cacher sur sa
   * propre fiche ne protégerait personne, et l'empêcherait de voir qu'une
   * coquille s'est glissée dans son identifiant fiscal.
   */
  legal_name: string;
  /** `TEXT NULL` (:105) : un dossier peut avoir été accepté sans. */
  ifu: string | null;
  /** Libellé venu des données, jamais d'une liste écrite dans l'interface. */
  category: string;
  /**
   * 🌐 en section 3.6 — rien de sensible. Sans lui, la fiche ne saurait pas
   * distinguer une ville MANQUANTE d'une ville qui n'a pas lieu d'être : un
   * commerce en ligne n'en a aucune, par contrainte (`physical_needs_city`).
   */
  service_mode: ServiceMode;
  status: PartnerStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  contact_email: string;
  city: CityRef | null;
};

/**
 * Un jeton résolu au comptoir, sans être consommé.
 *
 * ⚠ NOTRE PROPOSITION, servie par
 * `GET /api/v1/partner/payment-tokens/{reference}`. Le contrat n'a AUCUNE route
 * qui lise un jeton sans le régler : ni la section 4.5, ni
 * `crates/api/src/routes/partner.rs`. C'est la divergence D6 de
 * `front/docs/contrat-api.md`.
 *
 * Sans elle, un caissier qui saisit un code à la main règle à l'aveugle : il ne
 * voit ni le montant réservé, ni le bénéficiaire, ni l'échéance. Dans le modèle
 * du back, où le montant vient du jeton et non de la caisse, cette lecture
 * n'est pas un confort — c'est la seule façon de savoir ce qu'on encaisse.
 *
 * `customer_label` suit la règle du contrat : « K. A. », jamais le nom complet
 * (`data-dictionary.md:434`).
 */
export type ResolvedTokenItem = {
  jti: string;
  /** Huit caractères au format `XXXX-XXXX`. */
  short_code: string;
  /** Euros décimaux, comme tout montant du contrat. */
  amount: number;
  customer_label: string;
  expires_at: string;
};

/**
 * Une journée de recettes.
 *
 * ⚠ NOTRE PROPOSITION, servie par `GET /api/v1/partner/daily-revenue`. Le
 * contrat n'a aucune série journalière : `PartnerSummary` (:419-425) rend
 * quatre agrégats sur UNE période, et le tableau de bord national agrège par
 * ville (:568), pas par jour.
 *
 * Les noms sont ceux de `PartnerSummary`, repris par jour, pour donner au back
 * un vocabulaire déjà écrit s'il adopte la route.
 */
export type DailyRevenueItem = {
  /** `YYYY-MM-DD`, le type `DATE` du dictionnaire (:41). */
  day: string;
  /** Euros décimaux. Zéro les jours sans recette — ils sont servis. */
  total_received: number;
  transaction_count: number;
};

/** Enveloppe de la même route. */
export type DailyRevenueList = { days: DailyRevenueItem[] };

/**
 * Un encaissement du journal partenaire.
 *
 * ✅ Les six premiers champs sont ceux du CONTRAT, `PartnerTransaction`
 * (`data-dictionary.md:427-435`).
 *
 * ⚠ Les deux derniers sont NOTRE AJOUT. Le DTO ne porte aucun état, alors qu'un
 * encaissement peut avoir été annulé par une compensation
 * (`corrections/mod.rs:1-3`). Un journal qui présenterait une ligne annulée
 * comme un encaissement ordinaire mentirait au commerçant sur ce qu'il a
 * réellement encaissé.
 */
export type PartnerTransactionItem = {
  id: string;
  /** Euros décimaux. */
  amount: number;
  entry_mode: EntryMode;
  /** `= scanned_at`, ce que le commerçant reconnaît. */
  occurred_at: string;
  /** Moment d'arrivée au serveur. */
  synced_at: string;
  /** « K. A. » — jamais le nom complet. */
  customer_label: string;
  /** NOTRE AJOUT. */
  status: "settled" | "compensated";
  /** NOTRE AJOUT. Motif de l'annulation, `null` si la ligne tient. */
  compensation_reason: string | null;
};

/**
 * Enveloppe de la même route.
 *
 * ⚠ NOTRE CHOIX, et il tranche une ambiguïté du contrat : la route accepte un
 * `cursor` (:427) mais sa réponse n'est pas annotée `Paginated<T>`,
 * contrairement à `/me/transactions` (:392) et `/catalog` (:481). Un curseur en
 * entrée sans curseur en sortie ne se poursuit pas — on retient donc
 * l'enveloppe du contrat. Ambiguïté A7 de `front/docs/contrat-api.md`, à
 * confirmer avec l'équipe back.
 */
export type PartnerTransactionList = Paginated<PartnerTransactionItem>;

/**
 * Une catégorie du référentiel.
 *
 * ⚠ NOTRE PROPOSITION, servie par `GET /api/v1/categories`. Le contrat a
 * `GET /api/v1/cities` pour les villes (:483-484) mais rien pour les
 * catégories, et le schéma n'a pas de table : `partners.category` est un texte
 * libre (`0001_schema.sql:104`).
 *
 * Sans elle, un filtre de catégories ne peut qu'être écrit en dur — ce que la
 * règle de B. Sellami interdit — ou dérivé d'une page partielle, ce qui le
 * ferait changer à chaque pagination.
 */
export type CategoryItem = {
  name: string;
  /** Nombre de partenaires agréés dans cette catégorie. */
  partner_count: number;
};

export type CategoryList = CategoryItem[];


/**
 * Une transaction de la vue nationale.
 *
 * ⚠ NOTRE PROPOSITION, servie par `GET /api/v1/admin/transactions`. Le contrat
 * n'expose côté administration que des AGRÉGATS — `GET /admin/dashboard`
 * (:561-573) rend un volume, un décompte et une ventilation par ville, mais
 * aucune ligne. Un tableau de bord dit « combien », jamais « lesquelles ».
 */
export type AdminTransactionItem = {
  id: string;
  occurred_at: string;
  amount: number;
  partner: {
    id: string;
    /** `null` si la fiche est introuvable — le registre survit au référentiel. */
    trade_name: string | null;
    category: string | null;
    /** `null` pour un commerce exclusivement en ligne (contrainte A1). */
    city: CityRef | null;
  };
  /** ⚠ Notre ajout : aucun état sur une transaction dans le contrat. */
  status: "settled" | "cancelled";
  compensation_reason: string | null;
};

/**
 * L'enveloppe de la même route.
 *
 * ⚠ `Paginated<T>` (:319-322) ne porte que `items` et `next_cursor` ; `totals`
 * est notre ajout. Le total en tête de l'écran doit valoir pour le filtre
 * courant : le calculer depuis `items` donnerait le total d'une page présenté
 * comme un total national, et une seconde route diverger dès qu'un filtre
 * serait transmis à l'une et pas à l'autre.
 *
 * Les noms `total_volume` et `transaction_count` sont ceux de leur `Dashboard`
 * (:562-563) — même grandeur, même nom. `cancelled_count` est notre ajout.
 */
export type AdminTransactionList = Paginated<AdminTransactionItem> & {
  totals: {
    transaction_count: number;
    cancelled_count: number;
    /** NET : une opération annulée n'y figure pas. */
    total_volume: number;
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
 * RÉPERTOIRE DES BÉNÉFICIAIRES — ⚠ ROUTES DE NOTRE FAIT
 *
 * Le répertoire existe en base (`employees`, `employers`, `employment_links`)
 * et dans `core/src/directory/`, mais la section 4 du contrat ne le lit nulle
 * part : les seules lectures d'un salarié sont `/me/*` (lui-même) et
 * `/integration/.../balance` (le SIRH de son employeur, un solde et rien
 * d'autre). Voir les en-têtes des routes sous `app/api/v1/admin/employees/`.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** `user_status` (`0001_schema.sql:5`) — les trois valeurs, pas deux. */
export type EmployeeStatus = "actif" | "suspendu" | "ferme";

/** Une ligne du répertoire. Le solde y est le seul `available`. */
export type EmployeeDirectoryItem = {
  id: string;
  last_name: string;
  first_name: string;
  display_name: string;
  /** `null` si le lien d'emploi ne résout aucun employeur. */
  employer: { id: string; legal_name: string } | null;
  /** `employment_links.employer_ref` : le matricule (décision 12). */
  employer_ref: string;
  status: EmployeeStatus;
  /** Euros décimaux sur le fil, comme tout montant du contrat. */
  available: number;
};

export type EmployeeDirectoryList = Paginated<EmployeeDirectoryItem>;

/**
 * Les trois soldes.
 *
 * Mêmes noms que leur `BalanceResponse` (`data-dictionary.md:374-380`), et
 * servis ensemble : ils ne sont pas interchangeables.
 */
export type EmployeeBalance = {
  settled: number;
  held: number;
  /** `settled - held`. C'est ce nombre qu'on affiche en grand (:378). */
  available: number;
};

export type EmployeeDetail = {
  id: string;
  last_name: string;
  first_name: string;
  display_name: string;
  phone: string | null;
  status: EmployeeStatus;
  employer: { id: string; legal_name: string; ifu: string | null } | null;
  employer_ref: string;
  /** `employment_links.started_at`, une DATE et non un instant. */
  started_at: string;
  balance: EmployeeBalance;
  /** Ce qui explique la part réservée. */
  active_tokens: number;
};

/** Un employeur du référentiel. `employee_count` est notre ajout. */
export type EmployerItem = {
  id: string;
  legal_name: string;
  ifu: string | null;
  contact_email: string | null;
  status: EmployeeStatus;
  employee_count: number;
};

/**
 * Ce que rend une régularisation : le nouveau solde ET l'écriture.
 *
 * Les deux ensemble, jamais l'un sans l'autre. Rendre le seul solde laisserait
 * un instant où le nombre a changé sans que rien ne dise pourquoi — ce que la
 * règle R1 cherche précisément à rendre impossible.
 */
export type AdjustmentResult = {
  balance: EmployeeBalance;
  entry: {
    operation_id: string;
    kind: OperationKind;
    direction: EntryDirection;
    amount: number;
    memo: string | null;
    occurred_at: string;
    created_by: string | null;
  };
};
