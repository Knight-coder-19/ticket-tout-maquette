/**
 * Magasin en memoire des donnees simulees.
 *
 * Il joue le role du backend : le solde y est *calcule* (jamais reconstruit
 * dans un composant), un code de paiement genere y vit jusqu'a expiration.
 * L'etat n'est pas persiste : il repart de la graine a chaque rechargement.
 */
import type { CodePaiement, Solde, Transaction } from "@/types/domaine";
import { env } from "@/lib/config/env";
import { transactionsDemo } from "./fixtures/transactions";
import { CREDIT_PERIODE_CENTIMES } from "./fixtures/salaries";

type Etat = {
  transactions: Transaction[];
  code: CodePaiement | null;
};

function graine(): Etat {
  return {
    transactions: [...transactionsDemo],
    code: null,
  };
}

const etat: Etat = graine();

function soldeCentimes(): number {
  const depense = etat.transactions
    .filter((t) => t.statut === "validee")
    .reduce((somme, t) => somme + t.montant, 0);
  return CREDIT_PERIODE_CENTIMES - depense;
}

function jetonAleatoire(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let brut = "";
  for (let i = 0; i < 12; i++) {
    brut += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${brut.slice(0, 4)}-${brut.slice(4, 8)}-${brut.slice(8, 12)}`;
}

export const magasin = {
  lireSolde(): Solde {
    return { montant: soldeCentimes(), misAJourLe: new Date().toISOString() };
  },

  lireTransactions(page: number, taille: number) {
    const debut = (page - 1) * taille;
    return {
      elements: etat.transactions.slice(debut, debut + taille),
      page,
      taillePage: taille,
      total: etat.transactions.length,
    };
  },

  toutesTransactions(): Transaction[] {
    return etat.transactions;
  },

  /** Genere un code a usage unique. TTL borne par la contrainte T. Vignal. */
  genererCode(): CodePaiement {
    const ttl = Math.min(env.qrTtlSecondes, 300);
    const code: CodePaiement = {
      valeur: jetonAleatoire(),
      expireLe: new Date(Date.now() + ttl * 1000).toISOString(),
    };
    etat.code = code;
    return code;
  },

  codeCourant(): CodePaiement | null {
    return etat.code;
  },
};
