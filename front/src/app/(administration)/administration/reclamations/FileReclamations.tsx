"use client";

import Link from "next/link";

import { formaterAnciennete, formaterDate, joursEcoules } from "@/lib/utils/date";
import type { ReclamationResume, StatutReclamation } from "@/types/domaine";

/**
 * La file des réclamations — comme `Validations` : la plus ancienne ouverte
 * en premier.
 *
 * ⚠ Domaine entièrement de notre fait — voir `types/domaine.ts`.
 *
 * Chaque carte montre le salarié, un extrait du dernier message, depuis
 * quand elle attend, son statut. Composant de présentation : il ne charge
 * rien, il rend ce qu'on lui donne — la même discipline que `CarteDemande`.
 */

const LIBELLES: Record<StatutReclamation, string> = {
  ouverte: "Ouverte",
  en_cours: "En cours",
  close: "Close",
};

/** La forme est celle de `.statut`, déjà écrite ; le vocabulaire est nouveau,
 *  mais réutilise les TEINTES existantes plutôt que d'en inventer :
 *  ouverte ~ en attente d'un premier geste, en_cours ~ favorable/actif,
 *  close ~ neutre et terminé. */
const TEINTES: Record<StatutReclamation, string> = {
  ouverte: "en_attente",
  en_cours: "agree",
  close: "ferme",
};

export function FileReclamations({ reclamations }: { reclamations: ReclamationResume[] }) {
  return (
    <ul className="file-reclamations">
      {reclamations.map((reclamation) => {
        const jours = joursEcoules(reclamation.ouverteLe);
        return (
          <li key={reclamation.id}>
            <Link
              href={`/administration/reclamations/${reclamation.id}`}
              className="carte-reclamation"
            >
              <div className="carte-reclamation__entete">
                <h2 className="carte-reclamation__salarie">{reclamation.salarieNom}</h2>
                <span className={`statut statut--${TEINTES[reclamation.statut]}`}>
                  {LIBELLES[reclamation.statut]}
                </span>
              </div>

              <p className="carte-reclamation__extrait">
                <span className="carte-reclamation__auteur">
                  {reclamation.auteurDernierMessage === "agent" ? "Vous : " : "Salarié : "}
                </span>
                {reclamation.extraitDernierMessage}
              </p>

              <p className="carte-reclamation__attente">
                Ouverte le {formaterDate(reclamation.ouverteLe)} —{" "}
                {formaterAnciennete(jours)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
