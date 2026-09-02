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
      {/*
        Une ligne, sans rien perdre. Les trois choses que la mention doit dire
        sont toutes la : c'est une simulation, rien de ce qui s'affiche ne
        correspond a un compte reel, rien n'engage personne. Ce qui a saute,
        c'est l'enumeration « les montants, les soldes et les operations » --
        « aucun montant affiche » couvre le meme terrain en trois mots.

        Rien n'est tronque : sur un conteneur etroit, le texte revient a la
        ligne. Couper un avertissement obligatoire pour tenir sur une ligne
        serait le vider.
      */}
      <p className="bandeau-simulation__texte">
        <strong className="bandeau-simulation__mention">{MENTION_SIMULATION}</strong>
        {" · "}
        Démonstrateur : aucun montant affiché ne correspond à un compte réel ni
        n&apos;engage personne.
      </p>
    </aside>
  );
}
