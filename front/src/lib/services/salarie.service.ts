import type { CodePaiement, Solde, Transaction } from "@/types/domaine";
import type { ReponsePaginee } from "@/types/api";

/**
 * Contrat du service salarie.
 * L'implementation reelle et l'implementation simulee respectent
 * exactement cette interface.
 */
export interface ServiceSalarie {
  recupererSolde(salarieId: string): Promise<Solde>;
  recupererTransactions(
    salarieId: string,
    page: number,
  ): Promise<ReponsePaginee<Transaction>>;
  genererCodePaiement(salarieId: string): Promise<CodePaiement>;
}
