"use client";

import { formaterCentimes } from "@/lib/montant";
import type { MontantCentimes } from "@/types/encaissement";

/**
 * Les quatre chiffres du matin.
 *
 * ─── Quatre, pas dix ───
 *
 * Une rangée de tuiles n'est pas un inventaire. Au-delà de quatre ou cinq, plus
 * rien ne domine et le commerçant balaye sans lire. Les quatre retenus sont
 * ceux qui répondent aux quatre questions du matin : combien aujourd'hui,
 * combien ce mois, combien de clients, quel panier.
 *
 * ─── Le chiffre domine, le libellé est secondaire ───
 *
 * La valeur est en `--taille-2xl`, le libellé en `--taille-sm` et en encre
 * secondaire. La période est dite EN TOUTES LETTRES sous chaque chiffre : « ce
 * mois-ci » et « aujourd'hui » ne sont pas la même chose, et une tuile qui ne
 * dit pas sa période se lit de travers un 1er du mois.
 *
 * ─── Chiffres proportionnels, pas tabulaires ───
 *
 * `tabular-nums` aligne les colonnes d'un tableau ; sur un grand nombre isolé
 * il écarte les chiffres et fait paraître « 121 » lâche. Les tuiles portent
 * donc des figures proportionnelles, et le tableau du graphique garde les
 * tabulaires.
 */

export interface TuilesRecettesProps {
  /** Recettes du jour, en centimes entiers. */
  recettesDuJour: MontantCentimes;
  /** Recettes du mois en cours, en centimes entiers. */
  recettesDuMois: MontantCentimes;
  /** Nombre d'encaissements du mois en cours. */
  encaissementsDuMois: number;
}

function Tuile({
  libelle,
  valeur,
  periode,
}: {
  libelle: string;
  valeur: string;
  periode: string;
}) {
  return (
    <div className="tuile">
      <p className="tuile__valeur">{valeur}</p>
      <p className="tuile__libelle">{libelle}</p>
      <p className="tuile__periode">{periode}</p>
    </div>
  );
}

export function TuilesRecettes({
  recettesDuJour,
  recettesDuMois,
  encaissementsDuMois,
}: TuilesRecettesProps) {
  /*
   * Le panier moyen se CALCULE, il ne se demande pas au serveur : c'est un
   * quotient de deux chiffres déjà là, et une troisième source pourrait
   * diverger des deux premières.
   *
   * La division entière est volontaire — le domaine est en centimes entiers, et
   * un panier moyen à la fraction de centime n'a pas de sens. `Math.round`
   * plutôt que la troncature : sur une moyenne, arrondir est juste.
   */
  const panierMoyen =
    encaissementsDuMois > 0 ? Math.round(recettesDuMois / encaissementsDuMois) : 0;

  return (
    <section className="tuiles" aria-label="Chiffres du mois">
      <Tuile
        libelle="Recettes"
        valeur={formaterCentimes(recettesDuJour)}
        periode="aujourd'hui"
      />
      <Tuile
        libelle="Recettes"
        valeur={formaterCentimes(recettesDuMois)}
        periode="depuis le début du mois"
      />
      <Tuile
        libelle={encaissementsDuMois === 1 ? "Encaissement" : "Encaissements"}
        valeur={String(encaissementsDuMois)}
        periode="depuis le début du mois"
      />
      <Tuile
        libelle="Panier moyen"
        valeur={encaissementsDuMois > 0 ? formaterCentimes(panierMoyen) : "—"}
        periode={
          encaissementsDuMois > 0
            ? "depuis le début du mois"
            : "aucun encaissement ce mois-ci"
        }
      />
    </section>
  );
}
