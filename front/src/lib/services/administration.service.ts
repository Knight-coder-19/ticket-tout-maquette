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
import {
  depuisComptePartenaire,
  depuisDecisionJournal,
  depuisDemandeAdhesion,
  depuisEcritureRegistre,
  depuisVerification,
} from "@/lib/api/adaptateurs";
import type {
  ChainVerification,
  JournalList,
  LedgerEntryList,
  Paginated,
  PartnerAccountList,
  PartnerReviewItem,
} from "@/types/api";
import type {
  ComptePartenaire,
  DecisionJournal,
  DemandeAdhesion,
  EcritureRegistre,
  VerificationIntegrite,
} from "@/types/domaine";

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

/* ═══════════════════════════════════════════════════════════════════════════
 * REGISTRE DES COMPTES PARTENAIRES
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FiltresComptes {
  /** Statut du back (`pending`, `approved`, …) ou `undefined` pour tous. */
  statut?: string;
  categorie?: string;
  ville?: string;
  /** Recherche libre : enseigne, raison sociale, ville. */
  recherche?: string;
}

export interface PageComptes {
  comptes: ComptePartenaire[];
  curseurSuivant: string | null;
}

/**
 * Le registre des comptes, filtré, trié par enseigne.
 *
 * ⚠ S'appuie sur une route que NOUS proposons, `GET /admin/partner-accounts` :
 * le contrat n'expose ni filtre de catégorie, ni recherche, ni volume
 * d'activité. Voir `types/api.ts`, type `PartnerAccountItem`.
 */
export async function listerComptes(
  filtres: FiltresComptes = {},
  curseur?: string,
): Promise<PageComptes> {
  const parametres = new URLSearchParams();
  if (filtres.statut !== undefined && filtres.statut !== "") parametres.set("status", filtres.statut);
  if (filtres.categorie !== undefined && filtres.categorie !== "") parametres.set("category", filtres.categorie);
  if (filtres.ville !== undefined && filtres.ville !== "") parametres.set("city", filtres.ville);
  if (filtres.recherche !== undefined && filtres.recherche.trim() !== "") parametres.set("q", filtres.recherche.trim());
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<PartnerAccountList>(
    `/v1/admin/partner-accounts${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );

  return {
    comptes: brut.items.map(depuisComptePartenaire),
    curseurSuivant: brut.next_cursor,
  };
}

/** Suspend un compte agréé. Motif obligatoire, refusé en `422` sans lui. */
export async function suspendreCompte(compteId: string, motif: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/partners/${encodeURIComponent(compteId)}/suspend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: motif }),
  });
}

/**
 * Réactive un compte suspendu.
 *
 * Pas de motif : la route n'en demande pas pour une décision favorable, comme
 * `approve` qui répond `204` sans corps (`data-dictionary.md:507`).
 */
export async function reactiverCompte(compteId: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/partners/${encodeURIComponent(compteId)}/reinstate`, {
    method: "POST",
  });
}

/**
 * Ferme un compte, définitivement. Motif obligatoire.
 *
 * ⚠ Sans retour au-delà du délai de grâce : voir l'en-tête de
 * `app/api/v1/admin/partners/[id]/close/route.ts`. L'écran doit l'annoncer
 * avant la confirmation.
 */
export async function fermerCompte(compteId: string, motif: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/partners/${encodeURIComponent(compteId)}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: motif }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REGISTRE COMPTABLE
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FiltresRegistre {
  /** Date ISO 8601 incluse, comparée à la date du fait. */
  depuis?: string;
  jusqua?: string;
  partenaireId?: string;
  /** Nature côté back : `topup`, `payment`, `compensation`, `closure_forfeit`. */
  nature?: string;
}

export interface PageRegistre {
  ecritures: EcritureRegistre[];
  curseurSuivant: string | null;
}

/**
 * Les écritures du registre, la plus récente en premier.
 *
 * ⚠ S'appuie sur une route que NOUS proposons : le contrat n'expose aucune
 * lecture du journal. Voir `types/api.ts`, type `LedgerEntryItem`.
 */
export async function listerEcritures(
  filtres: FiltresRegistre = {},
  curseur?: string,
): Promise<PageRegistre> {
  const parametres = new URLSearchParams();
  if (filtres.depuis !== undefined && filtres.depuis !== "") parametres.set("from", filtres.depuis);
  if (filtres.jusqua !== undefined && filtres.jusqua !== "") parametres.set("to", filtres.jusqua);
  if (filtres.partenaireId !== undefined && filtres.partenaireId !== "") parametres.set("partner", filtres.partenaireId);
  if (filtres.nature !== undefined && filtres.nature !== "") parametres.set("kind", filtres.nature);
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<LedgerEntryList>(
    `/v1/admin/ledger-entries${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );

  return {
    ecritures: brut.items.map(depuisEcritureRegistre),
    curseurSuivant: brut.next_cursor,
  };
}

/**
 * Rejoue la vérification d'intégrité de la chaîne.
 *
 * ✅ Route du CONTRAT, `GET /api/v1/admin/audit/verify`
 * (`data-dictionary.md:575-580`).
 *
 * L'heure du contrôle est posée ICI, à la réception : la route ne rend pas
 * d'horodatage, et un résultat d'intégrité sans heure ne prouve rien — il
 * pourrait dater d'hier.
 */
export async function verifierIntegrite(): Promise<VerificationIntegrite> {
  const brut = await appelApi<ChainVerification>("/v1/admin/audit/verify", {
    cache: "no-store",
  });
  return depuisVerification(brut, Date.now());
}

/**
 * Annule une opération : écrit une écriture inverse, n'en supprime aucune.
 *
 * ✅ Route du CONTRAT, `POST /api/v1/admin/compensations`, corps
 * `CompensationRequest { original_operation_id, reason }` (:558-559).
 *
 * Le motif est obligatoire et refusé côté serveur en `422` — le contrôle de
 * l'écran n'est que de l'aide à la saisie.
 */
export async function annulerOperation(operationId: string, motif: string): Promise<void> {
  await appelApi<unknown>("/v1/admin/compensations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ original_operation_id: operationId, reason: motif }),
  });
}
