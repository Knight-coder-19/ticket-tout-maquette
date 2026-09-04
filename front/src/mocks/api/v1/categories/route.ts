/**
 * `GET /api/v1/categories` — le référentiel des catégories.
 *
 * ========================================================================
 * CETTE ROUTE EST DE NOTRE FAIT, ET ELLE COMBLE UN MANQUE
 * ========================================================================
 *
 * Le contrat a `GET /api/v1/cities` pour les villes
 * (`data-dictionary.md:483-484`). Il n'a RIEN d'équivalent pour les catégories,
 * et le schéma n'a pas de table : `partners.category` est une colonne de texte
 * libre (`0001_schema.sql:104`). C'est le manque signalé dans
 * `front/docs/contrat-api.md`.
 *
 * ─── Pourquoi elle est nécessaire, et pas seulement commode ───
 *
 * La règle de B. Sellami : « Les catégories proviennent des données, jamais
 * d'une liste écrite dans ce fichier. » Sans référentiel, un écran n'a que deux
 * façons de peupler un filtre de catégories :
 *
 *   - écrire la liste en dur, ce que la règle interdit ;
 *   - la dériver de la PAGE COURANTE — et le filtre changerait alors à chaque
 *     pagination, proposant « culture » sur la page 1 et plus sur la page 2.
 *     Un filtre qui bouge sous le doigt est pire qu'absent.
 *
 * D'où cette route : les catégories distinctes des partenaires AGRÉÉS, triées.
 * Elles viennent des données, elles sont complètes, et elles ne bougent pas
 * quand on pagine.
 *
 * ⚠ Elle ne sert que des catégories RÉELLEMENT PORTÉES par un agréé. Une
 * catégorie dont tous les partenaires ont été suspendus disparaît du filtre —
 * c'est voulu : proposer un filtre qui ne rendrait rien est une impasse.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { comptesPartenaires, trouverPartenaire } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const partenaireId = identite(requete, "X-Mock-Partenaire", "PRT-001");
  if (!trouverPartenaire(partenaireId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const agrees = comptesPartenaires({ statut: "approved" });
  const distinctes = [...new Set(agrees.map((p) => p.category))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );

  return succes(
    distinctes.map((nom) => ({
      name: nom,
      partner_count: agrees.filter((p) => p.category === nom).length,
    })),
  );
}
