/**
 * `GET /api/v1/public/featured-partners` — la vitrine publique.
 *
 * ✅ ROUTE DU CONTRAT — `data-dictionary.md:339-350`. Le corps est un
 * `PublicFeaturedList`, un TABLEAU NU, pas une enveloppe `Paginated<T>` : la
 * sélection du Ministre est courte par nature (un choix éditorial, pas un
 * annuaire), et le contrat sert `GET /v1/cities` de la même façon.
 *
 * Aucune authentification : c'est la seule surface de tout le contrat qui
 * n'en demande pas (amendement A3).
 *
 * ─── Ce qui filtre ───
 *
 * Emplacement `public_featured` uniquement -- `minister_pick` est réservé au
 * salarié authentifié (`GET /me/minister-picks`, :394-399). Seules les mises
 * en avant ACTIVES (`removed_at IS NULL`) et dont le partenaire est TOUJOURS
 * `approved` : rien n'empêche, dans ce mock, qu'un partenaire mis en avant
 * soit suspendu APRÈS coup par une route distincte -- ce cas n'est pas
 * couvert par `ajouterMiseEnAvant`, qui ne contrôle qu'à l'écriture. Le
 * filtrer ici, à la lecture, est la seconde ligne de défense : la vitrine ne
 * doit jamais montrer un partenaire que l'administration a retiré du
 * dispositif entre-temps.
 *
 * ─── `note` : voir `types/api.ts` ───
 *
 * `PublicPartner.note` est un neuvième champ sur un type que la règle R9
 * verrouille à huit. La décision et son raisonnement complet sont écrits une
 * seule fois, sur le type lui-même -- ce commentaire n'y revient pas.
 */

import { succes } from "@/mocks/enveloppe";
import { misesEnAvantActives, trouverPartenaire, trouverVille } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const items = misesEnAvantActives("public_featured")
    .map((mise) => {
      const partenaire = trouverPartenaire(mise.partenaireId);
      if (!partenaire || partenaire.statut !== "approved") return null;

      const ville = partenaire.cityId === null ? undefined : trouverVille(partenaire.cityId);

      return {
        id: partenaire.id,
        trade_name: partenaire.tradeName,
        category: partenaire.category,
        service_mode: partenaire.serviceMode,
        city: ville === undefined ? null : { id: ville.id, name: ville.name, department: ville.department },
        district: partenaire.district,
        website_url: partenaire.websiteUrl,
        position: mise.position,
        note: mise.mot,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  return succes(items);
}
