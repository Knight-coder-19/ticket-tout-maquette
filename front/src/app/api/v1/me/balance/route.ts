/**
 * `GET /api/v1/me/balance` — le solde du salarié.
 *
 * Contrat : `docs/data-dictionary.md:374-380`. Le back calcule `available`
 * comme `settled - held` ; on fait exactement pareil ici, à partir du même
 * registre que `/partner/summary` et `/me/transactions` (`mocks/registre.ts`)
 * — un seul journal, jamais un solde recalculé par écran.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { libererJetonsExpires, soldeDe, trouverSalarie } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const maintenant = Date.now();
  libererJetonsExpires(maintenant);

  const employeeId = identite(requete, "X-Mock-Employe", "SAL-001");
  if (!trouverSalarie(employeeId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const solde = soldeDe(employeeId, maintenant);
  if (!solde) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  return succes({
    settled: euros(solde.settledCentimes),
    held: euros(solde.heldCentimes),
    available: euros(solde.disponibleCentimes),
    currency: "EUR",
  });
}
