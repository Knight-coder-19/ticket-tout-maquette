/**
 * Le service de l'espace d'administration.
 *
 * Il ne connaît ni `fetch`, ni l'URL du backend, ni la forme des erreurs : il
 * décrit des appels et convertit ce qui en revient vers le domaine. Le
 * transport est dans `lib/api/client.ts`, les conversions dans
 * `lib/api/adaptateurs.ts`.
 *
 * ─── Ce fichier remplace l'interface `ServiceAdministration` ───
 *
 * L'interface qui vivait ici décrivait `listerDemandes(page: number)` rendant
 * une `ReponsePaginee` — une pagination par OFFSET. Le back pagine par KEYSET
 * et ne compte pas les lignes : il ne peut pas produire `total`
 * (`extractors/pagination.rs:1-3`, divergence D10 de
 * `front/docs/contrat-api.md`). Aucune implémentation ne pouvait satisfaire
 * cette interface, et son type de retour `DemandePartenaire` ne porte ni
 * catégorie, ni ville, ni date de dépôt — les trois choses que l'écran de
 * validation affiche.
 *
 * Elle est donc remplacée plutôt que laissée à côté. Si l'équipe veut la
 * conserver, c'est l'enveloppe de pagination qu'il faut trancher d'abord.
 */

import { appelApi, appelApiSansContenu } from "@/lib/api/client";
import { depuisDecisionJournal, depuisDemandeAdhesion } from "@/lib/api/adaptateurs";
import type { JournalList, Paginated, PartnerReviewItem } from "@/types/api";
import type { DecisionJournal, DemandeAdhesion } from "@/types/domaine";

/** Une page de la file de validation, dans le vocabulaire du domaine. */
export interface PageDemandes {
  demandes: DemandeAdhesion[];
  /** Curseur opaque pour la page suivante. `null` = fin de liste. */
  curseurSuivant: string | null;
}

/**
 * Les demandes d'adhésion en attente, la plus ancienne en premier.
 *
 * L'ordre vient du serveur, pas d'un tri local : c'est lui qui pagine, et
 * trier après coup ne trierait que la page reçue.
 */
export async function listerDemandesEnAttente(
  curseur?: string,
): Promise<PageDemandes> {
  const parametres = new URLSearchParams({ status: "pending" });
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const brut = await appelApi<Paginated<PartnerReviewItem>>(
    `/v1/admin/partners?${parametres.toString()}`,
    { cache: "no-store" },
  );

  return {
    demandes: brut.items.map(depuisDemandeAdhesion),
    curseurSuivant: brut.next_cursor,
  };
}

/**
 * Accepte une demande. Ne rend rien : la route répond `204`
 * (`data-dictionary.md:507`).
 */
export async function accepterDemande(demandeId: string): Promise<void> {
  await appelApiSansContenu(
    `/v1/admin/partners/${encodeURIComponent(demandeId)}/approve`,
    { method: "POST" },
  );
}

/**
 * Refuse une demande, motif obligatoire.
 *
 * Le motif est vérifié ici AUSSI, avant l'appel — mais ce n'est pas ce qui
 * fait la règle. La route refuse un motif vide en `422` de son côté
 * (`admin/partners/[id]/reject/route.ts`), et c'est là qu'est la garantie :
 * un contrôle côté client se contourne, pas un contrôle côté serveur. Celui-ci
 * évite seulement un aller-retour inutile.
 */
export async function refuserDemande(demandeId: string, motif: string): Promise<void> {
  await appelApiSansContenu(
    `/v1/admin/partners/${encodeURIComponent(demandeId)}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: motif }),
    },
  );
}

/**
 * Le journal des décisions d'adhésion, du plus récent au plus ancien.
 *
 * ⚠ S'appuie sur une route que NOUS proposons : le back n'expose aucune
 * lecture d'`audit_log`. Voir `types/api.ts`, type `LigneJournal`.
 */
export async function lireJournalDecisions(): Promise<DecisionJournal[]> {
  const brut = await appelApi<JournalList>(
    "/v1/admin/audit?entity_type=partner",
    { cache: "no-store" },
  );
  return brut.items.map(depuisDecisionJournal);
}
