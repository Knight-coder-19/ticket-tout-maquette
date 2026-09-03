import type { StatutPartenaire } from "@/types/domaine";

/**
 * La pastille de statut d'un partenaire.
 *
 * ─── Pourquoi elle a remonté ici ───
 *
 * Elle a d'abord vécu dans le registre des comptes de l'administration, seul
 * écran à en avoir besoin. La fiche d'établissement du commerçant en veut une
 * aussi, à l'identique : deux espaces, donc `src/components/`. La recopier
 * aurait laissé deux libellés de « Suspendu » qu'un jour l'un des deux aurait
 * cessé de suivre l'autre.
 *
 * Sa forme (`.statut`) était déjà dans `primitives.css` ; ses teintes sont
 * remontées de `comptes.css` avec ce fichier, pour la même raison — l'espace
 * partenaire ne charge pas la feuille de l'administration.
 *
 * ─── Le texte porte, la couleur répète ───
 *
 * Chaque pastille dit son statut en toutes lettres. Un agent qui ne perçoit
 * pas les teintes, ou qui imprime en noir et blanc, lit exactement la même
 * chose. `suspendu` et `refuse` partagent d'ailleurs la teinte d'alerte : seul
 * le mot les sépare, et c'est suffisant.
 */

/**
 * Le libellé de chaque statut, en toutes lettres.
 *
 * Ce n'est PAS une liste de catégories : les catégories viennent des données et
 * ne sont jamais écrites dans un composant. Les statuts, eux, sont une
 * énumération fermée du contrat (`partner_status`, `0001_schema.sql:7`) — cinq
 * valeurs, un changement cassant si elle bouge. Les traduire est le travail de
 * l'interface.
 */
const LIBELLES: Record<StatutPartenaire, string> = {
  en_attente: "En attente",
  agree: "Agréé",
  refuse: "Refusé",
  suspendu: "Suspendu",
  ferme: "Fermé",
};

export function PastilleStatut({ statut }: { statut: StatutPartenaire }) {
  return <span className={`statut statut--${statut}`}>{LIBELLES[statut]}</span>;
}
