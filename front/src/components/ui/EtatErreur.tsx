import { Bouton } from "./Bouton";
import { Icone } from "./Icone";
import styles from "./ui.module.css";

/** Etat "erreur reseau". Toujours proposer de reessayer. */
export function EtatErreur({
  message = "Une erreur est survenue.",
  onReessayer,
}: {
  message?: string;
  onReessayer?: () => void;
}) {
  return (
    <div className={styles.etatVide} role="alert">
      <Icone nom="info" taille={28} style={{ color: "var(--couleur-alerte)" }} />
      <p style={{ fontFamily: "var(--police-titre)", color: "var(--couleur-texte)" }}>{message}</p>
      {onReessayer ? (
        <Bouton variante="secondaire" onClick={onReessayer}>
          <Icone nom="actualiser" taille={16} />
          Réessayer
        </Bouton>
      ) : null}
    </div>
  );
}
