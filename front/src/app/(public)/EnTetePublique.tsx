import Link from "next/link";
import { Logo } from "@/components/marque/Logo";
import styles from "@/components/marque/marque.module.css";

export function EnTetePublique() {
  return (
    <header className={styles.entetePublique}>
      <Link href="/" aria-label="Ticket Tout, accueil">
        <Logo hauteur={24} />
      </Link>
      <span className={styles.entetePubliqueSim}>simulation</span>
    </header>
  );
}
