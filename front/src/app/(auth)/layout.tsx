import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/marque/Logo";
import styles from "@/components/marque/marque.module.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className={styles.authEntete}>
        <Link href="/" aria-label="Ticket Tout, accueil">
          <Logo hauteur={26} />
        </Link>
      </div>
      <main className="auth">{children}</main>
    </>
  );
}
