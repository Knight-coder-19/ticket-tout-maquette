import type { ServiceSalarie } from "@/lib/services/salarie.service";
import { magasin } from "../magasin";

/** Petite latence pour rendre visibles les etats de chargement. */
function latence<T>(valeur: T, ms = 260): Promise<T> {
  return new Promise((resoudre) => setTimeout(() => resoudre(valeur), ms));
}

export const salarieMock: ServiceSalarie = {
  recupererSolde() {
    return latence(magasin.lireSolde());
  },

  recupererTransactions(_salarieId, page) {
    return latence(magasin.lireTransactions(page, 6));
  },

  genererCodePaiement() {
    return latence(magasin.genererCode(), 420);
  },
};
