/**
 * Constantes issues du cahier des charges.
 * Chaque valeur porte la contrainte dont elle decoule.
 */

/** Duree de validite maximale d'un code de paiement (T. Vignal). */
export const QR_TTL_MAX_SECONDES = 300;

/** Mention affichee partout ou un montant apparait (F. Pontaillac). */
export const MENTION_SIMULATION = "Simulation - aucune valeur reelle";

/** Nombre d'elements par page dans le catalogue partenaires. */
export const TAILLE_PAGE_CATALOGUE = 20;

/** Roles applicatifs. */
export const ROLES = ["salarie", "partenaire", "administration"] as const;
export type Role = (typeof ROLES)[number];
