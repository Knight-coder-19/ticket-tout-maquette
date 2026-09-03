// Catégories de partenaires - pilotées par les données, pas par les gabarits
// (mail Sellami). On ajoute / renomme / retire une catégorie ici sans toucher
// une ligne d'interface ; les écrans (page d'info, recherche, catalogue)
// s'adaptent, et une catégorie sans partenaire s'affiche proprement.
//
// Charte : catégories NEUTRES, jamais les enseignes en dur.

export type PartnerCategory = {
  slug: string;
  label: string;
  /** Phrase courte affichée sur la page d'info. */
  blurb: string;
  /** Nombre de partenaires référencés - 0 = catégorie ouverte, sans casse. */
  partnerCount: number;
};

export const partnerCategories: PartnerCategory[] = [
  {
    slug: "restauration",
    label: "Restauration",
    blurb: "Déjeuner, boulangerie, traiteur.",
    partnerCount: 2,
  },
  {
    slug: "culture",
    label: "Culture",
    blurb: "Librairie, cinéma, spectacle, musée.",
    partnerCount: 1,
  },
  {
    slug: "loisirs",
    label: "Loisirs",
    blurb: "Sport, plein air, activités en équipe.",
    partnerCount: 1,
  },
  {
    slug: "vie-quotidienne",
    label: "Vie quotidienne",
    blurb: "Commerces de proximité et services du quotidien.",
    partnerCount: 0,
  },
];
