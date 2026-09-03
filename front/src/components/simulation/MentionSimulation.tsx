import { MENTION_SIMULATION } from "@/lib/config/constantes";
import styles from "./simulation.module.css";

/** Note courte a placer sous une valeur mise en avant (ex. la carte solde). */
export function MentionSimulation() {
  return <p className={styles.mention}>{MENTION_SIMULATION}.</p>;
}
