/**
 * `POST /api/v1/admin/claims/{id}/close` — clôture d'un dossier.
 *
 * ⚠⚠ DE NOTRE FAIT — voir l'en-tête de `../../route.ts`.
 *
 * MOTIF OBLIGATOIRE, refusé ici, pas seulement à l'écran — même règle que la
 * suspension d'un compte ou la régularisation d'un solde. `cloturerReclamation`
 * (`mocks/magasin.ts`) le fait respecter.
 *
 * Rien n'est supprimé : le fil reste lisible en entier après la clôture,
 * `GET .../{id}` continue de le servir tel quel.
 */

import { erreur, identite, sansContenu } from "@/mocks/enveloppe";
import { cloturerReclamation, trouverAdministrateur, type EchecCloture } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const ECHECS: Record<EchecCloture, { statut: number; code: string; message: string }> = {
  introuvable: { statut: 404, code: "NOT_FOUND", message: "Cette réclamation n'existe pas." },
  deja_close: { statut: 409, code: "CLAIM_ALREADY_CLOSED", message: "Ce dossier est déjà clos." },
  motif_manquant: {
    statut: 422,
    code: "VALIDATION_FAILED",
    message: "Le motif est obligatoire pour clore un dossier.",
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
  const motif = (corps as Record<string, unknown> | null)?.["reason"];

  const issue = cloturerReclamation(
    id,
    typeof motif === "string" ? motif : null,
    administrateurId,
    Date.now(),
  );
  if ("echec" in issue) {
    const refus = ECHECS[issue.echec];
    return erreur(refus.statut, refus.code, refus.message);
  }

  return sansContenu();
}
