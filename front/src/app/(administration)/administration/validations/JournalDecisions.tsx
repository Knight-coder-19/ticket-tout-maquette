"use client";

import { formaterDate } from "@/lib/utils/date";
import type { DecisionJournal } from "@/types/domaine";

/**
 * Le journal des decisions. Chaque ligne porte son horodatage et son auteur.
 *
 * ⚠ Alimente par une route que NOUS proposons : le back n'expose aucune
 * lecture d'`audit_log`, bien que la table existe et que sa consultation par
 * l'administration soit prevue (`data-dictionary.md:300`). Voir
 * `types/api.ts`, type `LigneJournal`.
 *
 * L'horodatage complet est dans l'attribut `dateTime`, la date lisible dans le
 * texte : une machine et un humain n'ont pas les memes besoins.
 */
export function JournalDecisions({ decisions }: { decisions: DecisionJournal[] }) {
  if (decisions.length === 0) {
    return (
      <p className="journal__vide">
        Aucune décision enregistrée pour le moment.
      </p>
    );
  }

  return (
    <ul className="journal">
      {decisions.map((decision) => (
        <li className="journal__entree" key={decision.id}>
          <div className="journal__tete">
            <span
              className={
                decision.decision === "acceptee"
                  ? "pastille pastille--acceptee"
                  : decision.decision === "refusee"
                    ? "pastille pastille--refusee"
                    : "pastille"
              }
            >
              {decision.decision === "acceptee"
                ? "Acceptée"
                : decision.decision === "refusee"
                  ? "Refusée"
                  : /* Verbe inconnu : on montre la chaine brute plutot que de
                       la perdre. C'est ce qui la fera remonter en revue. */
                    decision.action}
            </span>
            <strong>{decision.enseigne ?? decision.demandeId ?? "—"}</strong>
            <time className="journal__horodatage" dateTime={decision.priseLe}>
              {formaterDate(decision.priseLe)}
            </time>
            {decision.auteurId !== null && (
              <span className="journal__horodatage">par {decision.auteurId}</span>
            )}
          </div>
          {decision.motif !== null && (
            <p className="journal__motif">Motif : {decision.motif}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
