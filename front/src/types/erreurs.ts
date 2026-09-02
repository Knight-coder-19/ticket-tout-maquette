/**
 * Les formes d'erreur que le front manipule.
 *
 * `ErreurEncaissement`, la seule qui soit levée aujourd'hui, vit dans
 * `types/encaissement.ts` avec le reste du vocabulaire de la caisse.
 */

/**
 * Forme d'erreur du front.
 *
 * Ne correspond ni à `ApiError` de `types/api.ts` — la forme plate du back,
 * `{ error, message, request_id }` — ni à `ErreurImbriquee`, celle que servent
 * les routes de simulation. C'est une troisième forme, celle que le front
 * aimerait manipuler une fois la frontière franchie.
 *
 * N'est importée nulle part à ce jour.
 */
export interface ErreurApi {
  code: string;
  message: string;
  details?: Record<string, string>;
}
