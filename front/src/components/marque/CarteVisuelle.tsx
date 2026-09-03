import type { ReactNode } from "react";
import { Logo } from "./Logo";
import styles from "./marque.module.css";

/**
 * La carte Ticket Tout telle qu'elle s'affiche dans l'interface.
 * Meme objet visuel au repos (solde) et au moment du paiement : degrade
 * institutionnel, halo ambre, echo de perforation du logo, bloc-marque en
 * haut. C'est la carte que le brand book montre en situation.
 */
export function CarteVisuelle({
  entete,
  children,
}: {
  entete?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.carte}>
      <div className={styles.carteHalo} aria-hidden />
      <div className={styles.cartePerfo} aria-hidden />
      <div className={styles.carteEntete}>
        <Logo hauteur={18} mono />
        {entete}
      </div>
      <div className={styles.carteCorps}>{children}</div>
    </div>
  );
}
