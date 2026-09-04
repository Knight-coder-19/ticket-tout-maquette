"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/marque/Logo";
import { Icone, type NomIcone } from "@/components/ui/Icone";

/**
 * Le rail de navigation d'un espace.
 *
 * ─── Un seul rail pour les quatre espaces ───
 *
 * Salarié, partenaire et administration partagent la même coquille : bloc-marque
 * Ticket Tout + mention « simulation » en tête, entrées à icône, entrée courante
 * marquée (`aria-current` + graisse + filet ambre), pied optionnel (profil,
 * déconnexion). Chaque espace ne fournit que ses données : ses entrées, son
 * titre, sa racine.
 *
 * Il est partagé par plusieurs espaces, il vit donc dans `src/components/`.
 */

export interface EntreeRail {
  href: string;
  libelle: string;
  /** Icône du jeu interne (`components/ui/Icone`). */
  icone?: NomIcone;
}

/**
 * Une entrée est courante si elle mène à la page affichée, ou à l'une de ses
 * sous-pages. Le préfixe se compare sur une frontière de segment, `${href}/`.
 * La racine de l'espace est le seul cas exact.
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
  pied,
}: {
  /** Le nom de l'espace, affiché sous le bloc-marque. */
  titre: string;
  /** Le nom de la navigation pour les technologies d'assistance. */
  nomAccessible: string;
  /** Le chemin de la racine de l'espace, comparé exactement. */
  racine: string;
  entrees: readonly EntreeRail[];
  /** Identifiant du titre, pour `aria-labelledby`. Unique par espace. */
  identifiantTitre: string;
  /** Pied du rail : profil, déconnexion… Optionnel. */
  pied?: ReactNode;
}) {
  const chemin = usePathname() ?? "";

  return (
    <nav className="rail" aria-label={nomAccessible}>
      <div className="rail__marque">
        <Link href="/" aria-label="Ticket Tout, accueil">
          <Logo hauteur={22} />
        </Link>
        <span className="rail__sim">simulation</span>
      </div>

      <h2 className="rail__titre" id={identifiantTitre}>
        {titre}
      </h2>

      <ul className="rail__liste" aria-labelledby={identifiantTitre}>
        {entrees.map(({ href, libelle, icone }) => {
          const courante = estCourante(href, chemin, racine);
          return (
            <li key={href}>
              <Link
                className="rail__lien"
                href={href}
                aria-current={courante ? "page" : undefined}
              >
                {icone ? <Icone nom={icone} taille={18} /> : null}
                {libelle}
              </Link>
            </li>
          );
        })}
      </ul>

      {pied ? <div className="rail__pied">{pied}</div> : null}
    </nav>
  );
}
