/**
 * Types du domaine metier.
 * Ils decrivent ce que le front manipule, pas ce que le backend stocke.
 * A confronter au contrat OpenAPI produit par l'equipe backend.
 */

export type Identifiant = string;

/** Montant en centimes. Jamais de flottant pour de la monnaie. */
export type MontantCentimes = number;

export interface Categorie {
  id: Identifiant;
  libelle: string;
  /** Les categories viennent des donnees, jamais des gabarits (B. Sellami). */
  ordre: number;
}

export interface Partenaire {
  id: Identifiant;
  nom: string;
  categorieId: Identifiant;
  ville: string | null;
  estOfficiel: boolean;
  estMisEnAvant: boolean;
}

export type StatutTransaction = "validee" | "annulee" | "contre_ecriture";

export interface Transaction {
  id: Identifiant;
  date: string;
  partenaireNom: string;
  montant: MontantCentimes;
  statut: StatutTransaction;
  /** Renseigne uniquement pour une contre-ecriture. */
  transactionOrigineId: Identifiant | null;
}

export interface Solde {
  montant: MontantCentimes;
  misAJourLe: string;
}

export interface CodePaiement {
  valeur: string;
  expireLe: string;
}

export type StatutPartenaire = "en_attente" | "valide" | "refuse" | "suspendu";

export interface DemandePartenaire {
  id: Identifiant;
  nom: string;
  siren: string;
  objetSocial: string;
  statut: StatutPartenaire;
  /** Obligatoire en cas de refus (F. Pontaillac). */
  motifDecision: string | null;
  decideeLe: string | null;
}

/**
 * Enveloppe de pagination du front — offset : `page`, `taillePage`, `total`.
 *
 * Elle vit ici, avec le reste du domaine, parce que c'est ce que les services
 * manipulent : `ServiceSalarie`, `ServicePartenaire` et `ServiceAdministration`
 * la renvoient à côté de `Transaction`, `Partenaire` et `DemandePartenaire`.
 * Elle ne décrit rien de ce que le back sert.
 *
 * ⚠ Ne pas confondre avec `Paginated<T>` de `types/api.ts`, qui est l'enveloppe
 * keyset du back — `items` + `next_cursor`. Les deux sont incompatibles, et pas
 * par renommage : le back ne compte pas les lignes et ne peut donc pas produire
 * `total`. Aucune conversion n'existe entre elles ; voir
 * front/docs/contrat-api.md, divergence D10.
 */
export interface ReponsePaginee<T> {
  elements: T[];
  page: number;
  taillePage: number;
  total: number;
}


/**
 * Une demande d'adhesion, telle que l'ecran de validation la manipule.
 *
 * Distincte de `DemandePartenaire` ci-dessus, qui decrit un dossier deja
 * tranche (motif, date de decision) et ne porte ni categorie, ni ville, ni
 * date de depot. L'ecran de validation a besoin de ces trois-la et pas des
 * autres : ce sont deux vues, pas une seule mal nommee.
 */
export interface DemandeAdhesion {
  id: Identifiant;
  /** Le nom qui engage : personne morale. */
  raisonSociale: string;
  /** Le nom affiche au public : enseigne. */
  enseigne: string;
  /** Libelle venu des donnees. Aucune liste de categories dans l'interface. */
  categorie: string;
  /** Identifiant fiscal. `null` = dossier incomplet. */
  identifiantFiscal: string | null;
  /** `null` pour un commerce exclusivement en ligne. */
  ville: string | null;
  departement: string | null;
  estEnLigne: boolean;
  siteWeb: string | null;
  courrielContact: string;
  /** Date ISO 8601 du depot. */
  deposeeLe: string;
}

/** Ce qu'une entree du journal des decisions dit a l'agent. */
export type SensDecision = "acceptee" | "refusee" | "autre";

export interface DecisionJournal {
  id: Identifiant;
  demandeId: Identifiant | null;
  /** Enseigne au moment de la decision, telle que le journal l'a figee. */
  enseigne: string | null;
  decision: SensDecision;
  /** Le verbe brut du journal, conserve quand il n'est pas reconnu. */
  action: string;
  motif: string | null;
  auteurId: Identifiant | null;
  /** Date ISO 8601 de la decision. */
  priseLe: string;
}

/**
 * Un compte partenaire, tel que le registre le manipule.
 *
 * Distinct de `DemandeAdhesion` : celle-ci décrit un dossier à trancher, sans
 * statut utile — ils sont tous `pending` — ni activité. Un registre, lui,
 * montre où en est chaque compte et ce qu'il a encaissé. Deux vues, deux types.
 */
export interface ComptePartenaire {
  id: Identifiant;
  raisonSociale: string;
  enseigne: string;
  /** Libellé venu des données. Aucune liste de catégories dans l'interface. */
  categorie: string;
  identifiantFiscal: string | null;
  /** `null` pour un commerce exclusivement en ligne. */
  ville: string | null;
  departement: string | null;
  estEnLigne: boolean;
  courrielContact: string;
  statut: StatutCompte;
  /** Cumul encaissé, en centimes entiers. */
  totalRecu: MontantCentimes;
  nombreTransactions: number;
  /** Date ISO 8601 de la dernière décision, `null` si aucune. */
  decideeLe: string | null;
  auteurDecision: Identifiant | null;
  motifDecision: string | null;
}

/**
 * Les cinq états d'un compte, en français.
 *
 * ⚠ `StatutPartenaire` plus haut n'en couvre que quatre : il lui manque
 * l'équivalent de `closed`. Cette union-ci est calée sur l'ENUM du back
 * (`partner_status`, `0001_schema.sql:7`), qui en a cinq. Les deux coexistent
 * le temps que quelqu'un tranche laquelle survit.
 */
export type StatutCompte =
  | "en_attente"
  | "agree"
  | "refuse"
  | "suspendu"
  | "ferme";

