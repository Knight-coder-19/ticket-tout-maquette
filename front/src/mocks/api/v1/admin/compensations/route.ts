/**
 * `POST /api/v1/admin/compensations` — l'annulation.
 *
 * ✅ CELLE-CI EST LEUR ROUTE. Corps : `CompensationRequest { original_operation_id,
 * reason }` (`docs/data-dictionary.md:558-559`). Logique :
 * `compensate(tx, admin, original_operation_id, reason)` de
 * `corrections/mod.rs:1-3`.
 *
 * ⚠ Le statut de succès n'est pas spécifié — la route n'est annotée ni `→ 204`
 * ni d'un type de réponse. NOTRE CHOIX : `201`, avec l'opération créée. Ce
 * n'est pas une décision comme `approve` : l'annulation FABRIQUE une écriture
 * nouvelle, et l'agent a besoin de son identifiant pour la retrouver au
 * registre. Ambiguïté A3 de `front/docs/contrat-api.md`.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ELLE NE SUPPRIME RIEN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * L'opération d'origine n'est pas touchée. Une écriture inverse est ajoutée,
 * chaînée comme les autres, qui la référence et porte le motif. C'est la règle
 * R1 et l'invariant I8 : « une erreur ne se corrige jamais par une
 * modification : elle se corrige par une compensation, une opération inverse
 * qui laisse la trace des deux » (`data-model.md:139-140`).
 *
 * Le glossaire est explicite : compensation ≠ annulation, « rien n'est jamais
 * annulé » (`data-dictionary.md:666`). Le mot « annulation » reste dans
 * l'interface parce que c'est celui de l'agent ; dans le journal, c'est une
 * compensation.
 *
 * Trois refus, portés par le magasin et non par l'écran : motif absent,
 * compensation d'une compensation (décision 4), et double compensation de la
 * même opération.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { trouverAdministrateur } from "@/mocks/magasin";
import { compenser } from "@/mocks/registre";

export const dynamic = "force-dynamic";

export async function POST(requete: Request): Promise<Response> {
  const maintenant = Date.now();
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const donnees: unknown = await requete.json().catch(() => null);
  const lire = (champ: string): string | null => {
    if (typeof donnees !== "object" || donnees === null) return null;
    const valeur = (donnees as Record<string, unknown>)[champ];
    return typeof valeur === "string" && valeur.trim() !== "" ? valeur.trim() : null;
  };

  const operationId = lire("original_operation_id");
  if (operationId === null) {
    return erreur(422, "VALIDATION_FAILED", "Le champ original_operation_id est obligatoire.");
  }

  const resultat = compenser(operationId, administrateurId, lire("reason"), maintenant);

  if ("echec" in resultat) {
    switch (resultat.echec) {
      case "introuvable":
        return erreur(404, "OPERATION_NOT_FOUND", "Cette opération est introuvable au registre.");
      case "deja_compensee":
        return erreur(
          409,
          "OPERATION_ALREADY_COMPENSATED",
          "Cette opération a déjà été annulée. Une seconde annulation fausserait les soldes du montant entier.",
        );
      case "compensation_de_compensation":
        return erreur(
          409,
          "OPERATION_ALREADY_COMPENSATED",
          "Une annulation ne s'annule pas : elle se compense à son tour, en repartant de l'opération d'origine.",
        );
      case "motif_manquant":
        return erreur(
          422,
          "VALIDATION_FAILED",
          "Le champ reason est obligatoire : une écriture inverse sans motif enregistré n'est pas justifiable.",
        );
    }
  }

  const { operation, compensation } = resultat;
  return succes(
    {
      id: operation.id,
      original_operation_id: compensation.originalOperationId,
      kind: operation.kind,
      amount: euros(operation.amountCentimes),
      reason: compensation.reason,
      approved_by: compensation.approvedBy,
      recorded_at: operation.recordedAt,
    },
    201,
  );
}
