/**
 * La file d'attente hors ligne.
 *
 * Non branchee. Le back est pret -- `POST /api/v1/partner/payments/batch`
 * accepte un lot avec un statut par ligne, « une ligne en echec ne fait jamais
 * tomber le lot » (`data-dictionary.md:453-462`) -- mais la file locale qui
 * l'alimente reste a ecrire, et c'est un travail front a part entiere :
 * stockage local, reprise, ordre d'envoi, delai de resynchronisation
 * (`RESYNC_MAX_AGE_HOURS`).
 */
export function FileAttente() {
  return null;
}
