import type { Categorie } from "@/types/domaine";

/**
 * Categories de demonstration.
 * Elles vivent dans les donnees : l'interface ne connait aucune categorie
 * par son nom (B. Sellami). Ajouter/retirer une categorie ne touche aucun
 * composant.
 */
export const categoriesDemo: Categorie[] = [
  { id: "cat-restauration", libelle: "Restauration", ordre: 1 },
  { id: "cat-culture", libelle: "Culture", ordre: 2 },
  { id: "cat-loisirs", libelle: "Loisirs", ordre: 3 },
  { id: "cat-vie-quotidienne", libelle: "Vie quotidienne", ordre: 4 },
];
