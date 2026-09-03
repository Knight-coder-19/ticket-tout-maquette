import type { Transaction } from "@/types/domaine";
import { Montant } from "@/components/simulation/Montant";
import { Pastille } from "@/components/ui/Pastille";
import { formaterDateHeure } from "@/lib/utils/date";
import styles from "./salarie.module.css";

const libelleStatut: Record<Transaction["statut"], { texte: string; ton: "neutre" | "alerte" | "succes" }> = {
  validee: { texte: "Validée", ton: "neutre" },
  annulee: { texte: "Annulée", ton: "alerte" },
  contre_ecriture: { texte: "Correction", ton: "succes" },
};

export function LigneOperation({
  transaction,
  marqueurMontant = false,
}: {
  transaction: Transaction;
  marqueurMontant?: boolean;
}) {
  const statut = libelleStatut[transaction.statut];
  const correction = transaction.statut === "contre_ecriture";

  return (
    <li className={styles.ligne}>
      <div className={styles.ligneInfos}>
        <p className={styles.ligneTitre}>{transaction.partenaireNom}</p>
        <p className={styles.ligneMeta}>{formaterDateHeure(transaction.date)}</p>
      </div>
      <div className={styles.ligneDroite}>
        <Pastille ton={statut.ton}>{statut.texte}</Pastille>
        <span className={correction ? styles.contreEcriture : undefined}>
          {correction ? "+ " : null}
          <Montant centimes={Math.abs(transaction.montant)} marqueur={marqueurMontant} />
        </span>
      </div>
    </li>
  );
}
