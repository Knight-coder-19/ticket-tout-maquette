/**
 * `POST /api/v1/admin/topup-batches/{id}/validate` — écrit le lot.
 *
 * ✅ ROUTE DU CONTRAT (`data-dictionary.md:556`) : « aucune [entrée] → 204 ».
 * C'est le seul point d'écriture des rechargements en lot — `validerLot`
 * (`mocks/magasin.ts`) poste UNE opération par ligne, jamais avant d'avoir
 * vérifié qu'AUCUNE ligne n'est en erreur.
 *
 * ⚠ NOTRE CHOIX pour l'état d'un lot dont la validation échoue faute de
 * lignes propres : `rejected`, pas `draft`. Rien dans le contrat ne le
 * précise, mais laisser `draft` suggérerait qu'un second appel pourrait
 * réussir — alors que les lignes d'un lot sont figées à l'import, et que rien
 * ne change entre deux tentatives. `rejected` dit : recommencez avec un
 * fichier corrigé, pas avec ce lot-ci.
 *
 * ⚠ NOTRE CHOIX pour un lot déjà `validated` ou `rejected` : `409`, avec un
 * code que nous nommons (`BATCH_ALREADY_PROCESSED`) — le contrat ne liste que
 * `422 BATCH_HAS_ERRORS` et `404` pour cette route, aucun code de conflit
 * d'état. `404` aurait confondu « ce lot n'existe pas » et « ce lot existe
 * mais n'attend plus de validation » ; deux questions différentes méritent
 * deux réponses différentes.
 */

import { erreur, identite, sansContenu } from "@/mocks/enveloppe";
import { trouverAdministrateur, validerLot } from "@/mocks/magasin";

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
  const issue = validerLot(id, administrateurId, Date.now());
  if ("echec" in issue) {
    if (issue.echec === "introuvable") {
      return erreur(404, "NOT_FOUND", "Ce lot n'existe pas.");
    }
    if (issue.echec === "deja_traite") {
      return erreur(409, "BATCH_ALREADY_PROCESSED", "Ce lot a déjà été validé ou rejeté.");
    }
    if (issue.echec === "motif_manquant") {
      return erreur(422, "VALIDATION_FAILED", "Le motif est obligatoire : il manque sur ce lot.");
    }
    return erreur(
      422,
      "BATCH_HAS_ERRORS",
      "Ce lot contient des lignes en erreur. Corrigez le fichier et importez-le à nouveau.",
    );
  }

  return sansContenu();
}
