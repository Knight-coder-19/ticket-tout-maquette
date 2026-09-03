import type { Partenaire } from "@/types/domaine";

/**
 * Partenaires de demonstration.
 * Le nom affiche dans ces donnees est celui valide par le cabinet.
 * Aucun nom de code interne ici : ces jeux de donnees apparaissent
 * a l'ecran pendant la demonstration.
 */
export const partenairesDemo: Partenaire[] = [
  {
    id: "par-001",
    nom: "Boulangerie du Marché",
    categorieId: "cat-restauration",
    ville: "Lyon",
    estOfficiel: true,
    estMisEnAvant: true,
  },
  {
    id: "par-002",
    nom: "Le Comptoir des Halles",
    categorieId: "cat-restauration",
    ville: "Lyon",
    estOfficiel: true,
    estMisEnAvant: false,
  },
  {
    id: "par-003",
    nom: "Librairie Gutenberg",
    categorieId: "cat-culture",
    ville: "Villeurbanne",
    estOfficiel: true,
    estMisEnAvant: true,
  },
  {
    id: "par-004",
    nom: "Cinéma Le Zola",
    categorieId: "cat-culture",
    ville: "Villeurbanne",
    estOfficiel: true,
    estMisEnAvant: false,
  },
  {
    id: "par-005",
    nom: "Club de plein air Rhône Aventure",
    categorieId: "cat-loisirs",
    ville: "Lyon",
    estOfficiel: true,
    estMisEnAvant: false,
  },
  {
    id: "par-006",
    nom: "Épicerie Les Quatre Saisons",
    categorieId: "cat-vie-quotidienne",
    ville: "Lyon",
    estOfficiel: true,
    estMisEnAvant: false,
  },
  {
    id: "par-007",
    nom: "Fleuriste Pousse-Pousse",
    categorieId: "cat-vie-quotidienne",
    ville: "Caluire-et-Cuire",
    estOfficiel: false,
    estMisEnAvant: false,
  },
];
