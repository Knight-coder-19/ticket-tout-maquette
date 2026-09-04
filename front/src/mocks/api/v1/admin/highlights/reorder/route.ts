/**
 * `PUT /api/v1/admin/highlights/reorder` — l'ordre d'affichage.
 *
 * ✅ Route du contrat (`data-dictionary.md:530-534`) : `{ placement,
 * ordered_ids }`, où `ordered_ids` est « la liste COMPLÈTE, dans l'ordre
 * voulu » — pas un delta, pas une paire à permuter. `reordonnerMisesEnAvant`
 * (`mocks/magasin.ts`) refuse un ensemble incomplet ou un identifiant qui
 * n'appartient pas à l'emplacement visé : accepter un sous-ensemble laisserait
 * une mise en avant sans position cohérente.
 *
 * NOTRE CHOIX DE STATUT : `200`, avec le corps. Le contrat ne l'écrit pas
 * (:530, même silence que `POST`) mais annonce que la route « renvoie un
 * corps » — ce n'est donc pas `204`. La liste réordonnée entière est rendue,
 * pour que l'écran n'ait pas à la relire après un glisser-déposer.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import {
  reordonnerMisesEnAvant,
  trouverAdministrateur,
  versHighlightItem,
  type Emplacement,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const EMPLACEMENTS: readonly Emplacement[] = ["minister_pick", "public_featured"];

function estEmplacement(valeur: string): valeur is Emplacement {
  return EMPLACEMENTS.some((e) => e === valeur);
}

export async function PUT(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return erreur(422, "VALIDATION_FAILED", "Le corps de la requête n'est pas du JSON.");
  }
  const donnees = (corps ?? {}) as Record<string, unknown>;

  const emplacementBrut = donnees["placement"];
  if (typeof emplacementBrut !== "string" || !estEmplacement(emplacementBrut)) {
    return erreur(422, "VALIDATION_FAILED", "placement doit valoir minister_pick ou public_featured.");
  }

  const ordonnesBrut = donnees["ordered_ids"];
  if (!Array.isArray(ordonnesBrut) || !ordonnesBrut.every((x) => typeof x === "string")) {
    return erreur(422, "VALIDATION_FAILED", "ordered_ids doit être un tableau d'identifiants.");
  }

  const issue = reordonnerMisesEnAvant(
    emplacementBrut,
    ordonnesBrut,
    administrateurId,
    Date.now(),
  );
  if ("echec" in issue) {
    const message =
      issue.echec === "ensemble_incomplet"
        ? "La liste doit contenir toutes les mises en avant actives de cet emplacement, sans en omettre ni en ajouter."
        : "Un des identifiants ne correspond à aucune mise en avant active de cet emplacement.";
    return erreur(422, "VALIDATION_FAILED", message);
  }

  return succes(
    issue.misesEnAvant
      .map(versHighlightItem)
      .filter((item): item is Record<string, unknown> => item !== null),
  );
}
