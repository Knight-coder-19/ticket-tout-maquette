import type { MontantCentimes } from "@/types/domaine";

const format = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

/**
 * Formatage des montants.
 * Un montant ne s'affiche jamais sans passer par ici : c'est ce qui
 * garantit que la mention de simulation accompagne systematiquement
 * la valeur (F. Pontaillac). Voir le composant <Montant>.
 */
export function formaterMontant(centimes: MontantCentimes): string {
  return format.format(centimes / 100);
}

/**
 * Formulation positive du solde (demande du Ministre) :
 * pas "32,50 EUR restants" mais "32,50 EUR a depenser chez vos partenaires".
 */
export function formulerSolde(centimes: MontantCentimes): string {
  return `${formaterMontant(centimes)} à dépenser chez vos partenaires`;
}
