/**
 * `POST /api/v1/admin/claims/{id}/messages` — la réponse d'un agent.
 *
 * ⚠⚠ DE NOTRE FAIT — voir l'en-tête de `../../route.ts`.
 *
 * ═══ UN DOSSIER CLOS REFUSE UNE NOUVELLE RÉPONSE ═══
 *
 * Vérifié ici, côté serveur — `repondreReclamation` (`mocks/magasin.ts`)
 * refuse l'écriture si `statut === "close"`, avant même de regarder le texte.
 * Un bouton grisé à l'écran est une aide à la lecture, pas la règle.
 *
 * ═══ LA PREMIÈRE RÉPONSE FAIT PASSER LE DOSSIER EN `in_progress` ═══
 *
 * Voir `repondreReclamation` pour le raisonnement : ce n'est pas un geste
 * séparé, c'est la conséquence du fait de répondre.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { repondreReclamation, trouverAdministrateur, type EchecMessage } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const ECHECS: Record<EchecMessage, { statut: number; code: string; message: string }> = {
  introuvable: { statut: 404, code: "NOT_FOUND", message: "Cette réclamation n'existe pas." },
  dossier_clos: {
    statut: 409,
    code: "CLAIM_CLOSED",
    message: "Ce dossier est clos : il n'accepte plus de nouveau message.",
  },
  texte_manquant: {
    statut: 422,
    code: "VALIDATION_FAILED",
    message: "Le message ne peut pas être vide.",
  },
};

export async function POST(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const { id } = await contexte.params;

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return erreur(422, "VALIDATION_FAILED", "Le corps de la requête n'est pas du JSON.");
  }
  const texte = (corps as Record<string, unknown> | null)?.["text"];
  if (typeof texte !== "string") {
    return erreur(422, "VALIDATION_FAILED", "text est requis.");
  }

  const issue = repondreReclamation(id, "agent", administrateurId, texte, Date.now());
  if ("echec" in issue) {
    const refus = ECHECS[issue.echec];
    return erreur(refus.statut, refus.code, refus.message);
  }

  const dernier = issue.reclamation.messages.at(-1);
  if (!dernier) {
    return erreur(500, "INTERNAL", "Le message vient d'être ajouté et reste introuvable.");
  }

  return succes(
    {
      id: dernier.id,
      author: "agent",
      author_id: dernier.auteurId,
      text: dernier.texte,
      sent_at: dernier.envoyeLe,
    },
    201,
  );
}
