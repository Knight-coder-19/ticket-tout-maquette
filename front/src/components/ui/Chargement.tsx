import styles from "./ui.module.css";

export function Chargement({ libelle = "Chargement…" }: { libelle?: string }) {
  return (
    <p className={styles.chargement} role="status">
      <span className={styles.spinner} aria-hidden />
      {libelle}
    </p>
  );
}
