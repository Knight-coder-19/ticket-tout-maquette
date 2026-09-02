/**
 * Magasin de donnees en memoire.
 * Il tient lieu de backend le temps que l'API reelle existe : les routes
 * de `src/app/api` lisent et ecrivent ici, et nulle part ailleurs.
 *
 * Regle monetaire : tous les montants sont des entiers de centimes.
 * Aucun flottant ne traverse ce fichier (T. Vignal). La conversion vers les
 * euros decimaux que sert le back a lieu au moment de repondre, dans
 * `mocks/enveloppe.ts`, jamais ici.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE MODÈLE EST CELUI DU BACK
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le salarie fixe le montant a l'emission ; les fonds sont **reserves** ; le
 * partenaire regle sur une reference de jeton, sans jamais saisir de montant.
 * Sources : `core/src/payments/authorize.rs:1-3`, `settle.rs:1-3`,
 * `expire.rs:1-3`, et `docs/data-dictionary.md:401-412` et :437-451.
 *
 * Trois invariants du back sont tenus ici par construction :
 *
 *   I3  `held <= settled`, et `available = settled - held` jamais negatif
 *       (data-model.md:56-64) : `emettreJeton` refuse si le disponible ne
 *       couvre pas le montant.
 *   I4  `held` egale la somme des jetons **actifs** du compte
 *       (data-model.md:95-98) : `held` n'est pas stocke, il est **calcule**.
 *       Un cache ne peut pas deriver s'il n'existe pas.
 *   I6  un jeton n'est encaisse qu'une fois (data-model.md:114-121) : un
 *       jeton quitte `active` pour exactement un etat terminal.
 */

import type {
  Identifiant,
  MontantCentimes,
  StatutTransaction,
} from "@/types/domaine";

/** Duree de validite d'un jeton, en millisecondes. `TOKEN_TTL_SECONDS=300`. */
export const TTL_JETON = 5 * 60 * 1000;

/** Un salarie suspendu conserve son solde mais ne peut plus emettre. */
export type StatutSalarie = "actif" | "suspendu";

export interface SalarieMagasin {
  id: Identifiant;
  nom: string;
  employeur: string;
  statut: StatutSalarie;
  /** Entier de centimes. C'est `balance_settled` : le total possede. */
  soldeCentimes: MontantCentimes;
}

/**
 * Une ville du referentiel. Table `cities` (`0001_schema.sql:18-22`),
 * exposee sous la forme `CityRef { id, name, department }`
 * (`data-dictionary.md:330`).
 *
 * ⚠ Incoherence preexistante du depot, signalee sans etre corrigee : la
 * migration `0002_cities.sql` charge des communes francaises, tandis que le
 * jeu de demonstration du front parle de Cotonou et Porto-Novo. On garde le
 * second pour ne pas reecrire des donnees qui s'affichent en demonstration.
 */
export interface VilleMagasin {
  id: Identifiant;
  name: string;
  department: string;
}

/**
 * Les cinq etats d'un partenaire.
 * ENUM `partner_status` (`0001_schema.sql:7`), repris tel quel — minuscules,
 * en anglais, identiques des trois cotes (`data-dictionary.md:51,57`).
 *
 * ⚠ Ne pas confondre avec `StatutPartenaire` de `types/domaine.ts`, qui est
 * l'union francaise du domaine du front (`en_attente | valide | refuse |
 * suspendu`) et qui n'a pas d'equivalent pour `closed`.
 */
export type StatutPartenaire =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "closed";

/** ENUM `service_mode` (`0001_schema.sql:15`), amendement A1. */
export type ModeService = "physical" | "online" | "both";

/**
 * Un partenaire, et donc une demande d'adhesion tant qu'il est `pending`.
 * Colonnes de `partners` (`0001_schema.sql:98-124`).
 *
 * Deux contraintes de la base sont tenues ici :
 *
 *   `physical_needs_city` (:118) — un partenaire non exclusivement en ligne
 *     a une ville. Le jeu de demonstration le respecte.
 *   `reviewed_is_complete` (:119-123) — `reviewedBy` et `reviewedAt` sont
 *     tous deux nuls, ou tous deux renseignes. Jamais l'un sans l'autre :
 *     c'est ce qui garantit qu'une decision porte toujours son auteur ET son
 *     horodatage.
 */
export interface PartenaireMagasin {
  id: Identifiant;
  /** `users.email` du compte partenaire, joint par le DTO (`:502`). */
  contactEmail: string;
  legalName: string;
  tradeName: string;
  category: string;
  /** Identifiant fiscal. `TEXT NULL` (:105) : un dossier peut etre incomplet. */
  ifu: string | null;
  serviceMode: ModeService;
  websiteUrl: string | null;
  /** `null` si et seulement si `serviceMode === "online"`. */
  cityId: Identifiant | null;
  district: string | null;
  addressLine: string | null;
  statut: StatutPartenaire;
  /** Date ISO 8601 du depot de la demande. */
  submittedAt: string;
  /** Auteur de la decision. `null` tant qu'elle n'est pas prise. */
  reviewedBy: Identifiant | null;
  /** Date ISO 8601 de la decision. */
  reviewedAt: string | null;
  /** Motif. Obligatoire au refus, facultatif a l'acceptation. */
  reviewReason: string | null;
  /**
   * Activite deja encaissee AVANT le jeu de demonstration, en centimes.
   *
   * ⚠ Amorce de simulation, sans equivalent dans le schema : `partners` n'a
   * pas de colonne de volume, le back le calculerait depuis `payments`. Elle
   * existe pour que la liste des comptes ne montre pas douze etablissements a
   * zero euro -- un agent qui suspend doit voir ce qu'il suspend.
   *
   * L'activite servie est cette amorce PLUS les paiements reellement ecrits
   * dans le magasin : encaisser en simulation fait bouger le chiffre.
   */
  historiqueCentimes: MontantCentimes;
  /** Meme chose, en nombre de reglements. */
  historiqueTransactions: number;
}

/**
 * Un utilisateur de l'administration : l'auteur d'une decision.
 * Sous-ensemble de `users` (`0001_schema.sql:26-35`).
 */
export interface AdministrateurMagasin {
  id: Identifiant;
  email: string;
  nom: string;
}

/**
 * Une entree du journal des decisions.
 *
 * C'est `audit_log` (`0001_schema.sql:265-274`), colonne pour colonne. Le
 * journal EST le leur : `review.rs:1-2` impose que `approve` et `reject`
 * ecrivent dedans, et `data-dictionary.md:300` le dit « consulte par
 * l'administration ». Seule la ROUTE qui l'expose est de notre fait — voir
 * `app/api/v1/admin/audit/route.ts`.
 *
 * En ajout seul (invariant I8, `data-model.md:132-140`) : les declencheurs
 * `forbid_mutation()` refusent `UPDATE` et `DELETE` cote base. Ici, aucune
 * fonction ne modifie ni ne retire une entree.
 */
