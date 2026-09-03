/**
 * Point d'entree des services.
 *
 * ⚠ `serviceSalarie` n'existe plus ici. `salarie.service.ts` appelle
 * directement `appelApi` (comme `partenaire.service.ts` et
 * `encaissement.service.ts`) : c'est `env.baseApi` qui bascule entre mocks et
 * API réelle, au niveau du client HTTP, pas d'une interface à deux
 * implémentations choisie ici. Importer les fonctions depuis
 * `@/lib/services/salarie.service` directement.
 *
 * `servicePartenaire` reste sur l'ancien schéma (interface + implémentation
 * simulée choisie ici) : c'est le service de RECHERCHE catalogue côté
 * salarié (`PartenairesSalarie.tsx`, `ChoixDuMinistre.tsx`), qui n'a aucune
 * route back à appeler pour l'instant — `GET /catalog` existe côté DTO et
 * logique de recherche (`core/src/partners/catalog.rs`), mais
 * `routes/catalog.rs` n'est toujours pas câblé. Rien à brancher tant que
 * cette route n'existe pas.
 */
import { env } from "@/lib/config/env";
import type { ServicePartenaire } from "./partenaire-salarie.service";
import { partenaireMock } from "@/mocks/adapters";

if (!env.utiliserMocks) {
  // La bascule reelle de servicePartenaire se branchera ici quand
  // `GET /catalog` sera cablee cote back. En attendant, un `NEXT_PUBLIC_USE_MOCKS=false`
  // doit echouer franchement plutot que d'appeler une route inexistante.
  throw new Error(
    "API réelle non branchée pour servicePartenaire (GET /catalog non câblée côté back). Laissez NEXT_PUBLIC_USE_MOCKS=true.",
  );
}

export const servicePartenaire: ServicePartenaire = partenaireMock;
