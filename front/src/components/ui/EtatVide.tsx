import type { ReactNode } from "react";
import { Icone, type NomIcone } from "./Icone";
import styles from "./ui.module.css";

/**
 * Etat "donnees absentes". Un ecran qui ne traite que le cas nominal
 * n'est pas termine (ARCHITECTURE.md).
 */
export function EtatVide({
  icone = "info",
  titre,
  children,
}: {
  icone?: NomIcone;
  titre: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.etatVide}>
      <Icone nom={icone} taille={28} className={styles.etatVideIcone} />
      <p style={{ fontFamily: "var(--police-titre)", color: "var(--couleur-texte)" }}>{titre}</p>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
