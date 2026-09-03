"use client";

import { useId, useState } from "react";
import { formaterCentimes } from "@/lib/montant";
import type { JourneeRecettes } from "@/types/encaissement";

/**
 * Les recettes des quatorze derniers jours.
 *
 * ─── Pourquoi des barres, et pas une courbe ───
 *
 * Ce sont des journées distinctes qu'on compare, pas un flux continu. Une
 * courbe relie les points et suggère que la valeur existe entre deux jours —
 * elle n'existe pas. Une caisse encaisse par journée fermée ; la comparaison de
 * magnitude appelle une barre.
 *
 * ─── UNE SEULE ÉCHELLE ───
 *
 * Le graphique ne montre QUE les recettes. Le nombre d'encaissements est une
 * tuile, jamais un second axe : deux échelles sur un même cadre rendent les
 * deux séries illisibles, chacune pouvant être étirée à volonté pour raconter
 * ce qu'on veut. C'est l'erreur la plus fréquente en visualisation, et elle est
 * ici structurellement impossible — il n'y a qu'un `max`.
 *
 * ─── Une série, donc aucune légende ───
 *
 * Le titre nomme ce qu'on voit. Une boîte à un seul carré répéterait le titre
 * et prendrait la place d'une barre.
 *
 * ─── Le texte porte l'encre, la barre porte l'identité ───
 *
 * Aucune étiquette, aucune graduation, aucun chiffre ne prend la couleur de la
 * série. Les valeurs sont en `--couleur-texte`, les graduations en
 * `--couleur-texte-secondaire`. La barre seule est bleue.
 */

/** Hauteur de la zone traçable, en unités du viewBox. */
const HAUTEUR_TRACE = 150;
/** Place réservée AU-DESSUS pour les étiquettes sélectives. */
const MARGE_HAUTE = 22;
/** Place réservée EN DESSOUS pour les dates. */
const MARGE_BASSE = 26;
/** Place réservée À GAUCHE pour les graduations. */
const MARGE_GAUCHE = 52;
const MARGE_DROITE = 8;

/** Largeur d'une colonne, gouttière comprise. */
const PAS = 26;
/** Épaisseur d'une barre. Fine : la colonne garde de l'air. */
const EPAISSEUR = 14;
/** Rayon de l'extrémité côté valeur. Le pied reste carré, sur la ligne. */
const RAYON = 4;
/** Hauteur d'une étiquette de valeur, pour la détection de chevauchement. */
const HAUTEUR_ETIQUETTE = 13;

/** L'ordonnée de la ligne de base. */
function baseYDe(): number {
  return MARGE_HAUTE + HAUTEUR_TRACE;
}

/**
 * Les graduations.
 *
 * ⚠ Chaque graduation nomme une valeur que le graphique ATTEINT réellement :
 * l'échelle monte exactement au maximum de la série, arrondi au palier
 * supérieur, et les paliers intermédiaires en sont des fractions. Une
 * graduation au-delà du sommet dessinerait un plafond que rien ne touche.
 */
function graduations(maximum: number): number[] {
  if (maximum <= 0) return [0];
  return [0, maximum / 2, maximum];
}

/** Un palier rond, au-dessus du maximum, pour que l'échelle ne colle pas. */
function plafond(maximum: number): number {
  if (maximum <= 0) return 100;
  const ordre = 10 ** Math.floor(Math.log10(maximum));
  return Math.ceil(maximum / (ordre / 2)) * (ordre / 2);
}

function jourCourt(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(Date.parse(`${iso}T12:00:00.000Z`));
}

function jourLong(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(`${iso}T12:00:00.000Z`));
}

/** Le texte de l'infobulle d'une journée, en une seule chaîne. */
function infobulle(journee: JourneeRecettes): string {
  const tete = `${jourLong(journee.jour)} — ${formaterCentimes(journee.total)}`;
  if (journee.nombre === 0) return `${tete}, aucun encaissement`;
  return `${tete} sur ${journee.nombre === 1 ? "1 encaissement" : `${journee.nombre} encaissements`}`;
}