export interface EntreeJournal {
  id: Identifiant;
  actorId: Identifiant | null;
  /** Verbe libre, `TEXT NOT NULL`. Voir `consignerAuJournal`. */
  action: string;
  entityType: string;
  entityId: Identifiant | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  /** Date ISO 8601. */
  createdAt: string;
}

/**
 * Les quatre etats d'un jeton.
 * Identiques a l'ENUM `token_status` (`migrations/0001_schema.sql:10`).
 */
export type StatutJeton = "active" | "consumed" | "expired" | "cancelled";

/** Comment le partenaire a presente le jeton. ENUM `entry_mode` (:13). */
export type ModeSaisie = "qr_scan" | "short_code";

/**
 * Un jeton de paiement.
 * Colonnes reprises de `payment_tokens` (`migrations/0001_schema.sql:142-154`).
 */
export interface JetonMagasin {
  jti: Identifiant;
  /** Huit caracteres, sans separateur. L'affichage `XXXX-XXXX` est cosmetique. */
  shortCode: string;
  employeeId: Identifiant;
  /** Entier de centimes. `CHECK (amount > 0)`, :151. */
  montantCentimes: MontantCentimes;
  statut: StatutJeton;
  /** Date ISO 8601. */
  issuedAt: string;
  /** Date ISO 8601. */
  expiresAt: string;
  /** Date ISO 8601 du passage a un etat terminal, `null` tant qu'actif (:153). */
  resolvedAt: string | null;
}

/** Un reglement ecrit au registre. Colonnes de `payments` (:190-197). */
export interface PaiementMagasin {
  id: Identifiant;
  /** Unique : c'est la protection contre le double encaissement (I6). */
  jti: Identifiant;
  partenaireId: Identifiant;
  montantCentimes: MontantCentimes;
  modeSaisie: ModeSaisie;
  /** Date ISO 8601. `= scanned_at`, ce que le commercant reconnait. */
  occurredAt: string;
  /** Date ISO 8601. Moment d'arrivee au serveur. */
  syncedAt: string;
}

export interface TransactionMagasin {
  id: Identifiant;
  /** Date ISO 8601. */
  date: string;
  salarieId: Identifiant;
  partenaireId: Identifiant;
  jetonToken: string | null;
  /** Entier de centimes. */
  montantCentimes: MontantCentimes;
  statut: StatutTransaction;
}

export interface Magasin {
  salaries: SalarieMagasin[];
  villes: VilleMagasin[];
  administrateurs: AdministrateurMagasin[];
  partenaires: PartenaireMagasin[];
  /** Le journal des decisions. En ajout seul. */
  journal: EntreeJournal[];
  /** Indexes par `jti`. */
  jetons: Map<Identifiant, JetonMagasin>;
  paiements: PaiementMagasin[];
  transactions: TransactionMagasin[];
}

/**
 * Jeu de donnees de demonstration.
 * Il est choisi pour que chaque refus soit atteignable depuis l'interface :
 * - SAL-001 : solde confortable, le parcours nominal ;
 * - SAL-002 : solde faible, le refus pour montant superieur au disponible ;
 * - SAL-003 : compte suspendu, le refus de compte.
 */
