import Link from "next/link";
import { Logo } from "@/components/marque/Logo";
import styles from "@/components/marque/marque.module.css";

/**
 * Rail minimal : l'espace partenaire n'est pas encore construit, mais le
 * logotype Ticket Tout doit etre present dans les trois espaces (mail Sellami).
 */
export function RailPartenaire() {
  return (
    <nav className={styles.railStub} aria-label="Espace partenaire">
      <Logo hauteur={22} mono />
      <span className={styles.railStubSim}>simulation</span>
      <p className={styles.railStubEspace}>Espace partenaire</p>
      <Link href="/" className={styles.railStubLien}>
        Retour à l&apos;accueil
      </Link>
    </nav>
  );
}
