/**
 * `POST /api/v1/admin/employees/{id}/suspend` — motif OBLIGATOIRE.
 *
 * ⚠ DE NOTRE FAIT. Le contrat a `approve`/`reject` pour les partenaires
 * (:507-508) et rien pour les bénéficiaires, alors que `users.status`
 * (`0001_schema.sql:5`) porte bien `suspended`.
 *
 * Le motif est exigé ici, et pas à la réactivation : on doit pouvoir dire
 * pourquoi on prive quelqu'un de ses droits ; les lui rendre ne se justifie
 * pas. C'est le même raisonnement que pour les comptes partenaires.
 *
 * Un compte suspendu n'émet plus de jeton (`emettreJeton` refuse
 * « compte_inactif »), mais son historique et son solde sont conservés : rien
 * n'est effacé, jamais — R6, « close, never delete »
 * (`directory/employment.rs:3`).
 */

import { erreur, identite, sansContenu } from "@/mocks/enveloppe";
import { changerStatutSalarie, trouverAdministrateur } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

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

  const issue = changerStatutSalarie(
    id,
    "suspendu",
    typeof motif === "string" ? motif : null,
  );
  if ("echec" in issue) {
    if (issue.echec === "introuvable") {
      return erreur(404, "NOT_FOUND", "Ce bénéficiaire n'existe pas.");
    }
    if (issue.echec === "compte_ferme") {
      return erreur(409, "ACCOUNT_CLOSED", "Ce compte est fermé : son statut ne change plus.");
    }
    return erreur(
      422,
      "VALIDATION_FAILED",
      "Le motif est obligatoire pour suspendre un bénéficiaire.",
    );
  }

  return sansContenu();
}
