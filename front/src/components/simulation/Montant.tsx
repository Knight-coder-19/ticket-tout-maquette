import type { MontantCentimes } from "@/types/domaine";

/**
 * Seul composant autorise a afficher une valeur monetaire.
 *
 * Il porte la mention de simulation. Toute autre facon d'afficher un
 * montant contourne la contrainte juridique et doit etre refusee en revue.
 */
export function Montant({ centimes }: { centimes: MontantCentimes }) {
  throw new Error("Non implemente");
}
