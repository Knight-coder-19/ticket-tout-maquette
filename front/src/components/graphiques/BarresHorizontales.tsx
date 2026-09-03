"use client";

import { useId, useState } from "react";
import { formaterCentimes } from "@/lib/montant";
import type { LigneRepartition } from "@/types/domaine";

/**
 * Une répartition en barres horizontales — un montant par catégorie
 * (ville, catégorie de commerce…), classées.
 *
 * ─── Pourquoi horizontal, et pas vertical comme les quatorze jours ───
 *
 * Les libellés sont du texte, pas des dates courtes : « Marseille »,
 * « restauration ». Une barre verticale les empilerait sous l'axe, pivotés ou
 * tronqués ; à l'horizontale, chaque nom se lit posé, dans sa langue.
 *
 * ─── Une seule échelle, un vrai DOM plutôt qu'un SVG ───
 *
 * Chaque ligne montre son libellé et sa valeur en TEXTE réel — pas un
 * `<title>` qu'il faut survoler pour lire. La barre elle-même n'est qu'un
 * `<div>` dont la largeur est une fraction du maximum : pas de collision
 * d'étiquettes à calculer, puisqu'il n'y a pas d'étiquette à placer dans le
 * dessin. C'est l'inverse du choix de `GraphiqueQuatorzeJours`, et c'est la
 * bonne complexité pour la bonne forme de donnée — quatorze colonnes serrées
 * réclament un SVG, une poignée de lignes larges n'en a pas besoin.
 *
 * ─── La seule teinte, celle du reste des graphiques du projet ───
 *
 * `--couleur-primaire`, comme les quatorze jours : pas un bouton, la charte ne
 * s'y applique pas ; c'est la teinte d'identité du dispositif, et une série
 * unique n'a besoin que d'elle.
 */
export function BarresHorizontales({
  titre,
  sousTitre,
  lignes,
  ligneAPart,
}: {
  titre: string;
  sousTitre?: string;
  lignes: LigneRepartition[];
  /**
   * Une ligne montrée séparément, sous les autres — jamais fondue dans le
   * classement. Sert les commerces en ligne (amendement A1) : ils
   * n'appartiennent à aucune ville, et les mélanger aux villes classées
   * suggérerait qu'ils en sont une.
   */
  ligneAPart?: LigneRepartition;
}) {
  const [tableauVisible, setTableauVisible] = useState(false);
  const identifiant = useId();

  const toutes = ligneAPart ? [...lignes, ligneAPart] : lignes;
  const maximum = Math.max(1, ...toutes.map((l) => l.volume));

  const ligne = (l: LigneRepartition, aPart: boolean) => (
    <li
      key={l.libelle}
      className={aPart ? "repartition__ligne repartition__ligne--a-part" : "repartition__ligne"}
    >
      <span className="repartition__libelle">{l.libelle}</span>
      <span className="repartition__piste">
        <span
          className="repartition__barre"
          style={{ inlineSize: `${(l.volume / maximum) * 100}%` }}
        />
      </span>
      <span className="repartition__valeur">{formaterCentimes(l.volume)}</span>
    </li>
  );

  return (
    <section className="carte" aria-labelledby={`${identifiant}-titre`}>
      <h2 className="carte__titre" id={`${identifiant}-titre`}>
        {titre}
      </h2>
      {sousTitre !== undefined && <p className="carte__sous-titre">{sousTitre}</p>}

      {lignes.length === 0 && ligneAPart === undefined ? (
        <p className="repartition__vide">Aucune donnée sur la période choisie.</p>
      ) : (
        <ol className="repartition">
          {lignes.map((l) => ligne(l, false))}
          {ligneAPart !== undefined && ligne(ligneAPart, true)}
        </ol>
      )}

      <button
        type="button"
        className="bouton bouton--discret"
        aria-expanded={tableauVisible}
        aria-controls={`${identifiant}-tableau`}
        onClick={() => setTableauVisible((v) => !v)}
      >
        {tableauVisible ? "Masquer le tableau" : "Afficher les chiffres en tableau"}
      </button>

      <div id={`${identifiant}-tableau`} hidden={!tableauVisible}>
        <div className="tableau-defilant" tabIndex={0} role="region" aria-label={titre}>
          <table className="registre">
            <caption>{titre}, chaque ligne avec son nombre de transactions.</caption>
            <thead>
              <tr>
                <th scope="col">Répartition</th>
                <th scope="col">Volume</th>
                <th scope="col">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {toutes.map((l) => (
                <tr key={l.libelle}>
                  <th scope="row">{l.libelle}</th>
                  <td className="registre__nombre">{formaterCentimes(l.volume)}</td>
                  <td className="registre__nombre">{l.nombreTransactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
