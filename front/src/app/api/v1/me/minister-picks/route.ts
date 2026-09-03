/**
 * `GET /api/v1/me/minister-picks` — les partenaires mis en avant par le
 * Ministre (amendement A2).
 *
 * Contrat : `docs/data-dictionary.md:394-399`. `partner` y est un
 * `CatalogItem` complet, pas la forme réduite d'`HighlightItem` — c'est ce
 * qu'un salarié voit du réseau, pas ce qu'un agent gère.
 *
 * Source : le même registre de mises en avant que `/admin/highlights`
 * (`mocks/magasin.ts`, table `partner_highlights`), filtré sur l'emplacement
 * `minister_pick` et sur les partenaires encore agréés — une mise en avant
 * n'est jamais supprimée (R6), mais un partenaire suspendu depuis ne doit pas
 * réapparaître ici pour autant.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import {
  libererJetonsExpires,
  misesEnAvantActives,
  trouverPartenaire,
  trouverSalarie,
  trouverVille,
  type PartenaireMagasin,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

function enCatalogItem(partenaire: PartenaireMagasin): Record<string, unknown> {
  const ville = partenaire.cityId === null ? undefined : trouverVille(partenaire.cityId);
  return {
    id: partenaire.id,
    trade_name: partenaire.tradeName,
    category: partenaire.category,
    service_mode: partenaire.serviceMode,
    city:
      ville === undefined
        ? null
        : { id: ville.id, name: ville.name, department: ville.department },
    district: partenaire.district,
    address_line: partenaire.addressLine,
    website_url: partenaire.websiteUrl,
    is_official_partner: partenaire.statut === "approved",
  };
}

export async function GET(requete: Request): Promise<Response> {
  const maintenant = Date.now();
  libererJetonsExpires(maintenant);

  const employeeId = identite(requete, "X-Mock-Employe", "SAL-001");
  if (!trouverSalarie(employeeId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const items = misesEnAvantActives("minister_pick")
    .map((mise) => {
      const partenaire = trouverPartenaire(mise.partenaireId);
      if (!partenaire || partenaire.statut !== "approved") return null;
      return { partner: enCatalogItem(partenaire), position: mise.position };
    })
    .filter((item): item is { partner: Record<string, unknown>; position: number } => item !== null);

  return succes(items);
}
