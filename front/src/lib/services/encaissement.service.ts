/**
 * Le service d'encaissement.
 *
 * Il ne connaît ni `fetch`, ni l'URL du backend, ni la forme des erreurs : il
 * décrit deux appels et convertit ce qui en revient vers le domaine. Le
 * transport est dans `lib/api/client.ts`, les conversions dans
 * `lib/api/adaptateurs.ts`.
 *
 * ─── Le modèle est celui du back ───
 *
 * Le salarié fixe le montant à l'émission, les fonds sont réservés, et le
 * partenaire CONFIRME. Aucune de ces deux fonctions ne prend un montant :
 * `SettleRequest` n'en porte pas (`data-dictionary.md:438-441`), et
 * `settle.rs:1` le lit du jeton.
 *
 * ─── Pas de clé d'idempotence ───
 *
 * Le back n'en attend aucune : ni `SettleRequest`, ni `settle.rs`, ni la table
 * `payments` (`0001_schema.sql:190-197`) n'en portent. Sa règle est ailleurs et
 * elle est plus forte — `payments.token_jti` est UNIQUE (invariant I6) : le
 * jeton EST la clé. Envoyer un champ que personne ne lit donnerait l'illusion
 * d'une protection qui vient en réalité d'ailleurs.
 *
 * `useCleIdempotence` reste dans `lib/api/` : il est juste et générique, il
 * servira à une route qui, elle, en attendra une.
 */

import { appelApi } from "@/lib/api/client";
import { depuisEncaissement, depuisJetonResolu } from "@/lib/api/adaptateurs";
import type { PaymentResponse, ResolvedTokenItem } from "@/types/api";
import type { EncaissementAccepte, JetonResolu } from "@/types/encaissement";

/**
 * Résout un jeton présenté au comptoir, SANS le consommer.
 *
 * La référence est un `jti` (scan) ou un code court (saisie manuelle) : la
 * route accepte les deux, comme `TokenRef` côté back
 * (`core/src/payments/mod.rs:1`).
 *
 * Lève si le code est inconnu, expiré ou déjà encaissé — c'est le serveur qui
 * tranche, pas l'écran.
 */
export async function resoudreJeton(reference: string): Promise<JetonResolu> {
  const brut = await appelApi<ResolvedTokenItem>(
    `/v1/partner/payment-tokens/${encodeURIComponent(reference)}`,
    { cache: "no-store" },
  );
  return depuisJetonResolu(brut);
}

export type DemandeReglement = {
  /** Renseigné si le jeton a été scanné. */
  jti: string | null;
  /** Renseigné si le code a été saisi à la main. Exactement un des deux. */
  codeCourt: string | null;
  /** Le bénéficiaire, repris du jeton résolu : le serveur ne le renvoie pas. */
  beneficiaire: string;
  /**
   * Vrai si le caissier renvoie un règlement dont il ne connaît pas l'issue.
   * Le serveur répond `200` à l'identique dans les deux cas ; seul l'appelant
   * sait qu'il rejoue.
   */
  rejeu: boolean;
};

/**
 * Écrit le règlement au registre.
 *
 * `scanned_at` est l'horodatage local du geste, INDICATIF : la seule expiration
 * qui fasse foi est celle que le serveur vérifie contre sa propre horloge
 * (décision 2, invariant I7). C'est le second étage de la défense — le premier
 * étant le compte à rebours de l'écran, qui bloque le bouton.
 */
export async function encaisser(
  demande: DemandeReglement,
): Promise<EncaissementAccepte> {
  const brut = await appelApi<PaymentResponse>("/v1/partner/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jti: demande.jti,
      short_code: demande.codeCourt,
      scanned_at: new Date().toISOString(),
    }),
  });

  return depuisEncaissement(brut, {
    beneficiaire: demande.beneficiaire,
    rejoue: demande.rejeu,
  });
}
