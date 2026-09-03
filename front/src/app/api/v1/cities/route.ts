/**
 * `GET /api/v1/cities` — le référentiel des villes.
 *
 * ✅ CELLE-CI EST LEUR ROUTE. `CityList = CityRef[]`
 * (`docs/data-dictionary.md:483-484`) : une liste nue, pas d'enveloppe.
 *
 * Elle existe pour que le filtre ville du catalogue vienne des DONNÉES et non
 * d'une liste écrite dans un composant — la même règle que pour les catégories
 * (B. Sellami). Ajouter, renommer ou retirer une ville ne doit toucher aucune
 * ligne d'interface.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { magasin, trouverPartenaire } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const partenaireId = identite(requete, "X-Mock-Partenaire", "PRT-001");
  if (!trouverPartenaire(partenaireId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  return succes(
    [...magasin.villes]
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map((ville) => ({ id: ville.id, name: ville.name, department: ville.department })),
  );
}
