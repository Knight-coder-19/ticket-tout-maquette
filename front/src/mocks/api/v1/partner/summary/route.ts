/**
 * `GET /api/v1/partner/summary?from=&to=` — le résumé d'activité.
 *
 * ✅ CELLE-CI EST LEUR ROUTE, et sa forme est respectée à la lettre :
 * `PartnerSummary { total_received, transaction_count, period_from, period_to,
 * is_official_partner }` (`docs/data-dictionary.md:418-425`). Cinq champs, ces
 * noms-là. Rien n'est ajouté.
 *
 * `total_received` n'est PAS un solde : « ce n'est pas dépensable » (décision 9,
 * glossaire :661). C'est un cumul encaissé sur la période, et il se recalcule
 * depuis le journal à chaque appel — `reporting/mod.rs:1-2` : « Read-only,
 * never an INSERT; aggregate on occurred_at ».
 *
 * `is_official_partner` est dérivé de `status === "approved"` (amendement A4,
 * :670) : ce n'est pas une colonne, et il ne faut pas en faire une.
 *
 * ⚠ Les bornes `from` et `to` sont obligatoires dans la signature mais le
 * contrat ne dit pas ce qu'il advient quand elles manquent. NOTRE CHOIX : le
 * mois courant, qui est la période qu'un commerçant regarde par défaut. Le
 * signaler plutôt que de rendre un 422 sur une route de lecture.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { trouverPartenaire } from "@/mocks/magasin";
import { agregerSur } from "@/mocks/recettes";

export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const partenaireId = identite(requete, "X-Mock-Partenaire", "PRT-001");
  const partenaire = trouverPartenaire(partenaireId);
  if (!partenaire) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;
  const maintenant = new Date(Date.now());

  const borne = (nom: string, defaut: string): string | null => {
    const valeur = parametres.get(nom);
    if (valeur === null || valeur === "") return defaut;
    return Number.isFinite(Date.parse(valeur)) ? valeur : null;
  };

  /* Par défaut : du premier jour du mois courant à maintenant. */
  const debutDuMois = `${maintenant.toISOString().slice(0, 7)}-01T00:00:00.000Z`;
  const depuis = borne("from", debutDuMois);
  const jusqua = borne("to", maintenant.toISOString());
  if (depuis === null || jusqua === null) {
    return erreur(422, "VALIDATION_FAILED", "Les paramètres from et to doivent être des dates ISO 8601.");
  }

  const agregat = agregerSur(partenaireId, depuis, jusqua);

  return succes({
    total_received: euros(agregat.totalCentimes),
    transaction_count: agregat.nombre,
    period_from: depuis,
    period_to: jusqua,
    is_official_partner: partenaire.statut === "approved",
  });
}
