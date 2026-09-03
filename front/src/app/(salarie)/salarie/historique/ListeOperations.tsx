import type { Transaction } from "@/types/domaine";
import { LigneOperation } from "../LigneOperation";
import styles from "../salarie.module.css";

export function ListeOperations({ operations }: { operations: Transaction[] }) {
  return (
    <ul className={styles.liste}>
      {operations.map((op) => (
        <LigneOperation key={op.id} transaction={op} />
      ))}
    </ul>
  );
}
