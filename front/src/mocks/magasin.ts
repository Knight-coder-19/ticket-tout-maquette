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

import {
  idCompte,
  compenser,
  posterOperation,
  type OperationRegistre,
  registre,
  soldeDuCompte,
  trouverOperation,
} from "@/mocks/registre";
import { sha256 } from "@/mocks/sha256";
import { centimesDepuisSaisie } from "@/lib/montant";
import type {
  Identifiant,
  MontantCentimes,
  StatutTransaction,
} from "@/types/domaine";

/** Duree de validite d'un jeton, en millisecondes. `TOKEN_TTL_SECONDS=300`. */
export const TTL_JETON = 5 * 60 * 1000;

/** Un salarie suspendu conserve son solde mais ne peut plus emettre. */
/**
 * L'etat du compte d'un salarie.
 *
 * Les TROIS valeurs de `user_status` (`0001_schema.sql:5`), pas deux. La forme
 * precedente n'en portait que deux, et c'est la meme faute qui avait ete
 * corrigee sur les partenaires : deux unions pour un concept, c'est la
 * certitude qu'un jour un compte ferme sera traite comme autre chose sans que
 * rien ne proteste. Un ecran qui ne traite legitimement que certains statuts
 * FILTRE ; il ne redeclare pas un type plus etroit.
 *
 * ⚠ Le schema porte en realite DEUX statuts pour un salarie : `users.status`
 * (l'acces de la personne) et `accounts.status` (le compte d'argent). Le mock
 * n'a qu'une ligne par salarie et n'en porte donc qu'un ; c'est `users.status`
 * qui est modelise, et le back devra tenir les deux en phase --
 * `directory/employment.rs:1` ferme d'ailleurs le lien PUIS le compte, dans
 * cet ordre.
 */
export type StatutSalarie = "actif" | "suspendu" | "ferme";

/**
 * Un salarie du repertoire.
 *
 * Les champs suivent les tables plutot que l'ecran : `employees`
 * (`0001_schema.sql:71-78`) porte le nom en DEUX colonnes et un telephone,
 * `users` porte le statut, et c'est `employment_links` (`:80-96`) qui porte le
 * matricule et l'employeur -- pas la fiche du salarie.
 *
 * ⚠ Le compte non plus n'appartient pas au salarie : `employment_links`
 * porte `account_id`. Un salarie qui change d'employeur change de compte. Le
 * mock garde un compte par salarie (`ACC-SAL-00x`), ce qui suffit tant qu'un
 * salarie n'a qu'un lien -- l'index `uq_active_employment` (`:95`) garantit
 * qu'il n'en a qu'un ACTIF a la fois.
 */
export interface SalarieMagasin {
  id: Identifiant;
  /** `employees.last_name`. */
  nom: string;
  /** `employees.first_name`. */
  prenom: string;
  /** `employees.phone`, `TEXT NULL`. */
  telephone: string | null;
  /**
   * `users.email`, joint via `employees.user_id` -- `CITEXT NOT NULL UNIQUE`
   * (`0001_schema.sql:28`). Ajoute au type : aucun ecran n'en avait besoin
   * jusqu'ici. L'import CSV des rechargements l'exige -- `funding/csv.rs:1`
   * accepte un courriel comme cle alternative au matricule.
   */
  courriel: string;
  /** `employment_links.employer_id` du lien ACTIF. */
  employeurId: Identifiant;
  /** `employment_links.employer_ref` : le matricule (decision 12). */
  matricule: string;
  /** `employment_links.started_at`, date ISO 8601. */
  entreLe: string;
  /** `users.status`. */
  statut: StatutSalarie;
}

/**
 * Un employeur. Table `employers` (`0001_schema.sql:37-45`).
 *
 * Il n'existait pas dans le magasin : le salarie portait le nom de son
 * employeur en clair, ce qui rendait impossible un filtre par employeur qui ne
 * soit pas une comparaison de chaines.
 */
export interface EmployeurMagasin {
  id: Identifiant;
  legalName: string;
  ifu: string | null;
  contactEmail: string | null;
  statut: StatutSalarie;
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
 * Les cinq etats d'un partenaire, DANS LE VOCABULAIRE DU BACK.
 *
 * ENUM `partner_status` (`0001_schema.sql:7`), repris tel quel : minuscules,
 * en anglais, identiques des trois cotes (`data-dictionary.md:51,57`).
 *
 * Le nom est anglais, et c'est voulu : le magasin simule la base, il parle la
 * langue de la base. L'union FRANCAISE du domaine porte les memes cinq etats
 * sous d'autres etiquettes, dans `types/domaine.ts`. Les deux portaient le
 * meme nom, ce qui rendait une confusion possible a l'import : deux jeux de
 * valeurs derriere un seul identifiant.
 *
 * La traduction de l'un vers l'autre a lieu a un seul endroit,
 * `statutDepuisPartnerStatus` dans `lib/api/adaptateurs.ts`.
 */
export type PartnerStatus =
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
  statut: PartnerStatus;
  /** Date ISO 8601 du depot de la demande. */
  submittedAt: string;
  /** Auteur de la decision. `null` tant qu'elle n'est pas prise. */
  reviewedBy: Identifiant | null;
  /** Date ISO 8601 de la decision. */
  reviewedAt: string | null;
  /** Motif. Obligatoire au refus, facultatif a l'acceptation. */
  reviewReason: string | null;
  /**
   * Nombre de reglements ANTERIEURS au registre.
   *
   * ⚠ Amorce de simulation, sans equivalent dans le schema. Le MONTANT, lui,
   * n'est plus porte ici : il vit dans le registre, comme une reprise
   * d'anteriorite. Deux sources pour un solde, c'est un solde qui derive --
   * l'invariant I2 dit que le journal est la verite.
   */
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
  employeurs: EmployeurMagasin[];
  villes: VilleMagasin[];
  administrateurs: AdministrateurMagasin[];
  partenaires: PartenaireMagasin[];
  /** Le journal des decisions. En ajout seul. */
  journal: EntreeJournal[];
  /** Indexes par `jti`. */
  jetons: Map<Identifiant, JetonMagasin>;
  paiements: PaiementMagasin[];
  transactions: TransactionMagasin[];
  /** Les mises en avant, actives et retirees confondues (R6). */
  misesEnAvant: MiseEnAvantMagasin[];
  /** Colonnes `topups` (`0001_schema.sql:219-225`). */
  topups: TopupMagasin[];
  /** Colonnes `topup_batches` (`:202-215`). */
  lots: LotRechargement[];
}

/** ENUM `highlight_placement` (`0001_schema.sql:16`). */
export type Emplacement = "minister_pick" | "public_featured";

