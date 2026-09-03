/**
 * `GET /api/v1/admin/employers` — le référentiel des employeurs.
 *
 * ⚠ DE NOTRE FAIT. `directory/employers.rs:1` décrit bien « employer create,
 * update, list and close », mais la section 4 du contrat n'expose aucune de
 * ces quatre opérations.
 *
 * Elle existe pour une raison précise : le filtre par employeur du répertoire.
 * Sans référentiel, ce filtre devrait soit être écrit en dur dans un composant
 * — ce que la règle de B. Sellami interdit — soit être déduit de la page
 * courante, et changerait alors sous le doigt pendant la pagination. C'est le
 * même manque que pour les catégories de partenaires, et le même remède.
 *
 * Servie entière, sans pagination : le contrat fait de même pour les villes
 * (`GET /v1/cities` → `CityList`, un tableau nu), et un dispositif compte ses
 * employeurs par dizaines, pas par milliers.
 *
 * ⚠ `ifu` et `contact_email` sont marqués ⚠️ « administration seule » en
 * section 3.3 — c'est exactement le lecteur ici.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { magasin, trouverAdministrateur } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  /* L'effectif suit les données : il n'est écrit nulle part. */
  const effectifs = new Map<string, number>();
  for (const salarie of magasin.salaries) {
    effectifs.set(salarie.employeurId, (effectifs.get(salarie.employeurId) ?? 0) + 1);
  }

  return succes(
    [...magasin.employeurs]
      .sort((a, b) => (a.legalName < b.legalName ? -1 : a.legalName > b.legalName ? 1 : 0))
      .map((employeur) => ({
        id: employeur.id,
        legal_name: employeur.legalName,
        ifu: employeur.ifu,
        contact_email: employeur.contactEmail,
        status: employeur.statut,
        employee_count: effectifs.get(employeur.id) ?? 0,
      })),
  );
}
