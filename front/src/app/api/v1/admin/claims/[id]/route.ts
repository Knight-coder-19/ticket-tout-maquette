/**
 * `GET /api/v1/admin/claims/{id}` — le dossier complet, fil compris.
 *
 * ⚠⚠ DE NOTRE FAIT — voir l'en-tête de `../route.ts` pour le constat complet.
 *
 * ⚠ `operation_id` SEUL, JAMAIS LE DÉTAIL DE L'ÉCRITURE. C'est la décision la
 * plus importante de cet écran : un dossier ne garde qu'un LIEN vers
 * l'opération qu'il vise, pas une copie de son montant ou de son sens. Si
 * l'écriture était annulée après coup, une copie resterait fausse sans que
 * personne ne le remarque. `OperationVisee` (l'écran) relit l'écriture EN
 * DIRECT via `GET /admin/ledger-entries?operation_id=...` à chaque affichage.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { nomComplet, trouverAdministrateur, trouverReclamation, trouverSalarie } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function GET(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const { id } = await contexte.params;
  const reclamation = trouverReclamation(id);
  if (!reclamation) {
    return erreur(404, "NOT_FOUND", "Cette réclamation n'existe pas.");
  }

  const salarie = trouverSalarie(reclamation.salarieId);
  if (!salarie) {
    return erreur(404, "NOT_FOUND", "Le salarié de ce dossier n'existe plus.");
  }

  const STATUTS = { ouverte: "open", en_cours: "in_progress", close: "closed" } as const;

  return succes({
    id: reclamation.id,
    employee_id: reclamation.salarieId,
    employee_name: nomComplet(salarie),
    status: STATUTS[reclamation.statut],
    operation_id: reclamation.operationId,
    messages: reclamation.messages.map((m) => ({
      id: m.id,
      author: m.auteur === "agent" ? "agent" : "employee",
      author_id: m.auteurId,
      text: m.texte,
      sent_at: m.envoyeLe,
    })),
    opened_at: reclamation.ouverteLe,
    close_reason: reclamation.motifCloture,
    closed_at: reclamation.closeLe,
  });
}
