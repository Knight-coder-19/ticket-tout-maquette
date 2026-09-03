import { Carte } from "@/components/ui/Carte";
import { EtatVide } from "@/components/ui/EtatVide";

/**
 * Historique des demandes traitees. Vide tant que le service de reclamations
 * n'est pas branche (equipe backend).
 */
export function ListeDemandes() {
  return (
    <Carte titre="Demandes traitées">
      <EtatVide icone="demandes" titre="Aucune demande archivée" />
    </Carte>
  );
}
