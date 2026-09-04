/**
 * `POST /api/v1/admin/employees/{id}/reinstate` — SANS motif, et c'est voulu.
 *
 * ⚠ DE NOTRE FAIT, comme la suspension.
 *
 * Aucun corps n'est attendu. Exiger un motif pour rendre ses droits à
 * quelqu'un reviendrait à lui faire porter la charge d'une suspension qui,
 * peut-être, n'aurait jamais dû avoir lieu. Le contrat suit la même logique
 * pour les partenaires : `approve` répond `204` sans rien lire, `reject` exige
 * une `RejectRequest { reason }` (:507-508).
 *
 * `204` : la réactivation ne rend rien. L'écran relit la fiche.
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
  const issue = changerStatutSalarie(id, "actif", null);
  if ("echec" in issue) {
    if (issue.echec === "compte_ferme") {
      return erreur(409, "ACCOUNT_CLOSED", "Ce compte est fermé : il ne se réactive pas.");
    }
    return erreur(404, "NOT_FOUND", "Ce bénéficiaire n'existe pas.");
  }

  return sansContenu();
}
