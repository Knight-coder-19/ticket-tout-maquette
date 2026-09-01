import type { DemandePartenaire } from "@/types/domaine";
import type { ReponsePaginee } from "@/types/api";

export interface ServiceAdministration {
  listerDemandes(page: number): Promise<ReponsePaginee<DemandePartenaire>>;
  /**
   * Le motif est obligatoire, y compris pour une acceptation.
   * Un refus sans motif enregistre n'est pas opposable (F. Pontaillac).
   */
  deciderDemande(params: {
    demandeId: string;
    decision: "valide" | "refuse";
    motif: string;
  }): Promise<DemandePartenaire>;
  mettreEnAvant(partenaireId: string, actif: boolean): Promise<void>;
}
