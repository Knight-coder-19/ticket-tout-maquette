import type { Categorie, Partenaire, Transaction } from "@/types/domaine";
/** Pagination par offset, propre a l'espace salarie. */
export interface ReponsePaginee<T> { elements: T[]; page: number; taillePage: number; total: number; }

export interface ServicePartenaire {
  listerCategories(): Promise<Categorie[]>;
  listerPartenaires(params: {
    page: number;
    categorieId?: string;
    recherche?: string;
  }): Promise<ReponsePaginee<Partenaire>>;
  /**
   * Encaissement. La cle d'idempotence est obligatoire :
   * un double scan ne doit pas debiter deux fois (T. Vignal).
   */
  encaisser(params: {
    codePaiement: string;
    montant: number;
    cleIdempotence: string;
  }): Promise<Transaction>;
}
