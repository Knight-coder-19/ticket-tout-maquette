/**
 * Types du domaine metier.
 * Ils decrivent ce que le front manipule, pas ce que le backend stocke.
 * A confronter au contrat OpenAPI produit par l'equipe backend.
 */

export type Identifiant = string;

/** Montant en centimes. Jamais de flottant pour de la monnaie. */
export type MontantCentimes = number;

export interface Salarie {
  id: Identifiant;
  nom: string;
  employeur: string;
}

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
  | "decheance"
  /** ⚠ Notre ajout à `operation_kind` — voir `mocks/registre.ts`. */
  | "regularisation";

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

/**
 * L'état de MON compte, tel que l'espace partenaire le manipule.
 *
 * Distinct de `ComptePartenaire`, qui est la vue de l'administration sur le
 * compte d'un autre : celle-ci porte l'activité et le nom légal, celle-là porte
 * ce qu'un commerçant a besoin de savoir sur lui-même. Ni volume, ni auteur de
 * la décision — un partenaire n'a pas à savoir quel agent a tranché.
 */
export interface MonCompte {
  id: Identifiant;
  enseigne: string;
  /** Raison sociale : le nom légal, distinct de l'enseigne affichée. */
  raisonSociale: string;
  /** Identifiant fiscal. `null` si le dossier a été agréé sans (`:105`). */
  identifiantFiscal: string | null;
  /** Libellé venu des données. Aucune liste de catégories dans l'interface. */
  categorie: string;
  /** Distingue une ville absente d'une ville qui n'a pas lieu d'être. */
  modeService: ModeDeService;
  statut: StatutPartenaire;
  /** Motif de la dernière décision. `null` si aucune. */
  motif: string | null;
  /**
   * Date ISO 8601 de la DERNIÈRE décision, `null` si aucune.
   *
   * Pour un compte agréé, c'est la décision qui a ouvert les encaissements —
   * ou qui les a rouverts après une suspension. La date du tout premier
   * agrément n'est récupérable nulle part : `partners.reviewed_at` est écrasée
   * à chaque décision, et le journal d'audit qui la garde n'a aucune route de
   * lecture. C'est pourquoi la fiche l'intitule « Décision d'agrément » et non
   * « Membre depuis ».
   */
  decideeLe: string | null;
  deposeeLe: string;
  courrielContact: string;
  ville: string | null;
}

/**
 * Comment un établissement sert ses clients.
 *
 * Nommée plutôt qu'écrite en ligne dans chaque type qui en a besoin : la
 * fiche du catalogue et la fiche d'établissement du commerçant portent le
 * MÊME concept. Deux unions pour un concept, c'est la certitude qu'un jour
 * l'une gagnera une valeur que l'autre ignorera.
 *
 * En français, comme tout le domaine : `ServiceMode` est la forme du réseau,
 * et `modeDeService` (`lib/api/adaptateurs.ts`) est le seul endroit qui
 * traduise l'une vers l'autre.
 */
export type ModeDeService = "physique" | "en_ligne" | "les_deux";

/**
 * Une fiche du catalogue, telle qu'un partenaire ou un salarié la consulte.
 *
 * Distincte de `Partenaire` : celle-ci porte l'adresse complète et le mode de
 * service, dont le catalogue a besoin, et pas `estMisEnAvant`, qui relève des
 * mises en avant décidées par l'administration.
 *
 * ⚠ Aucun montant, aucune statistique, aucun contact — le catalogue n'expose
 * que ce que le contrat lui donne (`data-dictionary.md:470-480`), et il ne
 * ressert QUE des partenaires agréés (`catalog.rs:1`).
 */
export interface FicheCatalogue {
  id: Identifiant;
  enseigne: string;
  /** Libellé venu des données. Aucune liste de catégories dans l'interface. */
  categorie: string;
  /** `null` pour un commerce exclusivement en ligne. */
  ville: string | null;
  departement: string | null;
  quartier: string | null;
  adresse: string | null;
  siteWeb: string | null;
  modeService: ModeDeService;
  /** Dérivé de `status === "approved"` (A4), jamais stocké. */
  estOfficiel: boolean;
}

/** Une catégorie du référentiel, avec son effectif. */
export interface CategorieCatalogue {
  nom: string;
  nombreDePartenaires: number;
}

