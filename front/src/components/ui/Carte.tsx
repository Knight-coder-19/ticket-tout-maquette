import type { ReactNode } from "react";
import styles from "./ui.module.css";

/**
 * Conteneur de section. `titre` rend un <h2> ; passer `niveauTitre` pour
 * ajuster le niveau si la hierarchie de la page l'exige.
 */
export function Carte({
  titre,
  niveauTitre = 2,
  action,
  className,
  children,
}: {
  titre?: string;
  niveauTitre?: 2 | 3;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const Titre = (niveauTitre === 3 ? "h3" : "h2") as "h2" | "h3";
  return (
    <section className={[styles.carte, className ?? ""].filter(Boolean).join(" ")}>
      {(titre || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--espace-4)",
          }}
        >
          {titre ? <Titre className={styles.carteTitre}>{titre}</Titre> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
