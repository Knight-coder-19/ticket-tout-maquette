"use client";

import { TuileStat } from "@/components/graphiques/TuileStat";
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
 * Chaque tuile est un `TuileStat` (`components/graphiques/`) : la forme —
 * chiffre dominant, période en toutes lettres, figures proportionnelles —
 * y est décrite une fois, partagée avec le tableau de bord national de
 * l'administration.
 */

export interface TuilesRecettesProps {
  /** Recettes du jour, en centimes entiers. */
  recettesDuJour: MontantCentimes;
  /** Recettes du mois en cours, en centimes entiers. */
  recettesDuMois: MontantCentimes;
  /** Nombre d'encaissements du mois en cours. */
  encaissementsDuMois: number;
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
      <TuileStat
        libelle="Recettes"
        valeur={formaterCentimes(recettesDuJour)}
        periode="aujourd'hui"
      />
      <TuileStat
        libelle="Recettes"
        valeur={formaterCentimes(recettesDuMois)}
        periode="depuis le début du mois"
      />
      <TuileStat
        libelle={encaissementsDuMois === 1 ? "Encaissement" : "Encaissements"}
        valeur={String(encaissementsDuMois)}
        periode="depuis le début du mois"
      />
      <TuileStat
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
