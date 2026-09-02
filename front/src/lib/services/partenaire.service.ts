/**
 * Le service de l'espace partenaire.
 *
 * Il ne connaît ni `fetch`, ni l'URL du backend, ni la forme des erreurs : il
 * décrit des appels et convertit ce qui en revient vers le domaine.
 *
 * ─── Ce fichier remplace l'interface `ServicePartenaire` ───
 *
 * L'interface qui vivait ici décrivait `listerPartenaires(page: number)` rendant
 * une `ReponsePaginee` — une pagination par OFFSET, que le back ne sait pas
 * produire (divergence D10) — et un `encaisser` qui prenait un montant à la
 * caisse, ce que le modèle du back ne fait pas (divergence D4). Aucune
 * implémentation ne pouvait la satisfaire.
 *
 * L'encaissement réel vit dans `encaissement.service.ts`, déjà branché.
 */

import { appelApi } from "@/lib/api/client";
import { depuisMonCompte } from "@/lib/api/adaptateurs";
import type { PartnerAccountStatus } from "@/types/api";
import type { MonCompte } from "@/types/domaine";

/**
 * L'état de mon compte : statut, motif de la dernière décision, contact.
 *
 * ⚠ S'appuie sur une route que NOUS proposons, `GET /api/v1/partner/account` :
 * le contrat n'expose rien qui dise à un partenaire l'état de son compte. Voir
 * `types/api.ts`, type `PartnerAccountStatus`.
 */
export async function lireMonCompte(): Promise<MonCompte> {
  const brut = await appelApi<PartnerAccountStatus>("/v1/partner/account", {
    cache: "no-store",
  });
  return depuisMonCompte(brut);
}
