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
  depuisCategorieCatalogue,
  depuisFicheCatalogue,
  depuisJourneeRecettes,
  depuisLigneEncaissement,
  depuisMonCompte,
  depuisResumeActivite,
  depuisVilleCatalogue,
} from "@/lib/api/adaptateurs";
import type {
  CatalogList,
  CategoryList,
  CityList,
  DailyRevenueList,
  PartnerAccountStatus,
  PartnerTransactionList,
  PartnerSummary,
} from "@/types/api";
import type {
  CategorieCatalogue,
  FicheCatalogue,
  MonCompte,
  VilleCatalogue,
} from "@/types/domaine";
import type {
  JourneeRecettes,
  LigneEncaissement,
  ResumeActivite,
} from "@/types/encaissement";

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

/* ═══════════════════════════════════════════════════════════════════════════
 * JOURNAL DES ENCAISSEMENTS
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FiltresEncaissements {
  /** Date ISO 8601 incluse, comparée au moment du geste. */
  depuis?: string;
  jusqua?: string;
}

export interface PageEncaissements {
  lignes: LigneEncaissement[];
  /** `null` = on tient tout le journal. */
  curseurSuivant: string | null;
}

/**
 * Les encaissements du commerçant, le plus récent d'abord.
 *
 * ✅ Route du CONTRAT, `GET /api/v1/partner/transactions`
 * (`data-dictionary.md:427-435`).
 */
export async function listerEncaissements(
  filtres: FiltresEncaissements = {},
  curseur?: string,
): Promise<PageEncaissements> {
  const parametres = new URLSearchParams();
  if (filtres.depuis !== undefined && filtres.depuis !== "") parametres.set("from", filtres.depuis);
  if (filtres.jusqua !== undefined && filtres.jusqua !== "") parametres.set("to", filtres.jusqua);
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<PartnerTransactionList>(
    `/v1/partner/transactions${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );

  return {
    lignes: brut.items.map(depuisLigneEncaissement),
    curseurSuivant: brut.next_cursor,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CATALOGUE DU RÉSEAU
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FiltresCatalogue {
  /** Nom de ville. ⚠ Un commerce en ligne remonte quand même (A1). */
  ville?: string;
  /** `physical`, `online` ou `both`. */
  modeService?: string;
  /** Recherche libre sur l'enseigne et la ville. */
  recherche?: string;
  /** ⚠ NOTRE AJOUT : le contrat ne filtre pas par catégorie. */
  categorie?: string;
}

export interface PageCatalogue {
  fiches: FicheCatalogue[];
  curseurSuivant: string | null;
}

/**
 * Le réseau des partenaires agréés.
 *
 * ✅ Route du CONTRAT, `GET /api/v1/catalog`
 * (`data-dictionary.md:469-481`). Elle ne sert QUE des agréés
 * (`catalog.rs:1`) : le catalogue n'est pas une liste de tous les dossiers.
 */
export async function listerCatalogue(
  filtres: FiltresCatalogue = {},
  curseur?: string,
): Promise<PageCatalogue> {
  const parametres = new URLSearchParams();
  if (filtres.ville !== undefined && filtres.ville !== "") parametres.set("city", filtres.ville);
  if (filtres.modeService !== undefined && filtres.modeService !== "") parametres.set("service_mode", filtres.modeService);
  if (filtres.recherche !== undefined && filtres.recherche.trim() !== "") parametres.set("q", filtres.recherche.trim());
  if (filtres.categorie !== undefined && filtres.categorie !== "") parametres.set("category", filtres.categorie);
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<CatalogList>(
    `/v1/catalog${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );

  return {
    fiches: brut.items.map(depuisFicheCatalogue),
    curseurSuivant: brut.next_cursor,
  };
}

/**
 * Le référentiel des villes.
 *
 * ✅ Route du CONTRAT, `GET /api/v1/cities` (:483-484).
 */
export async function listerVilles(): Promise<VilleCatalogue[]> {
  const brut = await appelApi<CityList>("/v1/cities", { cache: "no-store" });
  return brut.map(depuisVilleCatalogue);
}

/**
 * Le référentiel des catégories.
 *
 * ⚠ S'appuie sur une route que NOUS proposons : le contrat n'a pas
 * d'équivalent de `/cities` pour les catégories, et le schéma n'a pas de table.
 * Voir `types/api.ts`, type `CategoryItem`.
 *
 * C'est elle qui permet à la règle de B. Sellami de tenir : les catégories du
 * filtre viennent des données, complètes, et ne changent pas quand on pagine.
 */
export async function listerCategories(): Promise<CategorieCatalogue[]> {
  const brut = await appelApi<CategoryList>("/v1/categories", { cache: "no-store" });
  return brut.map(depuisCategorieCatalogue);
}
