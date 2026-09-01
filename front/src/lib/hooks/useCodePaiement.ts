"use client";

/**
 * Cycle de vie du code de paiement : generation, compte a rebours,
 * expiration, regeneration.
 *
 * La regeneration en un geste est la reponse a la demande du Ministre
 * (ne pas bloquer le salarie en caisse) sans allonger la duree de validite
 * au-dela des 5 minutes imposees par T. Vignal.
 */
export function useCodePaiement(salarieId: string) {
  throw new Error("Non implemente");
}