function donneesInitiales(): Magasin {
  return {
    salaries: [
      { id: "SAL-001", nom: "Amélie Roussel", employeur: "Mairie de Cotonou", statut: "actif", soldeCentimes: 15_000 },
      { id: "SAL-002", nom: "Bastien Nkoue", employeur: "Mairie de Cotonou", statut: "actif", soldeCentimes: 350 },
      { id: "SAL-003", nom: "Clara Doumbia", employeur: "Office du tourisme", statut: "suspendu", soldeCentimes: 0 },
    ],
    villes: [
      { id: "VIL-COT", name: "Cotonou", department: "Littoral" },
      { id: "VIL-PNO", name: "Porto-Novo", department: "Ouémé" },
      { id: "VIL-PAR", name: "Parakou", department: "Borgou" },
      { id: "VIL-ABC", name: "Abomey-Calavi", department: "Atlantique" },
      { id: "VIL-BOH", name: "Bohicon", department: "Zou" },
    ],
    administrateurs: [
      { id: "ADM-001", email: "f.pontaillac@ministere.gouv", nom: "F. Pontaillac" },
      { id: "ADM-002", email: "b.sellami@ministere.gouv", nom: "B. Sellami" },
    ],
    /*
     * Sept demandes en attente, plus un partenaire deja agree.
     *
     * Le jeu est construit pour que la file de validation soit representative :
     * six categories distinctes, cinq villes, un commerce exclusivement en
     * ligne sans ville (contrainte `physical_needs_city`, :118), et des dates
     * de depot echelonnees sur un mois pour que le tri par anciennete ait un
     * sens.
     *
     * PRT-004 a `ifu: null` : c'est le dossier incomplet. Ce n'est pas un
     * champ invente pour l'occasion — `partners.ifu` est `TEXT NULL` (:105) et
     * le DTO l'expose `string | null` (`data-dictionary.md:496`). Aucun autre
     * champ du schema ne marque l'incompletude d'un dossier, il n'y a donc rien
     * de plus a en dire.
     */
    partenaires: [
      {
        id: "PRT-001",
        contactEmail: "contact@boulangerie-du-marche.bj",
        legalName: "SARL Boulangerie du Marché",
        tradeName: "Boulangerie du Marché",
        category: "alimentation",
        ifu: "3201900112233",
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-COT",
        district: "Ganhi",
        addressLine: "12 rue des Cocotiers",
        statut: "approved",
        submittedAt: "2026-07-12T09:00:00.000Z",
        reviewedBy: "ADM-001",
        reviewedAt: "2026-07-15T10:30:00.000Z",
        reviewReason: null,
        historiqueCentimes: 48_600,
        historiqueTransactions: 39,
      },
      {
        id: "PRT-002",
        contactEmail: "gerance@lespalmiers.bj",
        legalName: "SARL Les Palmiers",
        tradeName: "Librairie Les Palmiers",
        category: "culture",
        ifu: "3201900445566",
        serviceMode: "physical",
        websiteUrl: "https://lespalmiers.bj",
        cityId: "VIL-PNO",
        district: "Djegan Kpevi",
        addressLine: "4 avenue de la République",
        statut: "pending",
        submittedAt: "2026-08-05T08:15:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null,
        historiqueCentimes: 0,
        historiqueTransactions: 0,
      },
      {
        id: "PRT-003",
        contactEmail: "sonagnon.epicerie@courriel.bj",
        legalName: "Établissement Sonagnon",
        tradeName: "Épicerie Sonagnon",
        category: "alimentation",
        ifu: "3201900778899",
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-COT",
        district: "Akpakpa",
        addressLine: "77 rue du Port",
        statut: "pending",
        submittedAt: "2026-08-09T14:40:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null,
        historiqueCentimes: 0,
        historiqueTransactions: 0,
      },
      {
        id: "PRT-004",
        contactEmail: "lebaobab@courriel.bj",
        legalName: "SARL Le Baobab",
        tradeName: "Restaurant Le Baobab",
        category: "restauration",
        /* Dossier incomplet : l'identifiant fiscal manque. */
        ifu: null,
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-ABC",
        district: "Godomey",
        addressLine: "Carrefour Toyota",
        statut: "pending",
        submittedAt: "2026-08-14T11:05:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null,
        historiqueCentimes: 0,
        historiqueTransactions: 0,
      },
      {
        id: "PRT-005",
        contactEmail: "pharmacie.sainte-rita@courriel.bj",
        legalName: "Pharmacie Sainte-Rita",
        tradeName: "Pharmacie Sainte-Rita",
        category: "santé",
        ifu: "3201901223344",
        serviceMode: "both",
        websiteUrl: "https://pharmacie-sainte-rita.bj",
        cityId: "VIL-COT",
        district: "Sainte-Rita",
        addressLine: "3 boulevard Saint-Michel",
        statut: "pending",
        submittedAt: "2026-08-18T07:50:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null,
        historiqueCentimes: 0,
        historiqueTransactions: 0,
      },
      {
        id: "PRT-006",
        contactEmail: "cycles.du.zou@courriel.bj",
        legalName: "Cycles du Zou",
        tradeName: "Cycles du Zou",
        category: "mobilité",
        ifu: "3201901556677",
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-BOH",
        district: null,
        addressLine: "Marché Bohicon-centre",
        statut: "pending",
        submittedAt: "2026-08-22T16:20:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null,
        historiqueCentimes: 0,
        historiqueTransactions: 0,
      },
      {
        id: "PRT-007",
        contactEmail: "contact@kpanlingan.bj",
        legalName: "Kpanlingan Numérique",
        tradeName: "Librairie numérique Kpanlingan",
        category: "culture",
        ifu: "3201901889900",
        /* Exclusivement en ligne : pas de ville, et c'est conforme
           (`physical_needs_city`, :118). */
        serviceMode: "online",
        websiteUrl: "https://kpanlingan.bj",
        cityId: null,
        district: null,
        addressLine: null,
        statut: "pending",
        submittedAt: "2026-08-27T10:00:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null,
        historiqueCentimes: 0,
        historiqueTransactions: 0,
      },
      {
        id: "PRT-008",
        contactEmail: "salle.tokpa@courriel.bj",
        legalName: "Association Sportive Tokpa",
        tradeName: "Salle de sport Tokpa",
        category: "sport",
        ifu: "3201902001122",
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-PAR",
        district: "Zongo",
        addressLine: "18 rue de l'Hippodrome",
        statut: "pending",
        submittedAt: "2026-09-01T09:30:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null,
        historiqueCentimes: 0,
        historiqueTransactions: 0,
      },
      {
        id: "PRT-009",
        contactEmail: "gerant@aumarchedecotonou.bj",
        legalName: "SARL Au Marché de Cotonou",
        tradeName: "Au Marché de Cotonou",
        category: "alimentation",
        ifu: "3201902334455",
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-COT",
        district: "Dantokpa",
        addressLine: "Halle centrale, allée 3",
        statut: "approved",
        submittedAt: "2026-06-02T08:00:00.000Z",
        reviewedBy: "ADM-001",
        reviewedAt: "2026-06-05T09:15:00.000Z",
        reviewReason: null,
        historiqueCentimes: 1_284_50,
        historiqueTransactions: 106,
      },
      {
        id: "PRT-010",
        contactEmail: "contact@chezadjoa.bj",
        legalName: "Restaurant Chez Adjoa",
        tradeName: "Chez Adjoa",
        category: "restauration",
        ifu: "3201902667788",
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-PAR",
        district: "Guéma",
        addressLine: "42 route de Djougou",
        statut: "approved",
        submittedAt: "2026-06-18T13:20:00.000Z",
        reviewedBy: "ADM-002",
        reviewedAt: "2026-06-21T10:00:00.000Z",
        reviewReason: null,
        historiqueCentimes: 312_75,
        historiqueTransactions: 41,
      },
      {
        id: "PRT-011",
        contactEmail: "boutique@atelierdupapier.bj",
        legalName: "Atelier du Papier",
        tradeName: "Atelier du Papier",
        category: "culture",
        ifu: "3201902990011",
        serviceMode: "both",
        websiteUrl: "https://atelier-du-papier.bj",
        cityId: "VIL-PNO",
        district: "Ouando",
        addressLine: "9 rue des Artisans",
        statut: "approved",
        submittedAt: "2026-07-01T09:45:00.000Z",
        reviewedBy: "ADM-001",
        reviewedAt: "2026-07-03T16:30:00.000Z",
        reviewReason: null,
        historiqueCentimes: 47_20,
        historiqueTransactions: 6,
      },
      {
        id: "PRT-012",
        contactEmail: "direction@superettelafontaine.bj",
        legalName: "SARL La Fontaine",
        tradeName: "Supérette La Fontaine",
        category: "alimentation",
        ifu: "3201903223344",
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-COT",
        district: "Fidjrossè",
        addressLine: "120 boulevard de la Marina",
        statut: "suspended",
        submittedAt: "2026-05-11T07:30:00.000Z",
        reviewedBy: "ADM-001",
        reviewedAt: "2026-08-24T11:10:00.000Z",
        reviewReason:
          "Écarts répétés entre les encaissements déclarés et le registre. Compte suspendu le temps du contrôle.",
        historiqueCentimes: 803_10,
        historiqueTransactions: 74,
      },
      {
        id: "PRT-013",
        contactEmail: "club@tokpafitness.bj",
        legalName: "Association Tokpa Fitness",
        tradeName: "Tokpa Fitness",
        category: "sport",
        ifu: null,
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-BOH",
        district: null,
        addressLine: "Quartier Agbodjèdo",
        statut: "suspended",
        submittedAt: "2026-06-27T15:00:00.000Z",
        reviewedBy: "ADM-002",
        reviewedAt: "2026-08-30T09:00:00.000Z",
        reviewReason: "Identifiant fiscal jamais transmis malgré deux relances.",
        historiqueCentimes: 18_00,
        historiqueTransactions: 3,
      },
      {
        id: "PRT-014",
        contactEmail: "info@servicesplusbenin.bj",
        legalName: "Services Plus Bénin",
        tradeName: "Services Plus",
        category: "services",
        ifu: "3201903556677",
        serviceMode: "online",
        websiteUrl: "https://services-plus.bj",
        cityId: null,
        district: null,
        addressLine: null,
        statut: "rejected",
        submittedAt: "2026-07-20T10:05:00.000Z",
        reviewedBy: "ADM-001",
        reviewedAt: "2026-07-24T14:40:00.000Z",
        reviewReason:
          "Activité de conseil sans vente de biens ni de services au public : hors du champ du dispositif.",
        historiqueCentimes: 0,
        historiqueTransactions: 0,
      },
      {
        id: "PRT-015",
        contactEmail: "contact@deuxrouesduborgou.bj",
        legalName: "SARL Deux-Roues du Borgou",
        tradeName: "Deux-Roues du Borgou",
        category: "mobilité",
        ifu: "3201903889900",
        serviceMode: "physical",
        websiteUrl: null,
        cityId: "VIL-PAR",
        district: "Zongo",
        addressLine: "7 avenue de l'Indépendance",
        statut: "closed",
        submittedAt: "2026-04-15T08:00:00.000Z",
        reviewedBy: "ADM-002",
        reviewedAt: "2026-08-12T17:00:00.000Z",
        reviewReason: "Cessation d'activité déclarée par le gérant. Fermeture définitive du compte.",
        historiqueCentimes: 259_40,
        historiqueTransactions: 22,
      },
    ],
    journal: [
      {
        id: "AUD-001",
        actorId: "ADM-001",
        action: "partner.approved",
        entityType: "partner",
        entityId: "PRT-001",
        payload: { trade_name: "Boulangerie du Marché" },
        ipAddress: null,
        createdAt: "2026-07-15T10:30:00.000Z",
      },
      {
        id: "AUD-002",
        actorId: "ADM-001",
        action: "partner.approved",
        entityType: "partner",
        entityId: "PRT-009",
        payload: { trade_name: "Au Marché de Cotonou" },
        ipAddress: null,
        createdAt: "2026-06-05T09:15:00.000Z",
      },
      {
        id: "AUD-003",
        actorId: "ADM-002",
        action: "partner.approved",
        entityType: "partner",
        entityId: "PRT-010",
        payload: { trade_name: "Chez Adjoa" },
        ipAddress: null,
        createdAt: "2026-06-21T10:00:00.000Z",
      },
      {
        id: "AUD-004",
        actorId: "ADM-001",
        action: "partner.approved",
        entityType: "partner",
        entityId: "PRT-011",
        payload: { trade_name: "Atelier du Papier" },
        ipAddress: null,
        createdAt: "2026-07-03T16:30:00.000Z",
      },
      {
        id: "AUD-005",
        actorId: "ADM-001",
        action: "partner.rejected",
        entityType: "partner",
        entityId: "PRT-014",
        payload: {
          trade_name: "Services Plus",
          status: "rejected",
          reason:
            "Activité de conseil sans vente de biens ni de services au public : hors du champ du dispositif.",
        },
        ipAddress: null,
        createdAt: "2026-07-24T14:40:00.000Z",
      },
      {
        id: "AUD-006",
        actorId: "ADM-002",
        action: "partner.closed",
        entityType: "partner",
        entityId: "PRT-015",
        payload: {
          trade_name: "Deux-Roues du Borgou",
          status: "closed",
          reason: "Cessation d'activité déclarée par le gérant. Fermeture définitive du compte.",
        },
        ipAddress: null,
        createdAt: "2026-08-12T17:00:00.000Z",
      },
      {
        id: "AUD-007",
        actorId: "ADM-001",
        action: "partner.suspended",
        entityType: "partner",
        entityId: "PRT-012",
        payload: {
          trade_name: "Supérette La Fontaine",
          status: "suspended",
          reason:
            "Écarts répétés entre les encaissements déclarés et le registre. Compte suspendu le temps du contrôle.",
        },
        ipAddress: null,
        createdAt: "2026-08-24T11:10:00.000Z",
      },
      {
        id: "AUD-008",
        actorId: "ADM-002",
        action: "partner.suspended",
        entityType: "partner",
        entityId: "PRT-013",
        payload: {
          trade_name: "Tokpa Fitness",
          status: "suspended",
          reason: "Identifiant fiscal jamais transmis malgré deux relances.",
        },
        ipAddress: null,
        createdAt: "2026-08-30T09:00:00.000Z",
      },
    ],
    jetons: new Map<Identifiant, JetonMagasin>(),
    paiements: [],
    transactions: [
      { id: "TRX-001", date: "2026-08-28T09:14:00.000Z", salarieId: "SAL-001", partenaireId: "PRT-001", jetonToken: null, montantCentimes: 1_250, statut: "validee" },
      { id: "TRX-002", date: "2026-08-30T12:02:00.000Z", salarieId: "SAL-002", partenaireId: "PRT-001", jetonToken: null, montantCentimes: 480, statut: "validee" },
    ],
  };
}

