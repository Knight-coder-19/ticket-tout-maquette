"use client";

import { useId, useState } from "react";
import { formaterCentimes } from "@/lib/montant";
import { dessinerBarreVerticale } from "@/lib/utils/graphiques";
import type { SemaineNationale } from "@/types/domaine";

/**
 * Le volume national, semaine par semaine.
 *
 * Même forme et mêmes règles que `GraphiqueQuatorzeJours.tsx` (espace
 * partenaire) — barres, une seule échelle, le texte porte l'encre, jamais la
 * couleur de la série — mais un composant SÉPARÉ : le nombre de points,
 * l'espacement et le format des libellés diffèrent assez entre un jour et une
 * semaine pour que forcer les deux dans une seule abstraction complique plus
 * qu'elle ne simplifie. Seul le tracé géométrique de la barre est partagé
 * (`lib/utils/graphiques.ts`), parce que lui ne dépend d'aucun des deux
 * domaines.
 *
 * ⚠ NOTRE AJOUT au tableau de bord national : le DTO du contrat agrège toute
 * la fenêtre en un seul nombre. Voir l'en-tête de la route pour pourquoi une
 * série par semaine ne pouvait pas venir d'ailleurs.
 *
 * ─── Moins de points, donc pas de saut d'étiquette ───
 *
 * Huit semaines, contre quatorze jours : chaque semaine a sa place, la date
 * n'a pas besoin d'être affichée une semaine sur deux.
 */

const HAUTEUR_TRACE = 150;
const MARGE_HAUTE = 22;
const MARGE_BASSE = 26;
const MARGE_GAUCHE = 60;
const MARGE_DROITE = 8;
const PAS = 46;
const EPAISSEUR = 26;
const RAYON = 4;

function graduations(maximum: number): number[] {
  if (maximum <= 0) return [0];
  return [0, maximum / 2, maximum];
}

function plafond(maximum: number): number {
  if (maximum <= 0) return 100;
  const ordre = 10 ** Math.floor(Math.log10(maximum));
  return Math.ceil(maximum / (ordre / 2)) * (ordre / 2);
}

function semaineCourte(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(Date.parse(`${iso}T12:00:00.000Z`));
}

function semaineLongue(iso: string): string {
  const debut = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(Date.parse(`${iso}T12:00:00.000Z`));
  return `Semaine du ${debut}`;
}

function infobulle(semaine: SemaineNationale): string {
  const tete = `${semaineLongue(semaine.debut)} — ${formaterCentimes(semaine.volume)}`;
  if (semaine.nombreTransactions === 0) return `${tete}, aucune transaction`;
  return `${tete} sur ${semaine.nombreTransactions === 1 ? "1 transaction" : `${semaine.nombreTransactions} transactions`}`;
}

export function VolumeHebdomadaire({ semaines }: { semaines: SemaineNationale[] }) {
  const [survolee, setSurvolee] = useState<number | null>(null);
  const [tableauVisible, setTableauVisible] = useState(false);
  const identifiant = useId();

  const maximum = Math.max(0, ...semaines.map((s) => s.volume));
  const echelle = plafond(maximum);

  const largeur = MARGE_GAUCHE + semaines.length * PAS + MARGE_DROITE;
  const hauteur = MARGE_HAUTE + HAUTEUR_TRACE + MARGE_BASSE;
  const baseY = MARGE_HAUTE + HAUTEUR_TRACE;

  const hauteurDe = (volume: number): number =>
    echelle === 0 ? 0 : (volume / echelle) * HAUTEUR_TRACE;

  return (
    <section className="carte graphique" aria-labelledby={`${identifiant}-titre`}>
      <h2 className="carte__titre" id={`${identifiant}-titre`}>
        Volume par semaine
      </h2>
      <p className="carte__sous-titre">
        Volume encaissé chaque semaine, sur la période choisie. Les semaines
        sans activité sont affichées à zéro.
      </p>

      <div className="graphique__cadre">
        <svg
          viewBox={`0 0 ${largeur} ${hauteur}`}
          className="graphique__svg"
          role="img"
          aria-labelledby={`${identifiant}-titre`}
        >
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

          {semaines.map((semaine, index) => {
            const h = hauteurDe(semaine.volume);
            const x = MARGE_GAUCHE + index * PAS + (PAS - EPAISSEUR) / 2;
            const y = baseY - h;
            const estSurvolee = survolee === index;

            return (
              <g key={semaine.debut}>
                {h > 0 && (
                  <path
                    d={dessinerBarreVerticale(x, y, EPAISSEUR, h, RAYON)}
                    className={
                      estSurvolee
                        ? "graphique__barre graphique__barre--survolee"
                        : "graphique__barre"
                    }
                    fill="currentColor"
                  />
                )}

                {/* Chaque semaine porte son étiquette : huit points tiennent,
                    contrairement à quatorze jours, sans qu'aucune sélection ne
                    soit nécessaire. */}
                {semaine.volume > 0 && (
                  <text
                    x={x + EPAISSEUR / 2}
                    y={y - 6}
                    className="graphique__valeur"
                    textAnchor="middle"
                    fill="currentColor"
                  >
                    {formaterCentimes(semaine.volume)}
                  </text>
                )}

                <text
                  x={x + EPAISSEUR / 2}
                  y={baseY + 16}
                  className="graphique__date"
                  textAnchor="middle"
                  fill="currentColor"
                >
                  {semaineCourte(semaine.debut)}
                </text>

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
                  <title>{infobulle(semaine)}</title>
                </rect>
              </g>
            );
          })}

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
        <div
          className="tableau-defilant"
          tabIndex={0}
          role="region"
          aria-label="Volume par semaine"
        >
          <table className="registre">
            <caption>Volume national par semaine, semaine par semaine.</caption>
            <thead>
              <tr>
                <th scope="col">Semaine</th>
                <th scope="col">Volume</th>
                <th scope="col">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {semaines.map((semaine) => (
                <tr key={semaine.debut}>
                  <th scope="row">
                    <time dateTime={semaine.debut}>{semaineLongue(semaine.debut)}</time>
                  </th>
                  <td className="registre__nombre">{formaterCentimes(semaine.volume)}</td>
                  <td className="registre__nombre">{semaine.nombreTransactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
