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
