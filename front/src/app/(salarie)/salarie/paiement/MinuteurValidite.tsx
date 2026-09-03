import { formaterMinutage } from "@/lib/utils/date";
import styles from "../salarie.module.css";

/** Compte a rebours de validite. `restant` et `total` en secondes. */
export function MinuteurValidite({ restant, total }: { restant: number; total: number }) {
  const proportion = total > 0 ? Math.max(0, Math.min(1, restant / total)) : 0;
  const alerte = restant > 0 && restant <= 30;

  return (
    <div className={`${styles.minuteur} ${alerte ? styles.minuteurAlerte : ""}`}>
      <span className={styles.minuteurValeur} aria-live="polite">
        {restant > 0 ? `Expire dans ${formaterMinutage(restant)}` : "Expiré"}
      </span>
      <span
        className={styles.minuteurBarre}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={restant}
        aria-label="Temps de validité restant"
      >
        <span className={styles.minuteurJauge} style={{ width: `${proportion * 100}%` }} />
      </span>
    </div>
  );
}
