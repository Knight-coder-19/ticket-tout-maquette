"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Le rail de navigation d'un espace.
 *
 * ─── Pourquoi il vit ici ───
 *
 * `RailAdministration` et `RailPartenaire` ne diffèrent que par quatre choses :
 * la liste des entrées, le titre du rail, le nom accessible de la navigation, et
 * la racine de l'espace. Quatre propriétés ne font pas deux composants.
 *
 * Il est partagé par deux espaces, il vit donc dans `src/components/` — pas à
 * la racine d'un espace, qui est réservée à ce que deux ÉCRANS d'un même
 * espace partagent (`front/CLAUDE.md`).
 *
 * Chaque espace garde son propre fichier `Rail<Espace>.tsx` : il n'y porte que
 * ses entrées, qui sont des données propres à lui, pas de la mécanique.
 */

export interface EntreeRail {
  href: string;
  libelle: string;
}

/**
 * Une entrée est courante si elle mène à la page affichée, ou à l'une de ses
 * sous-pages.
 *
 * Le préfixe est indispensable : `/administration/salaries/SAL-001` doit
 * marquer « Salariés », sinon l'agent perd sa position dès qu'il ouvre une
 * fiche. Mais il se compare sur une frontière de segment, `${href}/`, sans quoi
 * `/administration/recharges` marquerait aussi une hypothétique
 * `/administration/recharges-archivees`.
 *
 * La racine de l'espace est le seul cas exact : elle est le préfixe de toutes
 * les autres entrées, et un préfixe l'allumerait sur toutes les pages.
 */
export function estCourante(href: string, chemin: string, racine: string): boolean {
  if (href === racine) return chemin === racine;
  return chemin === href || chemin.startsWith(`${href}/`);
}

export function Rail({
  titre,
  nomAccessible,
  racine,
  entrees,
  identifiantTitre,
}: {
  /** Le nom de l'espace, affiché en tête du rail. */
  titre: string;
  /** Le nom de la navigation pour les technologies d'assistance. */
  nomAccessible: string;
  /** Le chemin de la racine de l'espace, comparé exactement. */
  racine: string;
  entrees: readonly EntreeRail[];
  /** Identifiant du titre, pour `aria-labelledby`. Unique par espace. */
  identifiantTitre: string;
}) {
  /* `usePathname` peut rendre `null` hors contexte de routage (rendu de test,
     erreur de montage). Le rail s'affiche alors sans entrée courante plutôt
     que de casser. */
  const chemin = usePathname() ?? "";

  return (
    <nav className="rail" aria-label={nomAccessible}>
      <h2 className="rail__titre" id={identifiantTitre}>
        {titre}
      </h2>
      <ul className="rail__liste" aria-labelledby={identifiantTitre}>
        {entrees.map(({ href, libelle }) => {
          const courante = estCourante(href, chemin, racine);
          return (
            <li key={href}>
              {/*
               * `aria-current="page"` et non une simple couleur : un
               * utilisateur de lecteur d'écran, ou qui ne perçoit pas les
               * contrastes de teinte, doit savoir où il est. La règle CSS de
               * l'état actif porte d'ailleurs sur cet attribut, ce qui
               * interdit aux deux de diverger.
               */}
              <Link
                className="rail__lien"
                href={href}
                aria-current={courante ? "page" : undefined}
              >
                {libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
