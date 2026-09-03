/**
 * Les recettes d'un partenaire, agregees depuis le REGISTRE.
 *
 * Rien n'est stocke ici : tout se recalcule depuis les ecritures. C'est ce que
 * fait `reporting/mod.rs:1-2` -- « Read-only, never an INSERT; aggregate on
 * occurred_at » -- et c'est ce qui garantit qu'un chiffre affiche au comptoir
 * et un chiffre du registre ne peuvent pas diverger : il n'y en a qu'un.
 *
 * L'agregation porte sur `occurredAt`, le moment du GESTE, jamais sur
 * `recordedAt`, le moment de l'enregistrement. Les deux different des qu'une
 * caisse resynchronise hors ligne, et le commercant reconnait sa journee, pas
 * celle du serveur.
 */

import { idCompte, registre, trouverOperation } from "@/mocks/registre";
import type { Identifiant, MontantCentimes } from "@/types/domaine";

/** Un reglement encaisse par un partenaire, vu du registre. */
export interface RecetteReglement {
  operationId: Identifiant;
  montantCentimes: MontantCentimes;
  /** Date ISO 8601 du geste. */
  survenueLe: string;
  modeSaisie: "qr_scan" | "short_code";
}

/**
 * Tous les reglements d'un partenaire, du plus recent au plus ancien.
 *
 * On ne garde que les CREDITS de nature `payment` sur son compte : un debit
 * serait une annulation, et une annulation n'est pas une recette.
 */
export function reglementsDe(partenaireId: string): RecetteReglement[] {
  const compte = idCompte(partenaireId);
  return registre.ecritures
    .filter((ecriture) => ecriture.accountId === compte && ecriture.direction === "credit")
    .map((ecriture) => ({ ecriture, operation: trouverOperation(ecriture.operationId) }))
    .filter(({ operation }) => operation?.kind === "payment")
    .map(({ ecriture, operation }) => ({
      operationId: ecriture.operationId,
      montantCentimes: ecriture.amountCentimes,
      survenueLe: operation?.occurredAt ?? ecriture.recordedAt,
      /* Le mode de saisie n'est pas porte par le journal -- il vit dans
         `payments` (`0001_schema.sql:195`). Faute de le lire ici, on ne
         l'invente pas : le tableau de bord ne l'affiche pas. */
      modeSaisie: "short_code" as const,
    }))
    .sort((a, b) => b.survenueLe.localeCompare(a.survenueLe));
}

/** La date d'un instant, en `YYYY-MM-DD` UTC. */
export function jourDe(iso: string): string {
  return iso.slice(0, 10);
}

export interface AgregatPeriode {
  totalCentimes: MontantCentimes;
  nombre: number;
}

/**
 * Le cumul et le compte sur une periode, bornes incluses.
 *
 * C'est ce que sert `GET /api/v1/partner/summary` : `total_received` et
 * `transaction_count` (`data-dictionary.md:419-421`).
 */
export function agregerSur(
  partenaireId: string,
  depuis: string,
  jusqua: string,
): AgregatPeriode {
  const dans = reglementsDe(partenaireId).filter(
    (r) => r.survenueLe >= depuis && r.survenueLe <= jusqua,
  );
  return {
    totalCentimes: dans.reduce((somme, r) => somme + r.montantCentimes, 0),
    nombre: dans.length,
  };
}

export interface JourneeRecette {
  /** `YYYY-MM-DD`. */
  jour: string;
  totalCentimes: MontantCentimes;
  nombre: number;
}

/**
 * La serie journaliere, sur `nombreDeJours` jours jusqu'a `finIso` inclus.
 *
 * ⚠ LES JOURS SANS RECETTE SONT PRESENTS, a zero. Un graphique qui saute les
 * journees vides ment sur le rythme : quatorze barres serrees laissent croire
 * a quatorze jours d'activite alors qu'il y en a eu six. La serie est donc
 * dense, une entree par jour, et c'est au graphique de montrer les creux.
 */
export function serieJournaliere(
  partenaireId: string,
  finIso: string,
  nombreDeJours: number,
): JourneeRecette[] {
  const reglements = reglementsDe(partenaireId);
  const parJour = new Map<string, JourneeRecette>();

  const fin = Date.parse(`${jourDe(finIso)}T00:00:00.000Z`);
  const JOUR = 24 * 60 * 60 * 1000;

  for (let i = nombreDeJours - 1; i >= 0; i -= 1) {
    const jour = new Date(fin - i * JOUR).toISOString().slice(0, 10);
    parJour.set(jour, { jour, totalCentimes: 0, nombre: 0 });
  }

  for (const reglement of reglements) {
    const entree = parJour.get(jourDe(reglement.survenueLe));
    if (entree === undefined) continue;
    entree.totalCentimes += reglement.montantCentimes;
    entree.nombre += 1;
  }

  return [...parJour.values()];
}
