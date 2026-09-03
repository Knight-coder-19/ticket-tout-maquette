/**
 * Point d'entree des services.
 * Selon NEXT_PUBLIC_USE_MOCKS, l'application recoit soit l'implementation
 * reelle, soit l'implementation simulee. Les deux respectent la meme
 * interface, ce qui permet a l'equipe front d'avancer sans backend
 * sans construire une architecture differente de celle de production.
 */
import { env } from "@/lib/config/env";
import type { ServiceSalarie } from "./salarie.service";
import type { ServicePartenaire } from "./partenaire.service";
import { salarieMock, partenaireMock } from "@/mocks/adapters";

if (!env.utiliserMocks) {
  // Les implementations HTTP reelles se brancheront ici quand l'API sera
  // disponible. En attendant, une bascule vers l'API doit echouer
  // franchement plutot que d'appeler des routes inexistantes.
  throw new Error(
    "API réelle non branchée. Laissez NEXT_PUBLIC_USE_MOCKS=true pour l'instant.",
  );
}

export const serviceSalarie: ServiceSalarie = salarieMock;
export const servicePartenaire: ServicePartenaire = partenaireMock;
