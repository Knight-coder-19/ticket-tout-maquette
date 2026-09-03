/**
 * Une tuile de chiffre clé : la valeur domine, le libellé et la période
 * l'accompagnent.
 *
 * ─── Pourquoi elle a remonté ───
 *
 * Écrite d'abord en local dans `TuilesRecettes.tsx` (espace partenaire), puis
 * recopiée à l'identique dans le tableau de bord national de
 * l'administration. Deux espaces, un même objet — `components/graphiques/`
 * est le lieu prévu pour cela, et le fichier `TuileStat.tsx` existait déjà,
 * vide, exactement pour ce rôle.
 *
 * ─── Le chiffre domine, le libellé est secondaire ───
 *
 * `--taille-2xl` pour la valeur, `--taille-sm` en encre secondaire pour le
 * libellé, `--taille-xs` plus discrète encore pour la période.
 *
 * ─── La période est dite EN TOUTES LETTRES ───
 *
 * « aujourd'hui », « ce mois-ci », « à l'instant », « à traiter » ne sont pas
 * la même chose, et une tuile qui ne dit pas la sienne se lit de travers un
 * 1er du mois, ou masque qu'un chiffre appelle une action.
 *
 * ─── Chiffres proportionnels, pas tabulaires ───
 *
 * `tabular-nums` aligne les colonnes d'un tableau ; sur un grand nombre isolé
 * il écarte les chiffres et fait paraître « 121 » lâche. Réservé au tableau
 * du graphique, jamais à une tuile — voir `.tuile__valeur` (`primitives.css`).
 */
export function TuileStat({
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
