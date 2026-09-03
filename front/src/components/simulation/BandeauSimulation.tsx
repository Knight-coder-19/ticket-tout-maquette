import { Icone } from "@/components/ui/Icone";
import styles from "./simulation.module.css";

/**
 * Bandeau visible en tete de tout ecran affichant une valeur monetaire.
 * C'est la mention "non dissimulee" exigee par F. Pontaillac ; le composant
 * <Montant> porte le rappel au niveau de chaque valeur.
 */
export function BandeauSimulation() {
  return (
    <p className={styles.bandeau} role="note">
      <Icone nom="info" taille={16} />
      Démonstrateur : simulation fonctionnelle. Aucune valeur réelle ne circule,
      aucune transaction financière n&apos;est effectuée.
    </p>
  );
}