/** Une ville du référentiel. */
export interface VilleCatalogue {
  id: Identifiant;
  nom: string;
  departement: string;
}


/**
 * Une transaction de la vue nationale.
 *
 * Le MÊME fait qu'une `EcritureRegistre`, vu autrement. Le registre en montre
 * la comptabilité : deux écritures, un débit, un crédit, une empreinte et un
 * rang dans la chaîne. Celle-ci en montre l'activité : une ligne par paiement,
 * avec le commerçant, sa ville et sa catégorie — que le registre ignore, un
 * compte n'y portant qu'un propriétaire.
 *
 * Deux types plutôt qu'un parce que ce sont deux questions. Les fondre
 * obligerait chaque écran à ignorer la moitié des champs, et le jour où l'un
 * des deux gagnerait une colonne, l'autre la porterait sans l'utiliser.
 */
export interface TransactionNationale {
  /** L'identifiant de l'opération, celui du registre. */
  id: Identifiant;
  /** Date ISO 8601 du FAIT, pas de l'enregistrement. */
  survenueLe: string;
  montant: MontantCentimes;
  partenaireId: Identifiant;
  /** `null` si la fiche du partenaire est introuvable. */
  enseigne: string | null;
  categorie: string | null;
  /** `null` pour un commerce exclusivement en ligne. */
  ville: string | null;
  departement: string | null;
  /** ⚠ Notre ajout : le contrat ne porte aucun état sur une transaction. */
  annulee: boolean;
  motifAnnulation: string | null;
}

/**
 * Les totaux d'un ensemble filtré de transactions.
 *
 * ⚠ Ils portent sur TOUT l'ensemble qui répond au filtre, jamais sur la page
 * affichée. Un total calculé sur vingt lignes et présenté comme national
 * serait faux, et il le serait avec assurance.
 */