/**
 * Une mise en avant. Table `partner_highlights` (`0001_schema.sql:128-142`).
 *
 * ⚠ `mot` EST DE NOTRE FAIT. La table n'a AUCUNE colonne pour un texte : id,
 * partner_id, placement, position, created_by, created_at, removed_at -- rien
 * d'autre. Voir `app/api/v1/admin/highlights/route.ts` pour le raisonnement
 * complet sur pourquoi ce champ existe quand meme, et pourquoi il n'enfreint
 * pas la regle R9 qui verrouille `PublicPartner`.
 */
export interface MiseEnAvantMagasin {
  id: Identifiant;
  partenaireId: Identifiant;
  emplacement: Emplacement;
  /** 1-indexe, `CHECK (position > 0)` (:136). */
  position: number;
  /** Les mots du ministre. `null` si aucun n'a ete saisi. Jamais un motif. */
  mot: string | null;
  creePar: Identifiant;
  /** Date ISO 8601. */
  creeLe: string;
  /** `null` tant qu'active. Un retrait REMPLIT ce champ, ne supprime rien (R6). */
  retireLe: string | null;
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
    /* Le repertoire. Chaque salarie rend une situation atteignable depuis
       l'interface : solde confortable, solde faible, compte suspendu, fonds
       reserves par un jeton en cours, et un compte ferme -- sans quoi la
       troisieme valeur de `user_status` ne serait jamais montree. */
    salaries: [
      { id: "SAL-001", nom: "Roussel", prenom: "Amélie", telephone: "+229 97 12 34 56",
        courriel: "amelie.roussel@cotonou.bj",
        employeurId: "EMP-001", matricule: "MC-4471", entreLe: "2024-03-04", statut: "actif" },
      { id: "SAL-002", nom: "Nkoue", prenom: "Bastien", telephone: null,
        courriel: "bastien.nkoue@cotonou.bj",
        employeurId: "EMP-001", matricule: "MC-5108", entreLe: "2025-09-15", statut: "actif" },
      { id: "SAL-003", nom: "Doumbia", prenom: "Clara", telephone: "+229 95 88 21 07",
        courriel: "clara.doumbia@tourisme.bj",
        employeurId: "EMP-002", matricule: "OT-0233", entreLe: "2023-11-20", statut: "suspendu" },
      { id: "SAL-004", nom: "Agossou", prenom: "Delphine", telephone: "+229 96 40 55 12",
        courriel: "delphine.agossou@tourisme.bj",
        employeurId: "EMP-002", matricule: "OT-0341", entreLe: "2025-01-08", statut: "actif" },
      { id: "SAL-005", nom: "Bakary", prenom: "Émile", telephone: null,
        courriel: "emile.bakary@paix.bj",
        employeurId: "EMP-003", matricule: "HP-7702", entreLe: "2022-06-01", statut: "ferme" },
    ],
    employeurs: [
      { id: "EMP-001", legalName: "Mairie de Cotonou", ifu: "3201800045566",
        contactEmail: "paie@cotonou.bj", statut: "actif" },
      { id: "EMP-002", legalName: "Office du tourisme", ifu: "3201900077889",
        contactEmail: "rh@tourisme.bj", statut: "actif" },
      { id: "EMP-003", legalName: "Hôpital de la Paix", ifu: null,
        contactEmail: null, statut: "actif" },
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
        /* 37 et non 39 : les deux reglements du 28 et du 30 aout sont PORTES PAR LE
           REGISTRE (voir `amorcerRegistre`). Les compter aussi ici les compterait
           deux fois -- c'est le genre de double source que l'invariant I2
           interdit pour les montants, et qui vaut aussi pour un compteur. */
        historiqueTransactions: 37,
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
        historiqueTransactions: 22,
      },
      {
        /*
         * Un commerce EN LIGNE et AGRÉÉ.
         *
         * Il manquait au jeu de démonstration, et son absence rendait
         * l'amendement A1 indémontrable : « an online partner comes back
         * whatever the city filter says » (`catalog.rs:2`). Sans agréé en
         * ligne, le catalogue n'affichait jamais le cas, et la règle ne
         * pouvait être ni montrée au jury ni vérifiée à l'exécution.
         */
        id: "PRT-016",
        contactEmail: "libraires@lireenligne.bj",
        legalName: "SARL Lire en Ligne",
        tradeName: "Lire en Ligne",
        category: "culture",
        ifu: "3201904112233",
        serviceMode: "online",
        websiteUrl: "https://lire-en-ligne.bj",
        cityId: null,
        district: null,
        addressLine: null,
        statut: "approved",
        submittedAt: "2026-05-20T09:00:00.000Z",
        reviewedBy: "ADM-002",
        reviewedAt: "2026-05-23T14:00:00.000Z",
        reviewReason: null,
        historiqueTransactions: 12,
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
    misesEnAvant: [],
    topups: [],
    lots: [],
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
 * AMORCAGE DU REGISTRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le journal ne peut pas naitre vide : les comptes de demonstration ont un
 * solde, et un solde sans ecriture violerait l'invariant I2. On ouvre donc le
 * registre par une REPRISE D'ANTERIORITE -- une operation `topup` par compte,
 * depuis le compte systeme d'emission -- puis les deux reglements historiques
 * du jeu de donnees.
 *
 * C'est une pratique comptable ordinaire, pas un contournement : un livre qui
 * s'ouvre en cours de route commence par reprendre les soldes existants.
 *
 * Les montants sont calcules pour retomber exactement sur les soldes de
 * demonstration apres les reglements : SAL-001 recoit 162,50 EUR et en depense
 * 12,50, ce qui laisse les 150,00 EUR attendus.
 */
function amorcerRegistre(): void {
  /* Le registre est epingle sur globalThis : au rechargement a chaud, il est
     deja rempli et ne doit surtout pas etre amorce deux fois. */
  if (registre.operations.length > 0) return;

  const t = (iso: string): number => Date.parse(iso);
  const reprise = (
    beneficiaire: string,
    montant: MontantCentimes,
    quand: string,
    libelle: string,
  ): void => {
    if (montant <= 0) return;
    posterOperation({
      kind: "topup",
      amountCentimes: montant,
      debiter: "ACC-MINISTRY_ISSUANCE",
      crediter: idCompte(beneficiaire),
      memo: libelle,
      createdBy: "ADM-001",
      occurredAt: quand,
      quand: t(quand),
    });
  };

  reprise("SAL-001", 213_30, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("SAL-002", 64_40, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("SAL-004", 80_00, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("SAL-005", 21_60, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("PRT-001", 468_70, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("PRT-009", 1_229_90, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("PRT-010", 291_85, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("PRT-011", 32_20, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("PRT-012", 803_10, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("PRT-013", 18_00, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("PRT-015", 259_40, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");
  reprise("PRT-016", 78_40, "2026-08-01T08:00:00.000Z", "Reprise d'antériorité");

  /* Les reglements, repartis sur PLUSIEURS partenaires, villes et categories.
     Un seul commercant ne suffisait pas : la vue nationale des transactions
     montre qui a encaisse, ou et dans quelle categorie, et deux reglements du
     meme etablissement ne demontraient aucun de ses filtres. Les reprises
     ci-dessus sont ajustees en consequence -- chaque salarie recoit ce qu'il
     depense en plus, chaque partenaire recoit d'autant moins a l'ouverture --
     de sorte que TOUS LES SOLDES DE DEMONSTRATION SONT INCHANGES. */
  const regler = (
    salarie: string,
    partenaire: string,
    montant: MontantCentimes,
    quand: string,
  ): OperationRegistre =>
    posterOperation({
      kind: "payment",
      amountCentimes: montant,
      debiter: idCompte(salarie),
      crediter: idCompte(partenaire),
      memo: "Règlement au comptoir",
      occurredAt: quand,
      quand: t(quand),
    });

  for (const [salarie, partenaire, montant, quand] of [
    ["SAL-001", "PRT-001", 12_50, "2026-08-28T09:14:00.000Z"],
    ["SAL-002", "PRT-001", 4_80, "2026-08-30T12:02:00.000Z"],
    /* Cotonou, alimentation */
    ["SAL-001", "PRT-009", 23_40, "2026-09-03T11:20:00.000Z"],
    ["SAL-002", "PRT-009", 31_20, "2026-09-18T17:45:00.000Z"],
    /* Parakou, restauration */
    ["SAL-001", "PRT-010", 8_90, "2026-09-08T12:35:00.000Z"],
    ["SAL-001", "PRT-010", 12_00, "2026-09-22T13:10:00.000Z"],
    /* Porto-Novo, culture */
    ["SAL-002", "PRT-011", 15_00, "2026-09-11T10:05:00.000Z"],
    /* Sans ville : le bloc `online_partners` du tableau de bord (A1) */
    ["SAL-001", "PRT-016", 6_50, "2026-09-15T20:12:00.000Z"],
    ["SAL-002", "PRT-016", 9_90, "2026-09-23T08:40:00.000Z"],
  ] as const) {
    regler(salarie, partenaire, montant, quand);
  }

  /* Un reglement ANNULE, pour que l'ecart entre le nombre d'operations et le
     volume net soit demontrable et non seulement decrit. Le paiement et son
     inverse se compensent : le solde de PRT-011 est le meme qu'avant. */
  const aAnnuler = regler("SAL-001", "PRT-011", 45_00, "2026-09-19T14:30:00.000Z");
  compenser(
    aAnnuler.id,
    "ADM-001",
    "Double encaissement signalé par le commerçant.",
    t("2026-09-20T09:00:00.000Z"),
  );
}

amorcerRegistre();


/* ═══════════════════════════════════════════════════════════════════════════
 * REFERENTIEL
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Les initiales d'un salarie : « A. R. », jamais le nom complet.
 *
 * Le contrat l'impose pour `customer_label` (`data-dictionary.md:434`) : un
 * commercant n'a pas a connaitre l'identite de ses clients, meme au comptoir.
 *
 * ⚠ Ecrite ici, et une seule fois. Le calcul etait recopie dans deux routes,
 * chacune decoupant `nom` sur les espaces. Cela fonctionnait tant que `nom`
 * portait le nom COMPLET ; depuis que la fiche suit la table -- `last_name` et
 * `first_name` en deux colonnes (`0001_schema.sql:74-75`) -- ce decoupage ne
 * rendait plus qu'une initiale. Un seul endroit, plus de derive possible.
 */
export function initialesDe(salarie: SalarieMagasin): string {
  return [salarie.prenom, salarie.nom]
    .filter((partie) => partie.trim() !== "")
    .map((partie) => `${partie.trim().charAt(0).toUpperCase()}.`)
    .join(" ");
}

/** Le nom affiche : « Amelie Roussel ». */
export function nomComplet(salarie: SalarieMagasin): string {
  return `${salarie.prenom} ${salarie.nom}`.trim();
}

export function trouverEmployeur(id: string): EmployeurMagasin | undefined {
  return magasin.employeurs.find((employeur) => employeur.id === id);
}

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
  /* `balance_settled` vient du REGISTRE, pas d'un champ du salarie : le
     journal est la verite, le reste est un cache (invariant I2). */
  const settledCentimes = soldeDuCompte(idCompte(salarie.id));
  return {
    settledCentimes,
    heldCentimes,
    disponibleCentimes: settledCentimes - heldCentimes,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REGULARISATION
 * ═══════════════════════════════════════════════════════════════════════════ */

export type SensRegularisation = "credit" | "debit";

export type EchecRegularisation =
  | "introuvable"
  | "motif_manquant"
  | "montant_invalide"
  | "compte_ferme"
  | "solde_insuffisant";

/**
 * Corrige le solde d'un salarie EN AJOUTANT UNE ECRITURE.
 *
 * ═══ REGLE R1 ═══
 *
 * Cette fonction n'ecrit AUCUN solde. Elle ne touche ni `settledCentimes`, ni
 * un champ « solde » quelconque : elle appelle `posterOperation`, seul point
 * d'ecriture du journal, et le solde en decoule. C'est la meme mecanique que
 * l'annulation.
 *
 * La preuve en est la forme du code : il n'y a ici aucune affectation. Si l'on
 * se surprend a ecrire `compte.soldeCentimes = ...`, on a pris le mauvais
 * chemin -- et de toute facon `posterOperation` est le seul a le faire, et les
 * ecritures sont gelees.
 *
 * ═══ LA CONTREPARTIE ═══
 *
 * Une ecriture a deux cotes. Une regularisation au CREDIT debite le compte
 * d'emission (`MINISTRY_ISSUANCE`), exactement comme un rechargement : c'est
 * de la monnaie qui entre dans le dispositif. Au DEBIT, elle y retourne. Sans
 * contrepartie, l'operation serait desequilibree et l'invariant I1 tomberait.
 *
 * ═══ REGLE R2 : le solde ne devient jamais negatif ═══
 *
 * Ce n'est pas une precaution d'interface, c'est une contrainte du schema :
 * `settled_never_negative` (`0001_schema.sql:57`) l'interdit en base pour tout
 * compte non systeme.
 *
 * ⚠ MAIS LA BORNE N'EST PAS `settled`, C'EST `disponible`. Une seconde
 * contrainte, `held_within_settled` (`:59`), impose `balance_held <=
 * balance_settled`. Un salarie qui possede 30 EUR dont 25 sont reserves par un
 * jeton en cours ne peut donc etre debite que de 5 : au-dela, `settled`
 * passerait sous `held` et la base refuserait l'ecriture. Borner sur `settled`
 * aurait laisse passer une regularisation que le back rejette.
 */
export function regulariser(
  employeeId: string,
  sens: SensRegularisation,
  montantCentimes: MontantCentimes,
  motif: string | null,
  administrateurId: string,
  maintenant: number,
): { operation: OperationRegistre; solde: SoldeMagasin } | { echec: EchecRegularisation } {
  const salarie = trouverSalarie(employeeId);
  if (!salarie) return { echec: "introuvable" };
  if (salarie.statut === "ferme") return { echec: "compte_ferme" };

  const motifNettoye = motif !== null && motif.trim() !== "" ? motif.trim() : null;
  if (motifNettoye === null) return { echec: "motif_manquant" };

  if (!Number.isInteger(montantCentimes) || montantCentimes <= 0) {
    return { echec: "montant_invalide" };
  }

  const avant = soldeDe(employeeId, maintenant);
  if (avant === undefined) return { echec: "introuvable" };

  /* R2, bornee sur le DISPONIBLE et non sur le regle -- voir l'en-tete. */
  if (sens === "debit" && montantCentimes > avant.disponibleCentimes) {
    return { echec: "solde_insuffisant" };
  }

  const compte = idCompte(employeeId);
  const emission = "ACC-MINISTRY_ISSUANCE";

  const operation = posterOperation({
    kind: "regularisation",
    amountCentimes: montantCentimes,
    debiter: sens === "credit" ? emission : compte,
    crediter: sens === "credit" ? compte : emission,
    memo: motifNettoye,
    createdBy: administrateurId,
    occurredAt: new Date(maintenant).toISOString(),
    quand: maintenant,
  });

  /* Le solde APRES est relu depuis le journal, jamais deduit de l'operation :
     c'est ce qui prouve, a l'ecran, que le nombre vient des ecritures. */
  const apres = soldeDe(employeeId, maintenant);
  if (apres === undefined) return { echec: "introuvable" };
  return { operation, solde: apres };
}

/**
 * Suspend ou reactive un salarie.
 *
 * Motif OBLIGATOIRE pour suspendre, aucun pour reactiver -- le meme
 * raisonnement que pour les partenaires : on doit pouvoir dire pourquoi on
 * prive quelqu'un de ses droits ; les lui rendre ne se justifie pas.
 *
 * ⚠ Elle ne FERME pas. `directory/employment.rs:1` decrit la fermeture comme
 * la fin du lien d'emploi, suivie de la cloture du compte, puis d'une
 * operation `closure_forfeit` si un reliquat subsiste, « honouring
 * closure_grace ». Ce delai de grace n'est expose nulle part dans le contrat :
 * l'implementer reviendrait a l'inventer. La fermeture est donc signalee
 * comme manquante, pas simulee.
 */
export function changerStatutSalarie(
  employeeId: string,
  vers: "actif" | "suspendu",
  motif: string | null,
): { salarie: SalarieMagasin } | { echec: "introuvable" | "motif_manquant" | "compte_ferme" } {
  const salarie = trouverSalarie(employeeId);
  if (!salarie) return { echec: "introuvable" };
  if (salarie.statut === "ferme") return { echec: "compte_ferme" };

  if (vers === "suspendu") {
    const motifNettoye = motif !== null && motif.trim() !== "" ? motif.trim() : null;
    if (motifNettoye === null) return { echec: "motif_manquant" };
  }

  salarie.statut = vers;
  return { salarie };
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
 * Retrouve un jeton par son code court.
 *
 * ⚠ L'ACTIF D'ABORD, puis le plus recent des termines.
 *
 * L'unicite du code court ne porte que sur les jetons actifs (index partiel
 * `uq_active_short_code`, `0001_schema.sql:156`) : un code consomme peut avoir
 * ete reattribue, et l'actif doit donc gagner. Mais s'arreter la etait un
 * defaut : un jeton EXPIRE n'est plus actif, et le comptoir recevait
 * « ce code est introuvable » la ou le vrai motif est « ce code a expire ».
 * Le caissier verifiait sa saisie au lieu de demander un nouveau code.
 *
 * Le back, lui, sait les distinguer : `payments/mod.rs:2-3` impose que
 * `PaymentError` garde `UnknownToken`, `TokenExpired` et `TokenAlreadyUsed`
 * DISTINCTS -- « the offline client depends on it ». Une recherche qui ne
 * rendrait que les actifs ecraserait deux de ces trois cas sur le troisieme.
 *
 * On rend donc le jeton, quel que soit son statut, et c'est a l'appelant de
 * dire pourquoi il refuse.
 */
export function trouverJetonParCode(saisie: string): JetonMagasin | undefined {
  const code = normaliserShortCode(saisie);
  const memeCode = [...magasin.jetons.values()].filter(
    (jeton) => jeton.shortCode === code,
  );
  return (
    memeCode.find((jeton) => jeton.statut === "active") ??
    /* Aucun actif : le plus recemment emis, pour que le message porte sur le
       dernier geste du client et non sur un jeton oublie de la veille. */
    memeCode.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]
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

  /*
   * Le debit passe par le journal, jamais par un champ.
   *
   * `post_operation` est le seul point d'ecriture (`ledger/mod.rs:1-2`, regle
   * R2) : il ecrit l'operation, ses deux ecritures chainees et les deux caches
   * de solde. Retrancher le montant a la main laisserait le journal et le
   * solde diverger -- exactement ce que l'invariant I2 interdit.
   */
  const operation = posterOperation({
    kind: "payment",
    amountCentimes: jeton.montantCentimes,
    debiter: idCompte(jeton.employeeId),
    crediter: idCompte(partenaireId),
    memo: `Règlement du jeton ${jeton.shortCode}`,
    occurredAt: scannedAt,
    quand: maintenant,
  });

  const paiement: PaiementMagasin = {
    id: operation.id,
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
export function partenairesParStatut(statut: PartnerStatus): PartenaireMagasin[] {
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

  /*
   * Le CUMUL vient du solde du compte partenaire, tenu par le journal. La
   * reprise d'anteriorite y est deja, ecrite comme une operation ordinaire au
   * moment de l'amorcage : une seule source, un seul chiffre.
   *
   * Le NOMBRE, lui, additionne les reglements anterieurs au registre et ceux
   * qu'il porte. Un compte n'est pas un compteur : le journal sait combien
   * d'operations il contient, pas combien il en a existe avant lui.
   */
  const compte = idCompte(partenaireId);
  const reglementsDuRegistre = registre.ecritures.filter(
    (e) =>
      e.accountId === compte &&
      e.direction === "credit" &&
      trouverOperation(e.operationId)?.kind === "payment",
  ).length;

  return {
    totalRecuCentimes: soldeDuCompte(compte),
    nombreTransactions: partenaire.historiqueTransactions + reglementsDuRegistre,
  };
}

/** Enleve les diacritiques : « Épicerie » se trouve en tapant « epicerie ». */
/**
 * Replie les accents et la casse, pour une recherche indulgente.
 *
 * ⚠ Exportee : elle etait ecrite ici en prive ET recopiee dans la route du
 * catalogue. Un troisieme usage -- le repertoire des beneficiaires, ou l'on
 * doit trouver « Emile » en tapant « emile » -- en aurait fait une troisieme
 * copie. Deux recherches qui replient les accents differemment, c'est un
 * ecran qui trouve ce que l'autre ne trouve pas.
 */
export function sansAccent(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export interface FiltreComptes {
  statut?: PartnerStatus;
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
const TRANSITIONS: Readonly<Record<string, readonly PartnerStatus[]>> = {
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
  cible: PartnerStatus,
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
 * MISES EN AVANT — VITRINE PUBLIQUE
 *
 * Table `partner_highlights` (`0001_schema.sql:128-142`), logique de
 * `partners/highlights.rs`. Deux emplacements, deux index partiels
 * d'unicite -- un partenaire n'a qu'une mise en avant ACTIVE par emplacement,
 * une position n'est occupee que par une mise en avant ACTIVE -- et un
 * retrait REMPLIT `removed_at`, ne supprime jamais rien (R6).
 * ═══════════════════════════════════════════════════════════════════════════ */

export function misesEnAvantActives(emplacement: Emplacement): MiseEnAvantMagasin[] {
  return magasin.misesEnAvant
    .filter((m) => m.emplacement === emplacement && m.retireLe === null)
    .sort((a, b) => a.position - b.position);
}

/**
 * Joint une mise en avant a la fiche du partenaire, au format `HighlightItem`
 * du contrat.
 *
 * ⚠ Extraite d'une duplication : les routes `GET/POST /admin/highlights` et
 * `PUT /admin/highlights/reorder` en avaient chacune leur copie, a l'identique
 * hormis le nom de la variable source. Une seule fonction, un seul endroit ou
 * `note` (notre ajout) doit rester en phase avec `types/api.ts`.
 *
 * `null` si le partenaire est introuvable -- un cas que le registre des
 * mises en avant ne devrait jamais produire (aucune suppression, R6), mais
 * que la route filtre plutot que de faire planter la reponse.
 */
export function versHighlightItem(m: MiseEnAvantMagasin): Record<string, unknown> | null {
  const partenaire = trouverPartenaire(m.partenaireId);
  if (!partenaire) return null;
  return {
    id: m.id,
    partner: { id: partenaire.id, trade_name: partenaire.tradeName, category: partenaire.category },
    placement: m.emplacement,
    position: m.position,
    note: m.mot,
    created_by: m.creePar,
    created_at: m.creeLe,
  };
}

export type EchecMiseEnAvant =
  | "partenaire_introuvable"
  | "partenaire_non_agree"
  | "deja_en_avant";

/**
 * Ajoute un partenaire a un emplacement.
 *
 * ═══ SEUL UN PARTENAIRE `approved` EST ELIGIBLE ═══
 *
 * `highlights.rs:1` ne le dit qu'a demi -- « list joins on status = 'approved' »
 * ne parle que de la LECTURE. C'est `data-dictionary.md:143` qui tranche :
 * « Deux regles portees par le code : seul un partenaire approved est
 * eligible... ». Filtrer seulement a la lecture laisserait un administrateur
 * mettre en avant un dossier suspendu, qui disparaitrait alors silencieusement
 * de la liste sans que rien n'explique pourquoi il refuse d'apparaitre sur la
 * page publique. La regle est donc imposee ICI, a l'ecriture -- pas seulement
 * a `misesEnAvantActives`.
 *
 * ═══ LA POSITION ═══
 *
 * `position: null` signifie « en fin de liste » (`CreateHighlightRequest`,
 * `data-dictionary.md:524`) : on prend le maximum des positions actives + 1.
 * Une position explicite DECALE tout ce qui suit -- c'est ce que le
 * commentaire du back appelle « shift positions out of range first », a
 * cause de l'index partiel sur (placement, position). Le mock n'a pas de
 * transaction SQL a proteger, mais l'effet observable doit etre le meme :
 * aucune collision, meme un instant.
 */
export function ajouterMiseEnAvant(
  partenaireId: string,
  emplacement: Emplacement,
  position: number | null,
  mot: string | null,
  administrateurId: string,
  maintenant: number,
): { miseEnAvant: MiseEnAvantMagasin } | { echec: EchecMiseEnAvant } {
  const partenaire = trouverPartenaire(partenaireId);
  if (!partenaire) return { echec: "partenaire_introuvable" };
  if (partenaire.statut !== "approved") return { echec: "partenaire_non_agree" };

  const actives = misesEnAvantActives(emplacement);
  if (actives.some((m) => m.partenaireId === partenaireId)) {
    return { echec: "deja_en_avant" };
  }

  const motNettoye = mot !== null && mot.trim() !== "" ? mot.trim() : null;

  let cible: number;
  if (position === null) {
    cible = actives.length === 0 ? 1 : Math.max(...actives.map((m) => m.position)) + 1;
  } else {
    cible = Math.max(1, Math.min(position, actives.length + 1));
    /* Decale d'un cran tout ce qui est a la position visee ou au-dela : sans
       cela, deux mises en avant actives partageraient une position, ce que
       l'index partiel interdit en base. */
    for (const m of magasin.misesEnAvant) {
      if (m.emplacement === emplacement && m.retireLe === null && m.position >= cible) {
        m.position += 1;
      }
    }
  }

  const miseEnAvant: MiseEnAvantMagasin = {
    id: crypto.randomUUID(),
    partenaireId,
    emplacement,
    position: cible,
    mot: motNettoye,
    creePar: administrateurId,
    creeLe: new Date(maintenant).toISOString(),
    retireLe: null,
  };
  magasin.misesEnAvant.push(miseEnAvant);

  /* « toute pose ou retrait ecrit dans audit_log » (:143). */
  consignerAuJournal({
    actorId: administrateurId,
    action: "highlight.added",
    entityType: "partner_highlight",
    entityId: miseEnAvant.id,
    payload: { partner_id: partenaireId, placement: emplacement, position: cible },
    quand: maintenant,
  });

  return { miseEnAvant };
}

/**
 * Retire une mise en avant. REMPLIT `removed_at`, ne supprime rien (R6).
 *
 * La position des mises en avant qui suivaient N'EST PAS RECALEE : ce n'est
 * pas demande par le contrat (`DELETE .../{id} → 204`, sans effet de bord
 * documente sur les autres lignes), et une renumerotation automatique
 * surprendrait un ecran qui affiche encore l'ancien ordre a l'instant du
 * retrait. Un reordonnancement explicite (`PUT .../reorder`) reste la seule
 * facon de combler le trou.
 */
export function retirerMiseEnAvant(
  id: string,
  administrateurId: string,
  maintenant: number,
): { miseEnAvant: MiseEnAvantMagasin } | { echec: "introuvable" | "deja_retiree" } {
  const miseEnAvant = magasin.misesEnAvant.find((m) => m.id === id);
  if (!miseEnAvant) return { echec: "introuvable" };
  if (miseEnAvant.retireLe !== null) return { echec: "deja_retiree" };

  const retiree: MiseEnAvantMagasin = { ...miseEnAvant, retireLe: new Date(maintenant).toISOString() };
  const index = magasin.misesEnAvant.indexOf(miseEnAvant);
  magasin.misesEnAvant[index] = retiree;

  consignerAuJournal({
    actorId: administrateurId,
    action: "highlight.removed",
    entityType: "partner_highlight",
    entityId: id,
    payload: { partner_id: miseEnAvant.partenaireId, placement: miseEnAvant.emplacement },
    quand: maintenant,
  });

  return { miseEnAvant: retiree };
}

export type EchecReordonnancement = "ensemble_incomplet" | "identifiant_inconnu";

/**
 * Reordonne un emplacement entier.
 *
 * `ReorderRequest.ordered_ids` est « la liste COMPLETE, dans l'ordre voulu »
 * (`data-dictionary.md:534`) -- pas un delta. La fonction verifie donc que
 * l'ensemble recu est EXACTEMENT celui des mises en avant actives de cet
 * emplacement, ni plus ni moins : un identifiant absent laisserait une ligne
 * sans position coherente, un identifiant en trop referencerait une mise en
 * avant qui n'existe pas ou qui est ailleurs.
 *
 * Les positions sont reaffectees 1..N dans l'ordre recu, en une seule passe :
 * comme il n'y a ni ecriture partagee ni lecture concurrente dans ce mock, le
 * risque de collision transitoire que le commentaire du back signale
 * (« shift positions out of range first ») ne se pose pas ici -- mais
 * l'ordre final observe est le meme que si on l'avait fait.
 */
export function reordonnerMisesEnAvant(
  emplacement: Emplacement,
  ordonnes: string[],
  administrateurId: string,
  maintenant: number,
): { misesEnAvant: MiseEnAvantMagasin[] } | { echec: EchecReordonnancement } {
  const actives = misesEnAvantActives(emplacement);
  const attendus = new Set(actives.map((m) => m.id));
  const recus = new Set(ordonnes);

  if (attendus.size !== recus.size || ![...attendus].every((id) => recus.has(id))) {
    return ordonnes.some((id) => !attendus.has(id))
      ? { echec: "identifiant_inconnu" }
      : { echec: "ensemble_incomplet" };
  }

  ordonnes.forEach((id, index) => {
    const miseEnAvant = magasin.misesEnAvant.find((m) => m.id === id);
    if (miseEnAvant) miseEnAvant.position = index + 1;
  });

  consignerAuJournal({
    actorId: administrateurId,
    action: "highlight.reordered",
    entityType: "partner_highlight",
    entityId: null,
    payload: { placement: emplacement, ordered_ids: ordonnes },
    quand: maintenant,
  });

  return { misesEnAvant: misesEnAvantActives(emplacement) };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * RECHARGEMENTS — FINANCEMENT DES COMPTES SALARIES
 *
 * Modele : `funding/topup.rs` (rechargement individuel, ENTIEREMENT ECRIT
 * cote back -- le module le plus construit apres le paiement), `batch.rs`
 * (lot), `csv.rs` (format d'import). Un FINANCEMENT, pas une correction : a
 * distinguer de `regulariser` (fiche salarie), qui repare une erreur. Ici on
 * verse un droit -- le compte d'emission `MINISTRY_ISSUANCE` est TOUJOURS le
 * debiteur, jamais un compte de correction.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type EchecTopup = "salarie_introuvable" | "compte_inactif" | "motif_manquant" | "montant_invalide";

/**
 * Credite un salarie, identifie par SON EMPLOYEUR ET SON MATRICULE.
 *
 * ⚠ PAS PAR IDENTIFIANT INTERNE. `topup(tx, admin, employer_id, account_id,
 * amount, reference)` (`funding/topup.rs:16-24`) adresse par
 * `(employer_id, employer_ref)`, exactement comme `TopupRequest`
 * (`data-dictionary.md:537-543`) : `employer_id`, `employer_ref`, jamais un
 * identifiant de salarie. C'est la meme logique que le matricule d'un jeton
 * de paie : l'employeur connait ses salaries par ce numero, pas par un UUID
 * interne au dispositif.
 *
 * ═══ IDEMPOTENCE PAR `reference`, ET C'EST PLUS SURPRENANT QU'IL N'Y PARAIT ═══
 *
 * `topup.rs:28-33` : si une `reference` est fournie et qu'un rechargement
 * portant la MEME `(employer_id, reference)` existe deja, la fonction rend
 * CET rechargement EXISTANT sans en creer un second -- **quel que soit le
 * compte vise cette fois**. La cle d'idempotence ne porte QUE sur
 * `(employer_id, reference)`, jamais sur le compte credite. Reutiliser par
 * erreur la reference d'un autre salarie du meme employeur ne leve AUCUNE
 * erreur : ca renvoie silencieusement le premier rechargement, et le second
 * salarie n'est pas credite. C'est le comportement REEL du back, implemente
 * tel quel ici -- pas une version "plus sure" qu'on aurait pu preferer.
 *
 * ═══ LE MOTIF EST NOTRE AJOUT, ET VOICI POURQUOI IL DIVERGE DU BACK REEL ═══
 *
 * `topup.rs:59` poste l'operation avec `memo: None` -- EN DUR. La signature de
 * `topup()` n'a d'ailleurs AUCUN parametre pour un motif, et `TopupRequest`
 * n'en porte pas davantage. Ce n'est pas un trou du contrat comme les autres
 * : c'est un choix explicite, ecrit dans du code qui fonctionne.
 *
 * L'ecran le demande neanmoins : "un salarie, un montant, un motif" -- et un
 * versement d'argent public sans aucune trace de sa raison serait la seule
 * ecriture du registre a n'en porter aucune, alors que la regularisation et
 * l'annulation en exigent une. Le motif est donc collecte et pose sur
 * `memo`, la colonne generique de `ledger_operations` que d'autres natures
 * utilisent deja -- mais SI cette route doit un jour parler a un vrai
 * `topup()`, sa signature devra gagner un parametre `memo: Option<&str>`
 * pour le recevoir. Le signaler ici, c'est le signaler au bon endroit :
 * c'est la seule fonction qui pretend imiter `topup()`.
 */
export function crediterSalarie(
  employeurId: string,
  matricule: string,
  montantCentimes: MontantCentimes,
  motif: string | null,
  reference: string | null,
  administrateurId: string,
  maintenant: number,
): { operation: OperationRegistre; rejoue: boolean } | { echec: EchecTopup } {
  const salarie = magasin.salaries.find(
    (s) => s.employeurId === employeurId && s.matricule === matricule,
  );
  if (!salarie) return { echec: "salarie_introuvable" };
  if (salarie.statut !== "actif") return { echec: "compte_inactif" };

  if (!Number.isInteger(montantCentimes) || montantCentimes <= 0) {
    return { echec: "montant_invalide" };
  }

  const motifNettoye = motif !== null && motif.trim() !== "" ? motif.trim() : null;
  if (motifNettoye === null) return { echec: "motif_manquant" };

  const referenceNettoyee = reference !== null && reference.trim() !== "" ? reference.trim() : null;

  /* Le rejeu : voir l'en-tete. Scope volontairement (employeurId, reference),
     PAS le compte -- c'est le comportement du back, fidelement reproduit. */
  if (referenceNettoyee !== null) {
    const existant = magasin.topups.find(
      (t) => t.employeurId === employeurId && t.reference === referenceNettoyee,
    );
    if (existant) {
      const operation = trouverOperation(existant.operationId);
      if (operation) return { operation, rejoue: true };
    }
  }

  const operation = posterOperation({
    kind: "topup",
    amountCentimes: montantCentimes,
    debiter: "ACC-MINISTRY_ISSUANCE",
    crediter: idCompte(salarie.id),
    memo: motifNettoye,
    createdBy: administrateurId,
    occurredAt: new Date(maintenant).toISOString(),
    quand: maintenant,
  });

  magasin.topups.push({
    operationId: operation.id,
    batchId: null,
    employeurId,
    reference: referenceNettoyee,
  });

  return { operation, rejoue: false };
}

/** Colonnes `topups` (`0001_schema.sql:219-225`) que le magasin doit tenir pour l'idempotence et les lots. */
export interface TopupMagasin {
  operationId: Identifiant;
  batchId: Identifiant | null;
  employeurId: Identifiant;
  reference: string | null;
}

/* ── L'import CSV ─────────────────────────────────────────────────────────
 *
 * Deux etages, comme le back : `csv.rs` ne valide que le FORMAT (colonnes,
 * types) ; `batch.rs` resout ensuite chaque ligne contre les salaries reels
 * de l'employeur. Une erreur de format et une ligne sans salarie correspondant
 * sont deux choses distinctes, mais rendent la MEME chose a l'ecran :
 * `BatchLineError { line, employer_ref, reason }`.
 * ────────────────────────────────────────────────────────────────────────── */

export type EchecCsv = "fichier_vide" | "entete_invalide";

interface LigneCsvBrute {
  ligne: number;
  matriculeOuCourriel: string;
  montantTexte: string;
  reference: string | null;
}

/**
 * `csv.rs:1-2` : colonnes `matricule, montant`, `reference` FACULTATIVE, un
 * courriel accepte comme cle alternative dans la colonne matricule. Format
 * seulement -- aucune resolution de salarie ici.
 *
 * L'ordre des colonnes n'est pas impose, seuls leurs noms comptent : c'est
 * NOTRE CHOIX, le contrat ne precise rien de plus que les trois noms.
 */
function analyserCsv(texte: string): { lignes: LigneCsvBrute[] } | { echec: EchecCsv } {
  const brutes = texte.split(/\r\n|\r|\n/).filter((ligne) => ligne.trim() !== "");
  if (brutes.length === 0) return { echec: "fichier_vide" };

  const entetes = (brutes[0] ?? "").split(",").map((c) => c.trim().toLowerCase());
  const indexMatricule = entetes.indexOf("matricule");
  const indexMontant = entetes.indexOf("montant");
  const indexReference = entetes.indexOf("reference");
  if (indexMatricule === -1 || indexMontant === -1) return { echec: "entete_invalide" };

  const lignes: LigneCsvBrute[] = [];
  for (let i = 1; i < brutes.length; i += 1) {
    const champs = (brutes[i] ?? "").split(",").map((c) => c.trim());
    lignes.push({
      ligne: i + 1,
      matriculeOuCourriel: champs[indexMatricule] ?? "",
      montantTexte: champs[indexMontant] ?? "",
      reference: indexReference === -1 ? null : (champs[indexReference] || null),
    });
  }
  return { lignes };
}

export interface LigneLot {
  ligne: number;
  matriculeOuCourriel: string;
  /** `null` si la ligne n'a pu etre resolue a un salarie de cet employeur. */
  salarieId: string | null;
  /** `null` si le montant est illisible. */
  montantCentimes: number | null;
  reference: string | null;
  /** Raison de l'echec pour cette ligne, ou `null` si elle est valide. */
  erreur: string | null;
}

export interface LotRechargement {
  id: Identifiant;
  employeurId: Identifiant;
  nomFichier: string;
  /** Empreinte SHA-256 du CONTENU texte du fichier -- voir `sha256`. */
  empreinte: string;
  statut: "draft" | "validated" | "rejected";
  motif: string | null;
  lignes: LigneLot[];
  televerseePar: Identifiant;
  televerseeLe: string;
  valideeLe: string | null;
}

/**
 * Resout une ligne brute contre les salaries de l'employeur.
 *
 * `matricule OU courriel` : `csv.rs:1` accepte un courriel comme cle
 * alternative. On essaie d'abord une correspondance exacte de matricule,
 * puis, si la valeur contient `@`, une correspondance de courriel -- jamais
 * les deux en meme temps sur une valeur qui ne ressemble pas a un courriel,
 * pour ne pas faire correspondre un matricule qui contiendrait par hasard un
 * `@`.
 */
function resoudreLigne(employeurId: string, brute: LigneCsvBrute): LigneLot {
  const parMatricule = magasin.salaries.find(
    (s) => s.employeurId === employeurId && s.matricule === brute.matriculeOuCourriel,
  );
  const parCourriel = brute.matriculeOuCourriel.includes("@")
    ? magasin.salaries.find(
        (s) => s.employeurId === employeurId
          && s.courriel.toLowerCase() === brute.matriculeOuCourriel.toLowerCase(),
      )
    : undefined;
  const salarie = parMatricule ?? parCourriel;

  const montantCentimes = centimesDepuisSaisie(brute.montantTexte);

  let erreur: string | null = null;
  if (brute.matriculeOuCourriel === "") {
    erreur = "Matricule ou courriel manquant.";
  } else if (!salarie) {
    erreur = "Aucun salarié ne correspond à ce matricule ou ce courriel pour cet employeur.";
  } else if (salarie.statut !== "actif") {
    erreur = "Ce compte n'est pas actif.";
  } else if (montantCentimes === null) {
    erreur = "Montant illisible.";
  }

  return {
    ligne: brute.ligne,
    matriculeOuCourriel: brute.matriculeOuCourriel,
    salarieId: salarie?.id ?? null,
    montantCentimes,
    reference: brute.reference,
    erreur,
  };
}

export type EchecMiseEnAttenteLot = EchecCsv | "employeur_introuvable" | "fichier_deja_importe";

/**
 * Met un fichier en attente : c'est l'ETAGE `parse_and_stage`
 * (`batch.rs:1`). Le lot est TOUJOURS cree si le fichier est lisible et
 * inedit -- meme si des lignes sont en erreur : c'est l'apercu qui les
 * montre, `validerLot` seul les refuse.
 *
 * L'empreinte est unique PAR EMPLOYEUR (`uq_batch_file`,
 * `0001_schema.sql:216`) : le meme fichier importe pour deux employeurs
 * differents n'est pas un doublon, mais le reimporter deux fois pour le
 * MEME employeur l'est -- meme si le premier essai n'a jamais ete valide.
 */
export function mettreLotEnAttente(
  employeurId: string,
  nomFichier: string,
  contenu: string,
  motif: string | null,
  administrateurId: string,
  maintenant: number,
): { lot: LotRechargement } | { echec: EchecMiseEnAttenteLot } {
  if (!trouverEmployeur(employeurId)) return { echec: "employeur_introuvable" };

  const motifNettoye = motif !== null && motif.trim() !== "" ? motif.trim() : null;

  const analyse = analyserCsv(contenu);
  if ("echec" in analyse) return { echec: analyse.echec };

  const empreinte = sha256(contenu);
  const doublon = magasin.lots.some(
    (l) => l.employeurId === employeurId && l.empreinte === empreinte,
  );
  if (doublon) return { echec: "fichier_deja_importe" };

  const lignes = analyse.lignes.map((brute) => resoudreLigne(employeurId, brute));

  const lot: LotRechargement = {
    id: crypto.randomUUID(),
    employeurId,
    nomFichier,
    empreinte,
    statut: "draft",
    motif: motifNettoye,
    lignes,
    televerseePar: administrateurId,
    televerseeLe: new Date(maintenant).toISOString(),
    valideeLe: null,
  };
  magasin.lots.push(lot);

  return { lot };
}

export type EchecValidationLot = "introuvable" | "lignes_en_erreur" | "deja_traite" | "motif_manquant";

/**
 * Valide un lot : c'est `validate_batch` (`batch.rs:2`), l'ecriture.
 *
 * ═══ UN LOT AVEC UNE SEULE ERREUR EST REJETE EN ENTIER ═══
 *
 * La regle est repetee mot pour mot dans `funding/batch.rs:2` et
 * `docs/file-guide.md:210`. Elle est verifiee ICI, cote SERVEUR -- pas
 * seulement par un bouton grise a l'ecran, qui se contourne. Si une seule
 * ligne porte une erreur, AUCUNE operation n'est postee : le lot bascule en
 * `rejected` et la reponse est un refus.
 *
 * Rien n'est ecrit avant que TOUTES les lignes soient verifiees : la boucle
 * de verification est separee de la boucle d'ecriture.
 */
export function validerLot(
  id: string,
  administrateurId: string,
  maintenant: number,
): { lot: LotRechargement; operations: OperationRegistre[] } | { echec: EchecValidationLot } {
  const lot = magasin.lots.find((l) => l.id === id);
  if (!lot) return { echec: "introuvable" };
  if (lot.statut !== "draft") return { echec: "deja_traite" };

  if (lot.motif === null) return { echec: "motif_manquant" };

  if (lot.lignes.some((ligne) => ligne.erreur !== null)) {
    lot.statut = "rejected";
    return { echec: "lignes_en_erreur" };
  }

  const operations: OperationRegistre[] = [];
  for (const ligne of lot.lignes) {
    if (ligne.salarieId === null || ligne.montantCentimes === null) {
      /* Ne peut pas arriver : la garde ci-dessus l'a deja exclu. Rassure le
         typeur sans dupliquer la logique de validite. */
      continue;
    }
    const operation = posterOperation({
      kind: "topup",
      amountCentimes: ligne.montantCentimes,
      debiter: "ACC-MINISTRY_ISSUANCE",
      crediter: idCompte(ligne.salarieId),
      memo: lot.motif,
      createdBy: administrateurId,
      occurredAt: new Date(maintenant).toISOString(),
      quand: maintenant,
    });
    magasin.topups.push({
      operationId: operation.id,
      batchId: lot.id,
      employeurId: lot.employeurId,
      reference: ligne.reference,
    });
    operations.push(operation);
  }

  lot.statut = "validated";
  lot.valideeLe = new Date(maintenant).toISOString();

  return { lot, operations };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * AMORCE DIFFEREE
 *
 * ⚠ EN FIN DE MODULE, ET C'EST OBLIGATOIRE. `emettreJeton` s'appuie sur
 * `ALPHABET_CODE`, un `const` declare plus bas dans ce fichier : appeler
 * l'amorce plus haut la ferait tomber dans la zone morte temporelle, et le
 * module entier echouerait au chargement. Les declarations de fonction sont
 * hissees, pas les `const`.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Un jeton en cours, pour que « reserve » ne vaille pas toujours zero.
 *
 * Sans lui, `held` est nul partout et les trois soldes de la fiche affichent
 * le meme nombre : la distinction que l'ecran doit faire -- un salarie dont
 * 25 EUR sont reserves n'a pas perdu 25 EUR -- serait indemontrable.
 *
 * ⚠ IL EXPIRE, et c'est voulu. Un jeton vit cinq minutes (`QR_TTL_MAX_SECONDES`,
 * T. Vignal) ; passe ce delai `libererJetonsExpires` le retire et les fonds
 * reviennent au disponible. La reservation est transitoire par nature, et un
 * jeu de demonstration qui la figerait mentirait sur ce qu'elle est. Il passe
 * par `emettreJeton`, le point d'emission ordinaire : rien n'est fabrique a
 * cote.
 */
/**
 * Les mises en avant de demonstration, sur les deux emplacements.
 *
 * Choisies pour que chaque cas de l'ecran soit atteignable : une mise en avant
 * AVEC mot du ministre, une SANS, plusieurs positions sur un meme emplacement,
 * et un partenaire exclusivement en ligne mis en avant -- pour verifier que la
 * vitrine publique se comporte pour lui comme pour les autres (aucune ville,
 * `district` a `null`).
 *
 * Passe par `ajouterMiseEnAvant`, le point d'ecriture ordinaire : rien n'est
 * fabrique a cote, et les regles d'eligibilite sont donc bien exercees ici
 * aussi.
 */
function amorcerMisesEnAvant(): void {
  if (magasin.misesEnAvant.length > 0) return;
  const t = Date.parse("2026-08-15T09:00:00.000Z");

  ajouterMiseEnAvant(
    "PRT-001",
    "minister_pick",
    null,
    "Une institution du quartier, et une adhésion parmi les toutes premières du dispositif.",
    "ADM-001",
    t,
  );
  ajouterMiseEnAvant("PRT-011", "minister_pick", null, null, "ADM-001", t + 60_000);

  ajouterMiseEnAvant(
    "PRT-009",
    "public_featured",
    null,
    "Un marche qui a joue le jeu des le premier jour.",
    "ADM-001",
    t + 120_000,
  );
  ajouterMiseEnAvant("PRT-010", "public_featured", null, null, "ADM-001", t + 180_000);
  ajouterMiseEnAvant(
    "PRT-016",
    "public_featured",
    null,
    "La lecture accessible partout, sans devanture.",
    "ADM-001",
    t + 240_000,
  );
}

function amorcerJetonEnCours(): void {
  if (magasin.jetons.size > 0) return;
  emettreJeton("SAL-004", 25_00, Date.now());
}

amorcerJetonEnCours();
amorcerMisesEnAvant();
