/**
 * Le tracé d'une barre verticale : extrémité arrondie côté valeur, pied carré.
 *
 * ⚠ Extraite de `GraphiqueQuatorzeJours.tsx` (espace partenaire) : le tableau
 * de bord national en avait besoin à l'identique pour `VolumeHebdomadaire`.
 * Fonction purement géométrique, sans aucun couplage au domaine — le bon
 * candidat pour une extraction, contrairement au reste du composant (mise en
 * page, détection de collision d'étiquettes, formatage), qui diffère assez
 * entre un jour et une semaine pour rester deux composants séparés plutôt
 * qu'une seule abstraction forcée.
 *
 * `rx` sur un `<rect>` arrondirait les quatre coins, y compris ceux qui
 * reposent sur la ligne de base — la barre semblerait flotter. On trace donc
 * le contour à la main : deux coins arrondis en haut, deux angles droits en
 * bas. Le rayon est réduit si la barre est plus basse ou plus étroite que
 * lui, sans quoi le tracé se replierait sur lui-même.
 */
export function dessinerBarreVerticale(
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