export interface TotauxTransactions {
  /** Toutes les opérations retenues, annulations comprises. */
  nombre: number;
  /** Combien, parmi elles, ont été annulées. */
  nombreAnnulees: number;
  /** Cumul NET : une opération annulée n'y figure pas. */
  volume: MontantCentimes;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LE RÉPERTOIRE DES BÉNÉFICIAIRES
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * L'état du compte d'un bénéficiaire.
 *
 * Les TROIS valeurs de `user_status` (`0001_schema.sql:5`). Un écran qui ne
 * traite légitimement que certains statuts filtre ; il ne redéclare pas un
 * type plus étroit.
 */
export type StatutBeneficiaire = "actif" | "suspendu" | "ferme";

/** Une ligne du répertoire. Le solde y est le seul disponible. */
export interface LigneRepertoire {
  id: Identifiant;
  nom: string;
  prenom: string;
  /** « Amélie Roussel ». */
  nomAffiche: string;
  employeur: string | null;
  employeurId: Identifiant | null;
  /** Le matricule, `employment_links.employer_ref`. */
  matricule: string;
  statut: StatutBeneficiaire;
  disponible: MontantCentimes;
}

/**
 * Les trois soldes d'un bénéficiaire, en centimes entiers.
 *
 * ⚠ Ils ne sont PAS interchangeables, et l'écran doit le dire. `reserve` n'est
 * pas de l'argent perdu : c'est une somme immobilisée par un paiement en cours
 * qui revient au disponible si le jeton expire. Afficher le seul `disponible`
 * ferait croire à une perte ; afficher le seul `regle` ferait croire à une
 * disponibilité qui n'existe pas.
 */
export interface TroisSoldes {
  /** `balance_settled` : le total possédé. */
  regle: MontantCentimes;
  /** `balance_held` : immobilisé par les jetons en cours. */
  reserve: MontantCentimes;
  /** `regle - reserve`. C'est ce nombre qu'on affiche en grand. */
  disponible: MontantCentimes;
}

/** La fiche complète d'un bénéficiaire. */
export interface FicheBeneficiaire {
  id: Identifiant;
  nom: string;
  prenom: string;
  nomAffiche: string;
  telephone: string | null;
  statut: StatutBeneficiaire;
  employeur: string | null;
  employeurId: Identifiant | null;
  ifuEmployeur: string | null;
  matricule: string;
  /** Date ISO 8601 (une DATE, sans heure) d'entrée dans le dispositif. */
  entreLe: string;
  soldes: TroisSoldes;
  /** Nombre de paiements en cours — ce qui explique la part réservée. */
  jetonsEnCours: number;
}

/** Un employeur du référentiel, avec son effectif venu des données. */
export interface EmployeurRepertoire {
  id: Identifiant;
  raisonSociale: string;
  nombreDeBeneficiaires: number;
}

/** Le sens d'une régularisation. */
export type SensRegularisation = "credit" | "debit";

/**
 * Ce que rend une régularisation : le solde APRÈS et l'écriture qui l'explique.
 *
 * Les deux ensemble. C'est la forme même de la règle R1 : le solde n'est
 * jamais une valeur qu'on pose, toujours une conséquence qu'on peut remonter.
 */
export interface Regularisation {
  soldes: TroisSoldes;
  ecriture: {
    operationId: Identifiant;
    sens: SensRegularisation;
    montant: MontantCentimes;
    motif: string | null;
    /** Date ISO 8601 du fait. */
    survenueLe: string;
    auteur: Identifiant | null;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MISES EN AVANT — VITRINE PUBLIQUE
 * ═══════════════════════════════════════════════════════════════════════════ */

/** `highlight_placement` (`0001_schema.sql:16`). */
export type Emplacement = "minister_pick" | "public_featured";

/** Une mise en avant, telle que l'administration la consulte. */
export interface MiseEnAvant {
  id: Identifiant;
  partenaireId: Identifiant;
  enseigne: string;
  categorie: string;
  emplacement: Emplacement;
  /** Ordre d'affichage, 1-indexé. */
  position: number;
  /** Les mots du ministre, tels qu'ils paraîtront sur la vitrine. `null` si aucun. */
  mot: string | null;
  creePar: Identifiant;
  /** Date ISO 8601. */
  creeLe: string;
}

/**
 * Un partenaire mis en avant, tel que la vitrine publique le montre.
 *
 * ⚠ `mot` est un neuvième champ sur un DTO que la règle R9 verrouille à huit.
 * Voir `types/api.ts`, `PublicPartner`, pour le raisonnement complet.
 */
export interface PartenaireVitrine {
  id: Identifiant;
  enseigne: string;
  categorie: string;
  modeService: ModeDeService;
  ville: string | null;
  departement: string | null;
  quartier: string | null;
  siteWeb: string | null;
  position: number;
  mot: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RECHARGEMENTS — CRÉDIT DES COMPTES SALARIÉS
 *
 * Un FINANCEMENT, pas une correction : à distinguer de `Regularisation`, qui
 * répare une erreur. Ici on verse un droit — le compte d'émission
 * `MINISTRY_ISSUANCE` est toujours le débiteur.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Le reçu d'un rechargement individuel. */
export interface Rechargement {
  operationId: Identifiant;
  montant: MontantCentimes;
  reference: string | null;
  motif: string | null;
  survenueLe: string;
  /** `true` si cette réponse rejoue un rechargement déjà posté (même référence). */
  rejoue: boolean;
}

/** `batch_status` (`0001_schema.sql:15`). */
export type StatutLot = "draft" | "validated" | "rejected";

/** Une ligne en erreur d'un fichier importé. */
export interface LigneEnErreur {
  ligne: number;
  matriculeOuCourriel: string;
  raison: string;
}

/**
 * Une ligne de l'aperçu, valide ou non — voir `types/api.ts`, `BatchPreviewLine`.
 */
export interface LigneApercu {
  ligne: number;
  matriculeOuCourriel: string;
  /** `null` si la ligne n'a pu être résolue. */
  nomResolu: string | null;
  /** `null` si le montant est illisible. */
  montant: MontantCentimes | null;
  /** `null` si la ligne est valide. */
  erreur: string | null;
}

/** L'aperçu d'un lot avant validation. */
export interface ApercuLot {
  id: Identifiant;
  nomFichier: string;
  nombreLignes: number;
  /** Cumul de TOUTES les lignes, même celles en erreur (elles ne comptent que
   *  pour 0 si leur montant est illisible — voir `mocks/magasin.ts`). */
  montantTotal: MontantCentimes;
  statut: StatutLot;
  erreurs: LigneEnErreur[];
  lignes: LigneApercu[];
}
