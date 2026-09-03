import type { MontantCentimes } from "@/types/domaine";
import { formaterMontant } from "@/lib/utils/montant";
import { MENTION_SIMULATION } from "@/lib/config/constantes";
import styles from "./simulation.module.css";

/**
 * Seul point d'affichage d'une valeur monetaire dans l'application.
 * Toute autre facon d'afficher un montant doit etre refusee en revue de code
 * (ARCHITECTURE.md, regle 3) : c'est ce qui garantit que la mention de
 * simulation accompagne systematiquement la valeur (F. Pontaillac).
 *
 * `marqueur` (defaut true) ajoute un "· simulation" visible a cote de la
 * valeur. On peut le mettre a false dans un tableau dense a condition qu'une
 * <MentionSimulation> ou un <BandeauSimulation> reste visible a l'ecran.
 */
export function Montant({
  centimes,
  marqueur = true,
}: {
  centimes: MontantCentimes;
  marqueur?: boolean;
}) {
  return (
    <span className={styles.montant}>
      {formaterMontant(centimes)}
      {marqueur ? (
        <span className={styles.marque} aria-hidden>
          · sim.
        </span>
      ) : null}
      <span className="sr-only"> ({MENTION_SIMULATION})</span>
    </span>
  );
}
