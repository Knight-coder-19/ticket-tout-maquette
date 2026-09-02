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

/**
 * Les cinq états d'un partenaire.
 *
 * Un partenaire, un statut, une union. Calée sur l'ENUM `partner_status` du
 * back (`0001_schema.sql:7`), valeur pour valeur — cinq d'un côté, cinq de
 * l'autre.
 *
 * ⚠ Elle en portait quatre, et il en existait une seconde à cinq valeurs sous
 * un autre nom. Deux unions pour un concept, c'est la garantie qu'un jour un
 * compte fermé sera traité comme autre chose sans que rien ne proteste : le
 * type le plus étroit accepte la valeur du plus large par une conversion que
 * personne ne relit. Il n'y en a plus qu'une.
 *
 * Un écran qui ne traite légitimement que certains statuts FILTRE — il ne
 * redéclare pas un type plus étroit. `TableauPartenaires` n'offre d'actions
 * que sur `agree` et `suspendu`, et le fait par des conditions, pas par un
 * type.
 */
export type StatutPartenaire =
  | "en_attente"
  | "agree"
  | "refuse"
  | "suspendu"
  | "ferme";

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
  statut: StatutPartenaire;
  /** Cumul encaissé, en centimes entiers. */
  totalRecu: MontantCentimes;
  nombreTransactions: number;
  /** Date ISO 8601 de la dernière décision, `null` si aucune. */
  decideeLe: string | null;
  auteurDecision: Identifiant | null;
  motifDecision: string | null;
}

/** Le sens d'une écriture, en partie double. */
export type SensEcriture = "debit" | "credit";

/** La nature d'une opération. ENUM `operation_kind` du back. */
export type NatureEcriture =
  | "rechargement"
  | "paiement"
  | "annulation"
  | "decheance";

/**
 * Une écriture du registre, telle que l'écran la manipule.
 *
 * `montant` est un ENTIER DE CENTIMES, comme partout dans le domaine. Le back
 * sert des euros décimaux ; la reconversion a lieu dans l'adaptateur, et le
 * formatage à l'affichage seulement.
 */
export interface EcritureRegistre {
  /** Numéro d'ordre au journal. C'est lui que la chaîne de hachage fige. */
  seq: number;
  operationId: Identifiant;
  /** Le titulaire du compte touché : un salarié, un partenaire, ou le système. */
  titulaire: string;
  typeTitulaire: "employee" | "partner" | "system";
  sens: SensEcriture;
  montant: MontantCentimes;
  nature: NatureEcriture;
  libelle: string | null;
  /** Date ISO 8601 du fait. */
  survenueLe: string;
  /** Date ISO 8601 de l'inscription au journal. */
  inscriteLe: string;
  empreinte: string;
  empreintePrecedente: string;
  /** L'opération qui a annulé celle-ci, `null` si elle ne l'a pas été. */
  annuleePar: Identifiant | null;
  motifAnnulation: string | null;
}

/** Le résultat d'un contrôle d'intégrité de la chaîne. */
export interface VerificationIntegrite {
  intacte: boolean;
  ecrituresVerifiees: number;
  /** Position de la première écriture en défaut, `null` si la chaîne tient. */
  premiereFautive: number | null;
  /** Heure du contrôle, en millisecondes. Posée par le front, pas par le back. */
  controleeA: number;
}

