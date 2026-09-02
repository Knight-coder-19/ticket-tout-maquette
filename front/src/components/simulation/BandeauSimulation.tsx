import "@/styles/simulation.css";
import { MENTION_SIMULATION } from "@/lib/config/constantes";

/**
 * La mention permanente de simulation.
 *
 * Exigence du cahier des charges (F. Pontaillac), pas une decoration : rien de
 * ce qui s'affiche dans l'application n'a de valeur reelle, et un ecran capture
 * sans cette mention pourrait etre pris pour un document officiel.
 *
 * ─── Non masquable, et voulu tel ───
 *
 * Aucun bouton de fermeture, aucun etat, aucun `useState`. Ce composant ne
 * peut pas etre ferme parce qu'il n'a rien qui le ferme : c'est un composant
 * serveur, sans interactivite. La seule facon de le retirer d'un ecran est de
 * le retirer du layout, ce qui se voit en revue.
 *
 * Le texte fort reprend `MENTION_SIMULATION` (`lib/config/constantes.ts:10`)
 * plutot que de le recopier : la formule doit rester la meme ici et partout
 * ou un montant s'affiche.
 *
 * `role="note"` : un contenu annexe au document, annonce comme tel par les
 * lecteurs d'ecran. Pas `role="alert"`, qui interromprait la lecture a chaque
 * navigation pour un message qui ne change jamais.
 */
export function BandeauSimulation() {
  return (
    <aside
      className="bandeau-simulation"
      role="note"
      aria-label="Avertissement de simulation"
    >
      <p className="bandeau-simulation__texte">
        <strong className="bandeau-simulation__mention">{MENTION_SIMULATION}</strong>
        {" — "}
        démonstrateur du dispositif CartePro. Les montants, les soldes et les
        opérations affichés ne correspondent à aucun compte réel, ne
        représentent aucune somme et n&apos;engagent personne.
      </p>
    </aside>
  );
}
