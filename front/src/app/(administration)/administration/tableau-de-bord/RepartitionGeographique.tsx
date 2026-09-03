import { BarresHorizontales } from "@/components/graphiques/BarresHorizontales";
import type { LigneRepartition } from "@/types/domaine";

/**
 * La répartition du volume par ville.
 *
 * Habillage de `BarresHorizontales` (`components/graphiques/`) : ce fichier
 * ne fait que nommer la donnée reçue et l'affichage qu'elle demande. Les
 * commerces en ligne sont montrés À PART, sous les villes classées — jamais
 * fondus dedans, puisqu'ils n'appartiennent à aucune (amendement A1,
 * `data-dictionary.md:583`).
 */
export function RepartitionGeographique({
  parVille,
  enLigne,
}: {
  parVille: LigneRepartition[];
  enLigne: LigneRepartition;
}) {
  return (
    <BarresHorizontales
      titre="Répartition géographique"
      sousTitre="Volume encaissé par ville, sur la période choisie."
      lignes={parVille}
      ligneAPart={enLigne}
    />
  );
}