/*
 * En developpement, Next recharge les modules a chaud : sans cette
 * accroche, un jeton emis disparaitrait avant d'etre resolu. Le magasin est
 * donc epingle sur globalThis, une seule fois par processus.
 */
const CLE_MAGASIN = "__carteproMagasin__";
type PorteeGlobale = typeof globalThis & Record<typeof CLE_MAGASIN, Magasin | undefined>;
const portee = globalThis as PorteeGlobale;

export const magasin: Magasin =
  portee[CLE_MAGASIN] ?? (portee[CLE_MAGASIN] = donneesInitiales());

/* ═══════════════════════════════════════════════════════════════════════════
 * REFERENTIEL
 * ═══════════════════════════════════════════════════════════════════════════ */

export function trouverSalarie(id: string): SalarieMagasin | undefined {
  return magasin.salaries.find((salarie) => salarie.id === id);
}

export function trouverPartenaire(id: string): PartenaireMagasin | undefined {
  return magasin.partenaires.find((partenaire) => partenaire.id === id);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CODES COURTS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Alphabet de `crypto/short_code.rs:1-2` : huit caracteres pris dans
 * `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, sans `0`, `O`, `1`, `I` ni `l`. Le code
 * est lu a voix haute au comptoir : toute paire ambigue est exclue.
 */
const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGUEUR_CODE = 8;

/**
 * Tire un caractere uniformement, par rejet.
 *
 * L'alphabet compte 31 caracteres, qui ne divise pas 256 : un simple
 * `octet % 31` favoriserait les premiers caracteres. On rejette les octets
 * au-dela du plus grand multiple de 31 inferieur a 256, ce qui retablit
 * l'uniformite. Ce n'est pas du zele : un tirage biaise reduit l'espace
 * reellement atteignable d'un code que quelqu'un pourrait deviner.
 */
function caractereAleatoire(): string {
  const taille = ALPHABET_CODE.length;
  const plafond = Math.floor(256 / taille) * taille;
  const octet = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(octet);
    const tire = octet[0] ?? 0;
    if (tire < plafond) return ALPHABET_CODE.charAt(tire % taille);
  }
}

function nouveauShortCode(): string {
  let valeur = "";
  for (let i = 0; i < LONGUEUR_CODE; i += 1) valeur += caractereAleatoire();
  return valeur;
}

/**
 * Normalise une saisie de comptoir : majuscules, sans separateur ni espace.
 * Le contrat affiche `"K7M2-P4XQ"` (data-dictionary.md:405) ; le tiret est
 * une aide a la lecture, pas une partie du code.
 */
export function normaliserShortCode(saisie: string): string {
  return saisie.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/** Met le code au format d'affichage `XXXX-XXXX` (`short_code.rs:3`). */
export function formaterShortCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * EXPIRATION — LA LIBERATION PARESSEUSE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Fait passer a `expired` tout jeton actif dont l'echeance est atteinte.
 *
 * `expire.rs:1-3` : « move due tokens to expired and release their holds […]
 * called by the worker and **lazily when a balance is read** ». Il n'y a pas
 * de worker dans les mocks, donc seule la voie paresseuse existe : chaque
 * route l'appelle avant de lire ou d'ecrire quoi que ce soit.
 *
 * La reservation se libere d'elle-meme, sans ligne de code dediee : `held`
 * est la somme des jetons **actifs**, et le jeton vient de cesser de l'etre.
 */
export function libererJetonsExpires(maintenant: number): number {
  let liberes = 0;
  for (const [jti, jeton] of magasin.jetons) {
    if (jeton.statut !== "active") continue;
    if (Date.parse(jeton.expiresAt) > maintenant) continue;
    magasin.jetons.set(jti, {
      ...jeton,
      statut: "expired",
      resolvedAt: new Date(maintenant).toISOString(),
    });
    liberes += 1;
  }
  return liberes;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SOLDES
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface SoldeMagasin {
  /** Total possede. Entier de centimes. */
  settledCentimes: MontantCentimes;
  /** Reserve par les jetons actifs. Entier de centimes. */
  heldCentimes: MontantCentimes;
  /** `settled - held`. C'est ce nombre qu'on affiche en grand. */
  disponibleCentimes: MontantCentimes;
}

/** Les jetons encore actifs d'un salarie, apres liberation des expires. */
export function jetonsActifsDe(employeeId: string, maintenant: number): JetonMagasin[] {
  libererJetonsExpires(maintenant);
  return [...magasin.jetons.values()].filter(
    (jeton) => jeton.employeeId === employeeId && jeton.statut === "active",
  );
}

/**
 * Le solde d'un salarie.
 *
 * `held` est **calcule** depuis les jetons actifs, jamais stocke : c'est
 * l'invariant I4 (`data-model.md:95-98`) rendu vrai par construction plutot
 * que verifie apres coup. Le back, lui, stocke `balance_held` et le
 * recalcule — il a un journal a tenir, nous non.
 */
export function soldeDe(employeeId: string, maintenant: number): SoldeMagasin | undefined {
  const salarie = trouverSalarie(employeeId);
  if (!salarie) return undefined;

  const heldCentimes = jetonsActifsDe(employeeId, maintenant).reduce(
    (somme, jeton) => somme + jeton.montantCentimes,
    0,
  );
  return {
    settledCentimes: salarie.soldeCentimes,
    heldCentimes,
    disponibleCentimes: salarie.soldeCentimes - heldCentimes,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * JETONS
 * ═══════════════════════════════════════════════════════════════════════════ */

export type EchecEmission = "compte_inactif" | "solde_insuffisant" | "montant_invalide";

/**
 * Emet un jeton et reserve les fonds.
 *
 * L'ordre est celui d'`authorize.rs:1-2` : verifier le statut, verifier le
 * **disponible**, poser la reservation, tirer `jti` et `short_code`, inserer.
 * Le solde regle ne bouge pas — seul le disponible baisse, parce que la
 * reservation est un jeton actif de plus.
 */
export function emettreJeton(
  employeeId: string,
  montantCentimes: MontantCentimes,
  maintenant: number,
): { jeton: JetonMagasin } | { echec: EchecEmission } {
  const salarie = trouverSalarie(employeeId);
  if (!salarie || salarie.statut !== "actif") return { echec: "compte_inactif" };
  if (!Number.isInteger(montantCentimes) || montantCentimes <= 0) {
    return { echec: "montant_invalide" };
  }

  const solde = soldeDe(employeeId, maintenant);
  if (!solde || solde.disponibleCentimes < montantCentimes) {
    return { echec: "solde_insuffisant" };
  }

  /* `uq_active_short_code` : un code court actif est unique (:156). */
  const codesActifs = new Set(
    [...magasin.jetons.values()]
      .filter((jeton) => jeton.statut === "active")
      .map((jeton) => jeton.shortCode),
  );
  let shortCode = nouveauShortCode();
  while (codesActifs.has(shortCode)) shortCode = nouveauShortCode();

  const jeton: JetonMagasin = {
    jti: crypto.randomUUID(),
    shortCode,
    employeeId: salarie.id,
    montantCentimes,
    statut: "active",
    issuedAt: new Date(maintenant).toISOString(),
    expiresAt: new Date(maintenant + TTL_JETON).toISOString(),
    resolvedAt: null,
  };
  magasin.jetons.set(jeton.jti, jeton);
  return { jeton };
}

export function trouverJetonParJti(jti: string): JetonMagasin | undefined {
  return magasin.jetons.get(jti);
}

/**
 * Retrouve un jeton par son code court, parmi les **actifs** seulement.
 *
 * L'unicite du code court ne porte que sur les jetons actifs (index partiel
 * `uq_active_short_code`) : un code deja consomme peut avoir ete reattribue,
 * et le chercher parmi les jetons termines rendrait une reponse arbitraire.
 */
export function trouverJetonParCode(saisie: string): JetonMagasin | undefined {
  const code = normaliserShortCode(saisie);
  return [...magasin.jetons.values()].find(
    (jeton) => jeton.statut === "active" && jeton.shortCode === code,
  );
}

/**
 * Resout une reference, `jti` ou code court.
 * `TokenRef` de `payments/mod.rs:1` : « scanned jti or typed short code ».
 */
export function trouverJetonParReference(reference: string): JetonMagasin | undefined {
  return trouverJetonParJti(reference) ?? trouverJetonParCode(reference);
}

/**
 * Annule un jeton actif et libere sa reservation.
 *
 * C'est `cancel_token` (`payments/repo.rs:1`), servi par
 * `DELETE /api/v1/me/payment-tokens/{jti}` (data-dictionary.md:412). C'est le
 * seul mecanisme specifie pour rendre les fonds d'un jeton qu'on ne veut plus :
 * regenerer un code, c'est annuler puis emettre.
 */
export function annulerJeton(jti: string, maintenant: number): JetonMagasin | undefined {
  const jeton = magasin.jetons.get(jti);
  if (!jeton || jeton.statut !== "active") return undefined;
  const annule: JetonMagasin = {
    ...jeton,
    statut: "cancelled",
    resolvedAt: new Date(maintenant).toISOString(),
  };
  magasin.jetons.set(jti, annule);
  return annule;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REGLEMENT
 * ═══════════════════════════════════════════════════════════════════════════ */

export function trouverPaiementParJti(jti: string): PaiementMagasin | undefined {
  return magasin.paiements.find((paiement) => paiement.jti === jti);
}

/**
 * Consomme le jeton, debite le solde regle, ecrit le paiement.
 *
 * Le disponible ne bouge PAS a cet instant, et c'est voulu : il avait deja
 * baisse a l'emission, quand les fonds ont ete reserves. Ici la reservation
 * disparait (le jeton n'est plus actif) et le solde regle baisse du meme
 * montant. Les deux mouvements se compensent exactement — c'est la partie
 * double vue depuis le compte du salarie.
 */
export function reglerJeton(
  jeton: JetonMagasin,
  partenaireId: string,
  modeSaisie: ModeSaisie,
  scannedAt: string,
  maintenant: number,
): PaiementMagasin {
  magasin.jetons.set(jeton.jti, {
    ...jeton,
    statut: "consumed",
    resolvedAt: new Date(maintenant).toISOString(),
  });

  const salarie = trouverSalarie(jeton.employeeId);
  if (salarie) salarie.soldeCentimes -= jeton.montantCentimes;

  const paiement: PaiementMagasin = {
    id: crypto.randomUUID(),
    jti: jeton.jti,
    partenaireId,
    montantCentimes: jeton.montantCentimes,
    modeSaisie,
    occurredAt: scannedAt,
    syncedAt: new Date(maintenant).toISOString(),
  };
  magasin.paiements.push(paiement);
  return paiement;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ADHESIONS PARTENAIRES
 * ═══════════════════════════════════════════════════════════════════════════ */

export function trouverVille(id: string): VilleMagasin | undefined {
  return magasin.villes.find((ville) => ville.id === id);
}

export function trouverAdministrateur(id: string): AdministrateurMagasin | undefined {
  return magasin.administrateurs.find((admin) => admin.id === id);
}

/**
 * Les partenaires d'un statut donne, du plus ancien depot au plus recent.
 *
 * L'ordre est celui de la file d'attente : on traite d'abord ce qui attend
 * depuis le plus longtemps. Le tri porte sur `(submittedAt, id)` — la paire
 * que le curseur encapsule, pour que la pagination keyset soit stable meme si
 * deux dossiers ont ete deposes a la meme seconde.
 */
export function partenairesParStatut(statut: StatutPartenaire): PartenaireMagasin[] {
  return magasin.partenaires
    .filter((partenaire) => partenaire.statut === statut)
    .sort((a, b) =>
      a.submittedAt === b.submittedAt
        ? a.id.localeCompare(b.id)
        : a.submittedAt.localeCompare(b.submittedAt),
    );
}

export function trouverPartenaireParId(id: string): PartenaireMagasin | undefined {
  return magasin.partenaires.find((partenaire) => partenaire.id === id);
}

/**
 * Ajoute une entree au journal.
 *
 * En ajout seul : cette fonction est la SEULE a ecrire dans `magasin.journal`,
 * et rien nulle part ne modifie ni ne retire une entree. C'est l'invariant I8
 * (`data-model.md:132-140`), que la base tient par des declencheurs et que ce
 * magasin tient par l'absence de code pour faire autrement.
 *
 * ⚠ Le vocabulaire des `action` est de NOTRE fait. La colonne est un `TEXT`
 * libre (`0001_schema.sql:268`) et aucun document ne fixe les verbes. Retenu :
 * `<entite>.<participe passe>`, soit `partner.approved` et `partner.rejected`.
 */
export function consignerAuJournal(entree: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payload?: Record<string, unknown> | null;
  quand: number;
}): EntreeJournal {
  const ligne: EntreeJournal = {
    id: crypto.randomUUID(),
    actorId: entree.actorId,
    action: entree.action,
    entityType: entree.entityType,
    entityId: entree.entityId,
    payload: entree.payload ?? null,
    /* Les mocks n'ont pas de connexion reelle : pas d'adresse a consigner. */
    ipAddress: null,
    createdAt: new Date(entree.quand).toISOString(),
  };
  magasin.journal.push(ligne);
  return ligne;
}

/** Le journal, du plus recent au plus ancien, filtre si demande. */
export function lireJournal(filtre: {
  entityType?: string;
  entityId?: string;
}): EntreeJournal[] {
  return magasin.journal
    .filter((ligne) => filtre.entityType === undefined || ligne.entityType === filtre.entityType)
    .filter((ligne) => filtre.entityId === undefined || ligne.entityId === filtre.entityId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type EchecDecision = "introuvable" | "deja_tranchee" | "motif_manquant";

/**
 * Tranche une demande d'adhesion, et consigne la decision.
 *
 * `review.rs:1-2` : « approve(tx, admin, partner_id) et reject(tx, admin,
 * partner_id, reason) : remplissent reviewed_by, reviewed_at et review_reason,
 * et ecrivent dans audit_log ». Les trois champs et l'ecriture au journal sont
 * donc solidaires — c'est une seule operation, pas deux.
 *
 * Deux refus que la route seule ne saurait pas porter :
 *
 *   - un dossier deja tranche ne se retranche pas. `reviewed_is_complete`
 *     (:119-123) n'interdit pas la reecriture, mais l'invariant I9 le fait :
 *     rien ne s'efface, une decision est un fait. La seconde decision est
 *     refusee, pas empilee.
 *   - un refus sans motif est refuse ICI, pas seulement a l'ecran. Le motif
 *     est ce qui rend le refus opposable ; un refus sans motif n'en est pas un.
 */
export function trancherAdhesion(
  partenaireId: string,
  decision: "approved" | "rejected",
  administrateurId: string,
  motif: string | null,
  maintenant: number,
): { partenaire: PartenaireMagasin; entree: EntreeJournal } | { echec: EchecDecision } {
  const partenaire = trouverPartenaireParId(partenaireId);
  if (!partenaire) return { echec: "introuvable" };
  if (partenaire.statut !== "pending") return { echec: "deja_tranchee" };

  const motifNettoye = motif !== null && motif.trim() !== "" ? motif.trim() : null;
  if (decision === "rejected" && motifNettoye === null) {
    return { echec: "motif_manquant" };
  }

  /* `reviewed_by` et `reviewed_at` sont poses ensemble : c'est exactement ce
     que verifie `reviewed_is_complete`. Une decision porte toujours son auteur
     ET son horodatage. */
  partenaire.statut = decision;
  partenaire.reviewedBy = administrateurId;
  partenaire.reviewedAt = new Date(maintenant).toISOString();
  partenaire.reviewReason = motifNettoye;

  const entree = consignerAuJournal({
    actorId: administrateurId,
    action: decision === "approved" ? "partner.approved" : "partner.rejected",
    entityType: "partner",
    entityId: partenaire.id,
    payload: {
      trade_name: partenaire.tradeName,
      status: partenaire.statut,
      reason: motifNettoye,
    },
    quand: maintenant,
  });

  return { partenaire, entree };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * COMPTES PARTENAIRES — cycle de vie apres agrement
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ActivitePartenaire {
  /** Cumul encaisse. Entier de centimes. */
  totalRecuCentimes: MontantCentimes;
  nombreTransactions: number;
}

/**
 * L'activite d'un partenaire : son amorce de demonstration plus les reglements
 * reellement ecrits dans le magasin.
 *
 * ⚠ Le schema n'a AUCUNE colonne de volume sur `partners`. Le back calculerait
 * ces deux nombres depuis `payments`, comme le fait la seconde moitie de cette
 * fonction. L'amorce, elle, n'a pas d'equivalent : elle existe pour que la
 * liste des comptes ne montre pas quinze etablissements a zero euro.
 *
 * Le vocabulaire est celui de `PartnerSummary` (`data-dictionary.md:419-421`) :
 * `total_received` et `transaction_count`. Le contrat les definit pour
 * l'espace PARTENAIRE, pas pour l'administration -- les reutiliser ici est
 * notre choix, pour donner au back un nom deja ecrit s'il adopte la route.
 */
export function activiteDe(partenaireId: string): ActivitePartenaire {
  const partenaire = trouverPartenaireParId(partenaireId);
  if (!partenaire) return { totalRecuCentimes: 0, nombreTransactions: 0 };

  const reglements = magasin.paiements.filter((p) => p.partenaireId === partenaireId);
  return {
    totalRecuCentimes:
      partenaire.historiqueCentimes +
      reglements.reduce((somme, p) => somme + p.montantCentimes, 0),
    nombreTransactions: partenaire.historiqueTransactions + reglements.length,
  };
}

/** Enleve les diacritiques : « Épicerie » se trouve en tapant « epicerie ». */
function sansAccent(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export interface FiltreComptes {
  statut?: StatutPartenaire;
  categorie?: string;
  /** Nom de ville, compare sans accent ni casse. */
  ville?: string;
  /** Recherche libre sur l'enseigne, la raison sociale et la ville. */
  recherche?: string;
}

/**
 * Les comptes partenaires, filtres, tries par enseigne.
 *
 * Le tri est `(tradeName, id)` et non `(submittedAt, id)` comme la file de
 * validation : ce n'est pas une file d'attente mais un annuaire, on y cherche
 * un etablissement par son nom. C'est aussi la paire sur laquelle
 * `catalog.rs:2` pagine, pour la meme raison.
 *
 * ⚠ Les filtres `categorie`, `ville` et `recherche` n'existent pas au contrat :
 * `GET /api/v1/admin/partners` n'accepte que `status` et `cursor` (:490). Les
 * noms `category`, `city` et `q` sont repris du catalogue (:469), qui est la
 * seule route du contrat a filtrer ainsi.
 */
export function comptesPartenaires(filtre: FiltreComptes): PartenaireMagasin[] {
  const recherche = filtre.recherche === undefined ? null : sansAccent(filtre.recherche.trim());
  const ville = filtre.ville === undefined ? null : sansAccent(filtre.ville.trim());

  return magasin.partenaires
    .filter((p) => filtre.statut === undefined || p.statut === filtre.statut)
    .filter((p) => filtre.categorie === undefined || p.category === filtre.categorie)
    .filter((p) => {
      if (ville === null || ville === "") return true;
      const nomVille = p.cityId === null ? null : trouverVille(p.cityId)?.name;
      return nomVille !== undefined && nomVille !== null && sansAccent(nomVille).includes(ville);
    })
    .filter((p) => {
      if (recherche === null || recherche === "") return true;
      const nomVille = p.cityId === null ? "" : (trouverVille(p.cityId)?.name ?? "");
      return [p.tradeName, p.legalName, nomVille].some((champ) =>
        sansAccent(champ).includes(recherche),
      );
    })
    .sort(comparerParEnseigne);
}

/**
 * L'ordre total de la liste des comptes : enseigne, puis identifiant.
 *
 * ⚠ CETTE FONCTION DOIT ETRE LA SEULE A DECIDER DE L'ORDRE. Le tri et le
 * curseur de pagination l'utilisent tous les deux, et c'est indispensable :
 * `localeCompare(…, "fr")` et l'operateur `>` ne rangent PAS pareil. En
 * collation francaise « Épicerie » vient avant « Librairie » ; en unites de
 * code, « É » vaut U+00C9 et « L » U+004C, donc l'inverse.
 *
 * Un curseur qui avance avec `>` sur une liste triee par collation saute des
 * lignes, en repete d'autres, et peut ne jamais atteindre la fin. C'est ce qui
 * arrivait avant ce correctif.
 */
export function comparerParEnseigne(
  a: { tradeName: string; id: string },
  b: { tradeName: string; id: string },
): number {
  const parEnseigne = a.tradeName.localeCompare(b.tradeName, "fr");
  return parEnseigne !== 0 ? parEnseigne : a.id.localeCompare(b.id);
}

export type EchecStatut = "introuvable" | "transition_refusee" | "motif_manquant";

/**
 * Les transitions permises apres agrement.
 *
 * Le schema n'en impose AUCUNE : `partners.status` est une colonne
 * `partner_status NOT NULL` sans `CHECK` de transition, et les trois
 * declencheurs `forbid_mutation()` ne portent que sur `ledger_entries`,
 * `ledger_operations` et `audit_log` (`0001_schema.sql:286-315`). Techniquement,
 * la base accepterait n'importe quel passage, y compris un retour de `closed`.
 *
 * Ce tableau est donc NOTRE regle, pas la leur. Il dit :
 *   - on suspend un compte agree, et lui seul -- une demande `pending` se
 *     refuse, elle ne se suspend pas ;
 *   - on reactive un compte suspendu, et lui seul ;
 *   - on ferme un compte agree ou suspendu.
 *
 * `closed` n'a AUCUNE sortie, et c'est le point a faire trancher par l'equipe
 * back : voir le commentaire de `fermerCompte` dans la route.
 */
const TRANSITIONS: Readonly<Record<string, readonly StatutPartenaire[]>> = {
  suspended: ["approved"],
  approved: ["suspended"],
  closed: ["approved", "suspended"],
};

/**
 * Change le statut d'un compte, et consigne le changement.
 *
 * Meme forme que `trancherAdhesion` : les trois champs de revision et
 * l'ecriture au journal sont poses ensemble, en une seule operation
 * (`review.rs:1-2`).
 *
 * ⚠ LE MOTIF ECRASE `review_reason`. Le schema n'a qu'UNE colonne de motif
 * (`partners.review_reason`, :117), pensee pour le refus d'adhesion et
 * « visible du partenaire » (`data-dictionary.md:158`). Une suspension qui
 * survient apres une acceptation ecrase donc la date d'agrement dans
 * `reviewed_at` et le motif d'agrement dans `review_reason` : la base ne garde
 * que la DERNIERE decision. Seul `audit_log` conserve la suite complete.
 * A signaler a l'equipe back -- il manque soit des colonnes dediees, soit
 * l'aveu que le journal est la seule histoire.
 */
export function changerStatutPartenaire(
  partenaireId: string,
  cible: StatutPartenaire,
  administrateurId: string,
  motif: string | null,
  maintenant: number,
): { partenaire: PartenaireMagasin; entree: EntreeJournal } | { echec: EchecStatut } {
  const partenaire = trouverPartenaireParId(partenaireId);
  if (!partenaire) return { echec: "introuvable" };

  const depuis = TRANSITIONS[cible] ?? [];
  if (!depuis.includes(partenaire.statut)) return { echec: "transition_refusee" };

  const motifNettoye = motif !== null && motif.trim() !== "" ? motif.trim() : null;

  /*
   * Le motif est obligatoire pour ce qui retire un droit -- suspension,
   * fermeture -- et facultatif pour ce qui en rend un.
   *
   * C'est la regle du contrat, pas la notre : `reject` porte un
   * `RejectRequest { reason }` obligatoire (`data-dictionary.md:509`), tandis
   * qu'`approve` repond `204` sans aucun corps (:507). Une decision defavorable
   * doit pouvoir se contester, donc s'expliquer ; une decision favorable n'a
   * personne a qui rendre des comptes.
   *
   * Un motif reste accepte a la reactivation : s'il est fourni, il est
   * enregistre et consigne.
   */
  const motifObligatoire = cible !== "approved";
  if (motifObligatoire && motifNettoye === null) return { echec: "motif_manquant" };

  partenaire.statut = cible;
  partenaire.reviewedBy = administrateurId;
  partenaire.reviewedAt = new Date(maintenant).toISOString();
  partenaire.reviewReason = motifNettoye;

  const verbes: Record<string, string> = {
    suspended: "partner.suspended",
    approved: "partner.reinstated",
    closed: "partner.closed",
  };

  const entree = consignerAuJournal({
    actorId: administrateurId,
    action: verbes[cible] ?? `partner.${cible}`,
    entityType: "partner",
    entityId: partenaire.id,
    payload: {
      trade_name: partenaire.tradeName,
      status: partenaire.statut,
      reason: motifNettoye,
    },
    quand: maintenant,
  });

  return { partenaire, entree };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ANCIEN MODÈLE — conserve uniquement pour les deux routes historiques
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `POST /api/payment-tokens` et `GET /api/payment-tokens/{token}` servent le
 * modele ou le caissier saisissait le montant. Les ecrans d'encaissement en
 * dependent encore (`EtapeMontant.tsx` demande le montant a la caisse), et la
 * consigne est de ne toucher a aucun ecran.
 *
 * ⚠ Ces structures sont a supprimer en meme temps que ces deux routes, le jour
 * ou le parcours partenaire sera refait sur le modele du back — c'est la
 * divergence D4 de `front/docs/contrat-api.md`. Ne rien ajouter ici.
 */

/** ANCIEN MODÈLE. Voir l'avertissement ci-dessus. */
export interface JetonPaiement {
  token: string;
  employeeId: Identifiant;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

const CLE_JETONS_HERITES = "__carteproJetonsHerites__";
type PorteeHeritee = typeof globalThis &
  Record<typeof CLE_JETONS_HERITES, Map<string, JetonPaiement> | undefined>;
const porteeHeritee = globalThis as PorteeHeritee;

const jetonsHerites: Map<string, JetonPaiement> =
  porteeHeritee[CLE_JETONS_HERITES] ??
  (porteeHeritee[CLE_JETONS_HERITES] = new Map<string, JetonPaiement>());

/** ANCIEN MODÈLE. */
export function trouverJeton(token: string): JetonPaiement | undefined {
  return jetonsHerites.get(token);
}

/** ANCIEN MODÈLE. */
export function jetonExiste(token: string): boolean {
  return jetonsHerites.has(token);
}

/** ANCIEN MODÈLE. */
export function enregistrerJeton(jeton: JetonPaiement): JetonPaiement {
  jetonsHerites.set(jeton.token, jeton);
  return jeton;
}

/** ANCIEN MODÈLE. */
export function marquerJetonUtilise(
  token: string,
  utiliseLe: string,
): JetonPaiement | undefined {
  const jeton = jetonsHerites.get(token);
  if (!jeton) return undefined;
  const consomme: JetonPaiement = { ...jeton, usedAt: utiliseLe };
  jetonsHerites.set(token, consomme);
  return consomme;
}

/** ANCIEN MODÈLE. */
export function jetonEstExpire(jeton: JetonPaiement, maintenant: number): boolean {
  return Date.parse(jeton.expiresAt) <= maintenant;
}
