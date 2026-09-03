"use client";

import type { CategorieCatalogue, VilleCatalogue } from "@/types/domaine";

/**
 * La barre de recherche et de filtres du catalogue.
 *
 * Réutilise `.filtres*` de `primitives.css`, partagé avec les deux registres de
 * l'administration et le journal du commerçant. Rien n'est recopié.
 *
 * ─── LES CATÉGORIES ET LES VILLES VIENNENT DES DONNÉES ───
 *
 * Aucune n'est écrite dans ce fichier. Les deux listes arrivent en propriétés,
 * chargées depuis `GET /api/v1/cities` et `GET /api/v1/categories`. Ajouter,
 * renommer ou retirer une catégorie ne touche donc aucune ligne d'interface
 * (B. Sellami).
 *
 * Le compte de partenaires est affiché à côté de chaque catégorie : « culture
 * (3) ». Il vient des données lui aussi, et il évite à l'utilisateur de choisir
 * un filtre qui ne rendrait qu'une seule fiche.
 *
 * ─── Le mode de service, lui, est une énumération fermée ───
 *
 * `ServiceMode` a trois valeurs fixées par le contrat
 * (`data-dictionary.md:67`), et « toute nouvelle valeur est un changement
 * cassant » (:51). Les traduire ici est le travail de l'interface, pas une
 * liste de données déguisée.
 */

export interface FiltresEcran {
  recherche: string;
  categorie: string;
  ville: string;
  modeService: string;
}

const MODES = [
  { valeur: "", libelle: "Tous les modes" },
  { valeur: "physical", libelle: "Sur place" },
  { valeur: "online", libelle: "En ligne" },
  { valeur: "both", libelle: "Sur place et en ligne" },
] as const;

export function RechercheCatalogue({
  filtres,
  categories,
  villes,
  onChanger,
}: {
  filtres: FiltresEcran;
  categories: CategorieCatalogue[];
  villes: VilleCatalogue[];
  onChanger: (filtres: FiltresEcran) => void;
}) {
  const actifs = [
    filtres.recherche.trim() !== "" ? `recherche « ${filtres.recherche.trim()} »` : null,
    filtres.categorie !== "" ? `catégorie « ${filtres.categorie} »` : null,
    filtres.ville !== "" ? `ville « ${filtres.ville} »` : null,
    filtres.modeService !== ""
      ? (MODES.find((m) => m.valeur === filtres.modeService)?.libelle ?? filtres.modeService)
      : null,
  ].filter((f): f is string => f !== null);

  return (
    <div className="filtres">
      <div className="filtres__champ">
        <label htmlFor="catalogue-recherche">Rechercher</label>
        <input
          id="catalogue-recherche"
          type="search"
          value={filtres.recherche}
          onChange={(e) => onChanger({ ...filtres, recherche: e.target.value })}
          placeholder="Nom d'établissement ou ville"
          autoComplete="off"
        />
      </div>

      <div className="filtres__champ">
        <label htmlFor="catalogue-categorie">Catégorie</label>
        <select
          id="catalogue-categorie"
          value={filtres.categorie}
          onChange={(e) => onChanger({ ...filtres, categorie: e.target.value })}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((categorie) => (
            <option key={categorie.nom} value={categorie.nom}>
              {categorie.nom} ({categorie.nombreDePartenaires})
            </option>
          ))}
        </select>
      </div>

      <div className="filtres__champ">
        <label htmlFor="catalogue-ville">Ville</label>
        <select
          id="catalogue-ville"
          value={filtres.ville}
          onChange={(e) => onChanger({ ...filtres, ville: e.target.value })}
        >
          <option value="">Toutes les villes</option>
          {villes.map((ville) => (
            <option key={ville.id} value={ville.nom}>
              {ville.nom} ({ville.departement})
            </option>
          ))}
        </select>
      </div>

      <div className="filtres__champ">
        <label htmlFor="catalogue-mode">Mode</label>
        <select
          id="catalogue-mode"
          value={filtres.modeService}
          onChange={(e) => onChanger({ ...filtres, modeService: e.target.value })}
        >
          {MODES.map((mode) => (
            <option key={mode.valeur} value={mode.valeur}>
              {mode.libelle}
            </option>
          ))}
        </select>
      </div>

      <p className="filtres__etat" role="status">
        {actifs.length === 0 ? (
          <>Aucun filtre : tout le réseau est affiché.</>
        ) : (
          <>
            Filtré sur <span className="filtres__actif">{actifs.join(", ")}</span>.{" "}
            <button
              type="button"
              className="bouton bouton--discret"
              onClick={() =>
                onChanger({ recherche: "", categorie: "", ville: "", modeService: "" })
              }
            >
              Tout afficher
            </button>
          </>
        )}
      </p>

      {/*
        L'exception A1, dite à l'écran.

        « An online partner comes back whatever the city filter says »
        (`catalog.rs:2`). Sans cette phrase, un commerçant qui filtre sur sa
        ville et voit remonter un commerce en ligne croirait à un défaut.
      */}
      {filtres.ville !== "" && (
        <p className="filtres__etat catalogue__note">
          Les commerces en ligne restent affichés quelle que soit la ville : ils
          servent tout le territoire.
        </p>
      )}
    </div>
  );
}
