"use client";

import Link from "next/link";
import { formaterCentimes } from "@/lib/montant";
import type { EcritureRegistre } from "@/types/domaine";

/**
 * Les cinq derniers encaissements.
 *
 * ─── Une liste, pas un tableau ───
 *
 * Cinq lignes de trois champs ne forment pas une grille : il n'y a rien à
 * comparer colonne par colonne, rien à trier, rien à balayer en travers. Un
 * `<table>` imposerait ici des en-têtes, une sémantique de grille et une
 * navigation cellule par cellule pour un contenu qui se lit ligne à ligne.
 *
 * Le journal complet, lui, est un tableau — parce qu'on y compare et qu'on y
 * cherche. Le lien y mène.
 */
export function DerniersEncaissements({
  encaissements,
}: {
  encaissements: EcritureRegistre[];
}) {
  const heure = (iso: string): string =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(Date.parse(iso));

  return (
    <section className="carte" aria-labelledby="derniers-titre">
      <h2 className="carte__titre" id="derniers-titre">
        Derniers encaissements
      </h2>

      {encaissements.length === 0 ? (
        <p className="carte__sous-titre">
          Aucun encaissement pour le moment. Ils apparaîtront ici dès le premier.
        </p>
      ) : (
        <ul className="derniers">
          {encaissements.map((ecriture) => (
            <li className="derniers__ligne" key={ecriture.seq}>
              <span className="derniers__montant">
                {formaterCentimes(ecriture.montant)}
              </span>
              <span className="derniers__quand">
                <time dateTime={ecriture.survenueLe}>{heure(ecriture.survenueLe)}</time>
              </span>
              <span className="derniers__reference">n° {ecriture.seq}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="carte__lien">
        <Link href="/partenaire/transactions">
          Voir tous les encaissements
        </Link>
      </p>
    </section>
  );
}
