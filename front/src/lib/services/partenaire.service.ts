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
import {
  depuisJourneeRecettes,
  depuisMonCompte,
  depuisResumeActivite,
} from "@/lib/api/adaptateurs";
import type {
  DailyRevenueList,
  PartnerAccountStatus,
  PartnerSummary,
} from "@/types/api";
import type { MonCompte } from "@/types/domaine";
import type { JourneeRecettes, ResumeActivite } from "@/types/encaissement";

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

/* ═══════════════════════════════════════════════════════════════════════════
 * TABLEAU DE BORD
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Le résumé d'activité sur une période.
 *
 * ✅ Route du CONTRAT, `GET /api/v1/partner/summary`
 * (`data-dictionary.md:418-425`).
 *
 * Les bornes sont des instants ISO 8601, incluses. Sans elles, la route rend le
 * mois courant.
 */
export async function lireResume(
  depuis?: string,
  jusqua?: string,
): Promise<ResumeActivite> {
  const parametres = new URLSearchParams();
  if (depuis !== undefined && depuis !== "") parametres.set("from", depuis);
  if (jusqua !== undefined && jusqua !== "") parametres.set("to", jusqua);
  const requete = parametres.toString();

  const brut = await appelApi<PartnerSummary>(
    `/v1/partner/summary${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );
  return depuisResumeActivite(brut);
}

/**
 * La série journalière des recettes, du plus ancien au plus récent.
 *
 * ⚠ S'appuie sur une route que NOUS proposons : le contrat n'a aucune série
 * journalière. Voir `types/api.ts`, type `DailyRevenueItem`.
 *
 * Les jours sans recette sont présents, à zéro — c'est au graphique de montrer
 * les creux, pas à la donnée de les cacher.
 */
export async function lireRecettesJournalieres(
  jours = 14,
  jusqua?: string,
): Promise<JourneeRecettes[]> {
  const parametres = new URLSearchParams({ days: String(jours) });
  if (jusqua !== undefined && jusqua !== "") parametres.set("to", jusqua);

  const brut = await appelApi<DailyRevenueList>(
    `/v1/partner/daily-revenue?${parametres.toString()}`,
    { cache: "no-store" },
  );
  return brut.days.map(depuisJourneeRecettes);
}