export function GraphiqueQuatorzeJours({ serie }: { serie: JourneeRecettes[] }) {
  const [survolee, setSurvolee] = useState<number | null>(null);
  const [tableauVisible, setTableauVisible] = useState(false);
  const identifiant = useId();

  const maximum = Math.max(0, ...serie.map((j) => j.total));
  const echelle = plafond(maximum);

  const largeur = MARGE_GAUCHE + serie.length * PAS + MARGE_DROITE;
  const hauteur = MARGE_HAUTE + HAUTEUR_TRACE + MARGE_BASSE;
  const baseY = baseYDe();

  const hauteurDe = (total: number): number =>
    echelle === 0 ? 0 : (total / echelle) * HAUTEUR_TRACE;

  /*
   * Les étiquettes SÉLECTIVES : le maximum, le dernier jour, le minimum.
   *
   * Jamais un nombre au-dessus de chaque barre — quatorze valeurs empilées ne
   * se lisent pas. Les creux à zéro ne sont pas étiquetés : l'absence de barre
   * le dit déjà.
   *
   * ⚠ ET ELLES NE SE CHEVAUCHENT PAS. Trois candidates peuvent tomber sur des
   * jours voisins de hauteur proche — le dernier jour à côté du maximum, par
   * exemple. On mesure donc avant de poser : une candidate dont la boîte
   * croiserait celle d'une étiquette déjà retenue est abandonnée, et sa valeur
   * reste lisible dans l'infobulle et dans le tableau. Rien n'est gaté, rien
   * n'est tronqué.
   *
   * L'ordre de priorité porte du sens : le maximum est le repère de l'échelle,
   * le dernier jour est l'actualité, le minimum vient en dernier.
   */
  const avecRecette = serie.filter((j) => j.total > 0);
  const minimum =
    avecRecette.length > 0 ? Math.min(...avecRecette.map((j) => j.total)) : 0;

  const candidates = [
    serie.findIndex((j) => j.total === maximum && maximum > 0),
    serie.length - 1,
    avecRecette.length > 1 && minimum !== maximum
      ? serie.findIndex((j) => j.total === minimum)
      : -1,
  ].filter((i) => i >= 0 && (serie[i]?.total ?? 0) > 0);

  const etiquetes = new Set<number>();
  const posees: { x: number; y: number; demiLargeur: number }[] = [];
  for (const index of candidates) {
    if (etiquetes.has(index)) continue;
    const journee = serie[index];
    if (journee === undefined) continue;

    const x = MARGE_GAUCHE + index * PAS + PAS / 2;
    const y = baseYDe() - hauteurDe(journee.total) - 6;
    /* Largeur estimée : ~5,6 unités par caractère à 11px, plus une marge de
       confort de chaque côté. Mieux vaut surestimer — une étiquette de moins
       se lit toujours dans le tableau, deux étiquettes superposées ne se
       lisent nulle part. */
    const demiLargeur = (formaterCentimes(journee.total).length * 5.6) / 2 + 3;

    const croise = posees.some(
      (autre) =>
        Math.abs(autre.x - x) < autre.demiLargeur + demiLargeur &&
        Math.abs(autre.y - y) < HAUTEUR_ETIQUETTE,
    );
    if (croise) continue;

    etiquetes.add(index);
    posees.push({ x, y, demiLargeur });
  }

  return (
    <section className="carte graphique" aria-labelledby={`${identifiant}-titre`}>
      <h2 className="carte__titre" id={`${identifiant}-titre`}>
        Recettes des quatorze derniers jours
      </h2>
      <p className="carte__sous-titre">
        Montant encaissé chaque jour. Les journées sans encaissement sont
        affichées à zéro.
      </p>

      <div className="graphique__cadre">
        <svg
          /* Le viewBox inclut les marges : les étiquettes du haut, les dates du
             bas et les graduations de gauche sont DANS le cadre, jamais
             rognées par lui. */
          viewBox={`0 0 ${largeur} ${hauteur}`}
          className="graphique__svg"
          role="img"
          aria-labelledby={`${identifiant}-titre`}
        >
          {/* La grille et les axes : hairline, pleins, en retrait. Ils situent,
              ils ne s'exposent pas. */}
          {graduations(echelle).map((valeur) => {
            const y = baseY - hauteurDe(valeur);
            return (
              <g key={valeur}>
                <line
                  x1={MARGE_GAUCHE}
                  y1={y}
                  x2={largeur - MARGE_DROITE}
                  y2={y}
                  className="graphique__grille"
                  fill="none"
                />
                <text
                  x={MARGE_GAUCHE - 8}
                  y={y}
                  className="graphique__graduation"
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="currentColor"
                >
                  {formaterCentimes(valeur)}
                </text>
              </g>
            );
          })}

          {serie.map((journee, index) => {
            const h = hauteurDe(journee.total);
            const x = MARGE_GAUCHE + index * PAS + (PAS - EPAISSEUR) / 2;
            const y = baseY - h;
            const estSurvolee = survolee === index;

            return (
              <g key={journee.jour}>
                {/* La barre. Extrémité arrondie côté valeur, pied carré sur la
                    ligne de base : `rx` arrondirait les quatre coins, d'où le
                    tracé explicite. Un jour à zéro ne dessine rien. */}
                {h > 0 && (
                  <path
                    d={dessinerBarre(x, y, EPAISSEUR, h, RAYON)}
                    className={
                      estSurvolee
                        ? "graphique__barre graphique__barre--survolee"
                        : "graphique__barre"
                    }
                    fill="currentColor"
                  />
                )}

                {/* L'étiquette sélective, au-dessus de la barre, dans la marge
                    haute réservée pour elle. */}
                {etiquetes.has(index) && journee.total > 0 && (
                  <text
                    x={x + EPAISSEUR / 2}
                    y={y - 6}
                    className="graphique__valeur"
                    textAnchor="middle"
                    fill="currentColor"
                  >
                    {formaterCentimes(journee.total)}
                  </text>
                )}

                {/* La date, une sur deux : quatorze dates côte à côte se
                    chevauchent. La première et la dernière sont toujours là. */}
                {(index % 2 === 0 || index === serie.length - 1) && (
                  <text
                    x={x + EPAISSEUR / 2}
                    y={baseY + 16}
                    className="graphique__date"
                    textAnchor="middle"
                    fill="currentColor"
                  >
                    {jourCourt(journee.jour)}
                  </text>
                )}

                {/* La cible de survol : TOUTE la colonne, du haut du cadre à la
                    ligne de base. Elle est bien plus grande que la barre — un
                    jour à 2 € ne doit pas demander de viser trois pixels. */}
                <rect
                  x={MARGE_GAUCHE + index * PAS}
                  y={MARGE_HAUTE}
                  width={PAS}
                  height={HAUTEUR_TRACE}
                  className="graphique__cible"
                  fill="transparent"
                  onMouseEnter={() => setSurvolee(index)}
                  onMouseLeave={() => setSurvolee(null)}
                >
                  {/*
                    L'infobulle native : elle vient sans JavaScript, survit à
                    l'impression du DOM et fonctionne au survol tactile long.
                    Elle porte la date COMPLÈTE et le montant.

                    ⚠ UNE SEULE CHAÎNE, jamais plusieurs enfants. React refuse
                    un tableau d'enfants dans `<title>` — le navigateur ne
                    garderait que du texte — et l'infobulle sortait VIDE :
                    elle existait dans le DOM, et ne disait rien. Le compilateur
                    ne l'avait pas vu ; le rendu, si.
                  */}
                  <title>{infobulle(journee)}</title>
                </rect>
              </g>
            );
          })}

          {/* La ligne de base, dessinée après les barres : elle les ancre. */}
          <line
            x1={MARGE_GAUCHE}
            y1={baseY}
            x2={largeur - MARGE_DROITE}
            y2={baseY}
            className="graphique__axe"
            fill="none"
          />
        </svg>
      </div>

      {/*
        La vue tableau.
        Un graphique qui n'existe qu'en pixels n'est lisible ni par un lecteur
        d'écran, ni par quelqu'un qui ne distingue pas les hauteurs, ni sur une
        impression en noir et blanc. Les mêmes chiffres, atteignables au
        clavier, et jamais gatés derrière un survol.
      */}
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
        <div className="tableau-defilant" tabIndex={0} role="region" aria-label="Recettes par jour">
          <table className="registre">
            <caption>Recettes des quatorze derniers jours, jour par jour.</caption>
            <thead>
              <tr>
                <th scope="col">Jour</th>
                <th scope="col">Recettes</th>
                <th scope="col">Encaissements</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((journee) => (
                <tr key={journee.jour}>
                  <th scope="row">
                    <time dateTime={journee.jour}>{jourLong(journee.jour)}</time>
                  </th>
                  <td className="registre__nombre">{formaterCentimes(journee.total)}</td>
                  <td className="registre__nombre">{journee.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/**
 * Le tracé d'une barre : extrémité arrondie côté valeur, pied carré.
 *
 * `rx` sur un `<rect>` arrondirait les quatre coins, y compris ceux qui
 * reposent sur la ligne de base — la barre semblerait flotter. On trace donc le
 * contour à la main : deux coins arrondis en haut, deux angles droits en bas.
 *
 * Le rayon est réduit si la barre est plus basse que lui, sans quoi le tracé se
 * replierait sur lui-même.
 */
function dessinerBarre(
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  rayon: number,
): string {
  const r = Math.min(rayon, hauteur, largeur / 2);
  return [
    `M ${x} ${y + hauteur}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `L ${x + largeur - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + largeur} ${y + r}`,
    `L ${x + largeur} ${y + hauteur}`,
    "Z",
  ].join(" ");
}
