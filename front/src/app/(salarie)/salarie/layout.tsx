import type { ReactNode } from "react";
import { RailSalarie } from "./RailSalarie";
import styles from "./salarie.module.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.espace}>
      <a href="#contenu-salarie" className="lien-evitement">
        Aller au contenu
      </a>
      <RailSalarie />
      <main id="contenu-salarie" className={styles.contenu}>
        {children}
      </main>
    </div>
  );
}
