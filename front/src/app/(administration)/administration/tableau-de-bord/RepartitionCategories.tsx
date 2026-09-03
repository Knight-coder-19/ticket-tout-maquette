import { BarresHorizontales } from "@/components/graphiques/BarresHorizontales";
import type { LigneRepartition } from "@/types/domaine";

/**
 * La répartition du volume par catégorie de commerce.
 *
 * Habillage de `BarresHorizontales`. Les catégories viennent des données,
 * comme partout dans ce projet — aucune liste écrite ici (B. Sellami).
 */
export function RepartitionCategories({ parCategorie }: { parCategorie: LigneRepartition[] }) {
  return (
    <BarresHorizontales
      titre="Répartition par catégorie"
      sousTitre="Volume encaissé par catégorie de commerce, sur la période choisie."
      lignes={parCategorie}
    />
  );
}
