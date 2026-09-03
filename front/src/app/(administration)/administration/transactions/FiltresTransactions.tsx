"use client";

import { FiltrePeriode, type Periode } from "@/components/filtres/FiltrePeriode";
import type { CategorieCatalogue, VilleCatalogue } from "@/types/domaine";

/**
 * Les quatre filtres de la vue nationale : période, partenaire, ville,
 * catégorie.
 *
 * ─── La période vient du composant partagé ───
 *
 * `FiltrePeriode` a été écrit pour le journal du commerçant et a remonté dans
 * `components/filtres/` le jour où cet écran en a eu besoin. Il n'est pas
 * recopié : les deux écrans proposent exactement les mêmes raccourcis, et le
 * jour où l'on en ajoutera un, il apparaîtra des deux côtés.
 *
 * ─── Villes et catégories viennent des DONNÉES ───
 *
 * Aucune des deux listes n'est écrite ici (B. Sellami). Les villes viennent de
 * `GET /v1/cities`, route du contrat (:483) ; les catégories de
 * `GET /v1/categories`, que nous proposons faute de référentiel. Renommer une
 * catégorie ne doit toucher aucune ligne d'interface.
 *
 * ─── « Commerces en ligne » est une VILLE du menu, et c'est leur modèle ───
 *
 * Le tableau de bord du contrat traite les partenaires sans ville dans un bloc
 * `online_partners` distinct de `by_city`, parce qu'ils « n'appartiennent à
 * aucune ville » (:568-573). Le menu reprend cette structure : les villes,
 * puis une entrée pour ceux qui n'en ont pas. Sans elle, leur activité
 * deviendrait inatteignable dès qu'un filtre de ville serait posé.
 *
 * ⚠ C'est l'inverse du catalogue, où un commerce en ligne remonte sur toute
 * ville (A1). Là-bas la question est « qui peut me servir ici » ; ici elle est
 * « où l'activité a eu lieu ». Voir l'en-tête de la route.
 *
 * ─── Le partenaire se saisit, il ne se choisit pas ───
 *
 * Un menu déroulant de tous les partenaires agréés du pays serait
 * inutilisable, et le charger entier pour filtrer une ligne serait un
 * gaspillage. Le champ prend un identifiant, et l'écran dit lequel il a
 * retenu — le tableau porte les identifiants, on les recopie.
 */

export interface FiltresNationaux {
  periode: Periode;
  partenaireId: string;
  villeId: string;
  categorie: string;
}

/** La valeur de ville qui désigne les commerces sans ville. */
export const SANS_VILLE = "en-ligne";

export function FiltresTransactions({
  filtres,
  villes,
  categories,
  onChanger,
}: {
  filtres: FiltresNationaux;
  /** Référentiel des villes, venu de la route. Jamais une liste écrite ici. */
  villes: VilleCatalogue[];
  categories: CategorieCatalogue[];
  onChanger: (filtres: FiltresNationaux) => void;
}) {
  const poser = <C extends keyof FiltresNationaux>(
    champ: C,
    valeur: FiltresNationaux[C],
  ): void => onChanger({ ...filtres, [champ]: valeur });

  return (
    <>
      <FiltrePeriode
        periode={filtres.periode}
        onChanger={(periode) => poser("periode", periode)}
        sansFiltre="toutes les périodes sont affichées."
      />

      <div className="filtres">
        <div className="filtres__champ">
          <label htmlFor="filtre-partenaire">Partenaire</label>
          <input
            id="filtre-partenaire"
            type="search"
            value={filtres.partenaireId}
            placeholder="PRT-001"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="filtre-partenaire-aide"
            onChange={(e) => poser("partenaireId", e.target.value)}
          />
          <span className="filtres__aide" id="filtre-partenaire-aide">
            Identifiant, tel qu&apos;il figure dans la colonne « Partenaire ».
          </span>
        </div>

        <div className="filtres__champ">
          <label htmlFor="filtre-ville">Ville</label>
          <select
            id="filtre-ville"
            value={filtres.villeId}
            onChange={(e) => poser("villeId", e.target.value)}
          >
            <option value="">Toutes les villes</option>
            {villes.map((ville) => (
              <option key={ville.id} value={ville.id}>
                {ville.nom} ({ville.departement})
              </option>
            ))}
            {/* Le bloc `online_partners` du tableau de bord, atteignable. */}
            <option value={SANS_VILLE}>Commerces en ligne (sans ville)</option>
          </select>
        </div>

        <div className="filtres__champ">
          <label htmlFor="filtre-categorie">Catégorie</label>
          <select
            id="filtre-categorie"
            value={filtres.categorie}
            onChange={(e) => poser("categorie", e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((categorie) => (
              <option key={categorie.nom} value={categorie.nom}>
                {categorie.nom} ({categorie.nombreDePartenaires})
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
