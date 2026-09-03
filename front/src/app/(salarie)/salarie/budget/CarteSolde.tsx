import type { Solde } from "@/types/domaine";
import { CarteVisuelle } from "@/components/marque/CarteVisuelle";
import { Montant } from "@/components/simulation/Montant";
import { MentionSimulation } from "@/components/simulation/MentionSimulation";
import { Chargement } from "@/components/ui/Chargement";
import { EtatErreur } from "@/components/ui/EtatErreur";
import { formaterDateHeure } from "@/lib/utils/date";
import styles from "../salarie.module.css";

export function CarteSolde({
  solde,
  chargement,
  erreur,
  onReessayer,
}: {
  solde: Solde | null;
  chargement: boolean;
  erreur: string | null;
  onReessayer: () => void;
}) {
  if (erreur) {
    return (
      <div className={styles.soldeAttente}>
        <EtatErreur message={erreur} onReessayer={onReessayer} />
      </div>
    );
  }

  if (chargement && !solde) {
    return (
      <div className={styles.soldeAttente}>
        <Chargement libelle="Calcul du solde…" />
      </div>
    );
  }

  if (!solde) return null;

  return (
    <CarteVisuelle entete={<span className={styles.soldeMarquePuce}>Carte salarié</span>}>
      <div aria-live="polite">
        <p className={styles.soldeLibelle}>Solde disponible</p>
        <p className={styles.soldeValeur}>
          <Montant centimes={solde.montant} />
        </p>
        {/* Formulation positive demandee par le Ministre : pas "restants". */}
        <p className={styles.soldePhrase}>à dépenser chez vos partenaires référencés.</p>
        <p className={styles.soldeMaj}>Mis à jour le {formaterDateHeure(solde.misAJourLe)}</p>
        <div className={styles.soldeMention}>
          <MentionSimulation />
        </div>
      </div>
    </CarteVisuelle>
  );
}
