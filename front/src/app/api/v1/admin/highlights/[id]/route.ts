/**
 * `DELETE /api/v1/admin/highlights/{id}` — retire une mise en avant.
 *
 * ✅ Route du contrat (`data-dictionary.md:528`) : « → 204, renseigne
 * `removed_at`, ne supprime pas ». `retirerMiseEnAvant` (`mocks/magasin.ts`)
 * suit exactement cette règle — R6, comme partout ailleurs dans ce projet.
 *
 * Aucune raison n'est demandée. Retirer un partenaire de la vitrine n'est pas
 * une sanction qui appelle une justification, contrairement à la suspension
 * d'un compte : c'est un choix éditorial ordinaire, réversible en le
 * remettant.
 */

import { erreur, identite, sansContenu } from "@/mocks/enveloppe";
import { retirerMiseEnAvant, trouverAdministrateur } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function DELETE(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const { id } = await contexte.params;
  const issue = retirerMiseEnAvant(id, administrateurId, Date.now());
  if ("echec" in issue) {
    return erreur(404, "NOT_FOUND", "Cette mise en avant n'existe pas, ou a déjà été retirée.");
  }

  return sansContenu();
}
