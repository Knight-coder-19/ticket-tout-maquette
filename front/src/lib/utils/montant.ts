import type { MontantCentimes } from "@/types/domaine";

/**
 * Formatage des montants.
 * Un montant ne s'affiche jamais sans passer par ici : c'est ce qui
 * garantit que la mention de simulation accompagne systematiquement
 * la valeur (F. Pontaillac).
 */
export function formaterMontant(centimes: MontantCentimes): string {
  throw new Error("Non implemente");
}

/**
 * Formulation positive du solde (demande du Ministre).
 * Exemple attendu : "32,50 EUR a depenser chez vos partenaires".
 */
export function formulerSolde(centimes: MontantCentimes): string {
  throw new Error("Non implemente");
}
