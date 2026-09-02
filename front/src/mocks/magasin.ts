/**
 * Magasin de donnees en memoire.
 * Il tient lieu de backend le temps que l'API reelle existe : les routes
 * de `src/app/api` lisent et ecrivent ici, et nulle part ailleurs.
 *
 * Regle monetaire : tous les montants sont des entiers de centimes.
 * Aucun flottant ne traverse ce fichier (T. Vignal).
 */

import type {
  Identifiant,
  MontantCentimes,
  StatutPartenaire,
  StatutTransaction,
} from "@/types/domaine";

/** Duree de validite d'un jeton de paiement, en millisecondes. */
export const TTL_JETON = 5 * 60 * 1000;

/** Un salarie suspendu conserve son solde mais ne peut plus emettre. */
export type StatutSalarie = "actif" | "suspendu";

export interface SalarieMagasin {
  id: Identifiant;
  nom: string;
  employeur: string;
  statut: StatutSalarie;
  /** Entier de centimes. */
  soldeCentimes: MontantCentimes;
}

export interface PartenaireMagasin {
  id: Identifiant;
  nom: string;
  ville: string;
  statut: StatutPartenaire;
}

/**
 * Jeton de paiement emis pour un salarie.
 * Les noms de champs sont ceux de l'API, pas ceux du domaine : ce qui est
 * stocke ici est renvoye tel quel par les routes.
 */
export interface JetonPaiement {
  token: string;
  employeeId: Identifiant;
  /** Date ISO 8601. */
  issuedAt: string;
  /** Date ISO 8601. */
  expiresAt: string;
  /** Date ISO 8601, ou null tant que le jeton n'a pas servi. */
  usedAt: string | null;
}

export interface TransactionMagasin {
  id: Identifiant;
  /** Date ISO 8601. */
  date: string;
  salarieId: Identifiant;
  partenaireId: Identifiant;
  /** Jeton consomme par l'encaissement, null pour les ecritures historiques. */
  jetonToken: string | null;
  /** Entier de centimes. */
  montantCentimes: MontantCentimes;
  statut: StatutTransaction;
}

export interface Magasin {
  salaries: SalarieMagasin[];
  partenaires: PartenaireMagasin[];
  /** Indexes par valeur de jeton. */
  jetons: Map<string, JetonPaiement>;
  transactions: TransactionMagasin[];
}

/**
 * Jeu de donnees de demonstration.
 * Il est choisi pour que chaque refus soit atteignable depuis l'interface :
 * - SAL-001 : solde confortable, le parcours nominal ;
 * - SAL-002 : solde faible, le refus pour montant superieur au solde ;
 * - SAL-003 : compte suspendu, le refus de compte.
 * Le refus `empty_balance` se declenche des qu'un salarie actif tombe a zero
 * (par exemple en repassant SAL-003 en `actif`, son solde etant vide).
 */
function donneesInitiales(): Magasin {
  return {
    salaries: [
      {
        id: "SAL-001",
        nom: "Amelie Roussel",
        employeur: "Mairie de Cotonou",
        statut: "actif",
        soldeCentimes: 15_000,
      },
      {
        id: "SAL-002",
        nom: "Bastien Nkoue",
        employeur: "Mairie de Cotonou",
        statut: "actif",
        soldeCentimes: 350,
      },
      {
        id: "SAL-003",
        nom: "Clara Doumbia",
        employeur: "Office du tourisme",
        statut: "suspendu",
        soldeCentimes: 0,
      },
    ],
    partenaires: [
      {
        id: "PRT-001",
        nom: "Boulangerie du Marche",
        ville: "Cotonou",
        statut: "valide",
      },
      {
        id: "PRT-002",
        nom: "Librairie Les Palmiers",
        ville: "Porto-Novo",
        statut: "en_attente",
      },
    ],
    jetons: new Map<string, JetonPaiement>(),
    transactions: [
      {
        id: "TRX-001",
        date: "2026-08-28T09:14:00.000Z",
        salarieId: "SAL-001",
        partenaireId: "PRT-001",
        jetonToken: null,
        montantCentimes: 1_250,
        statut: "validee",
      },
      {
        id: "TRX-002",
        date: "2026-08-30T12:02:00.000Z",
        salarieId: "SAL-002",
        partenaireId: "PRT-001",
        jetonToken: null,
        montantCentimes: 480,
        statut: "validee",
      },
    ],
  };
}

/*
 * En developpement, Next recharge les modules a chaud : sans cette
 * accroche, un jeton emis disparaitrait avant d'etre resolu. Le magasin est
 * donc epingle sur globalThis, une seule fois par processus.
 */
const CLE_MAGASIN = "__carteproMagasin__";
type PorteeGlobale = typeof globalThis &
  Record<typeof CLE_MAGASIN, Magasin | undefined>;

const portee = globalThis as PorteeGlobale;

export const magasin: Magasin =
  portee[CLE_MAGASIN] ?? (portee[CLE_MAGASIN] = donneesInitiales());

export function trouverSalarie(id: string): SalarieMagasin | undefined {
  return magasin.salaries.find((salarie) => salarie.id === id);
}

export function trouverPartenaire(id: string): PartenaireMagasin | undefined {
  return magasin.partenaires.find((partenaire) => partenaire.id === id);
}

export function trouverJeton(token: string): JetonPaiement | undefined {
  return magasin.jetons.get(token);
}

export function jetonExiste(token: string): boolean {
  return magasin.jetons.has(token);
}

export function enregistrerJeton(jeton: JetonPaiement): JetonPaiement {
  magasin.jetons.set(jeton.token, jeton);
  return jeton;
}

/**
 * Consomme un jeton. Le jeton n'est pas modifie sur place : il est remplace
 * par une copie datee, pour qu'aucune reference deja distribuee ne change
 * d'etat dans le dos de son porteur.
 */
export function marquerJetonUtilise(
  token: string,
  utiliseLe: string,
): JetonPaiement | undefined {
  const jeton = magasin.jetons.get(token);
  if (!jeton) {
    return undefined;
  }
  const consomme: JetonPaiement = { ...jeton, usedAt: utiliseLe };
  magasin.jetons.set(token, consomme);
  return consomme;
}

export function jetonEstExpire(jeton: JetonPaiement, maintenant: number): boolean {
  return Date.parse(jeton.expiresAt) <= maintenant;
}
