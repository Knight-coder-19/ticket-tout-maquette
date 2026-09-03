"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Logo } from "@/components/marque/Logo";
import { salariePrincipal } from "@/mocks/fixtures/salaries";
import styles from "./salarie.module.css";

const liens: { href: string; libelle: string; icone: NomIcone }[] = [
  { href: "/salarie", libelle: "Mon budget", icone: "solde" },
  { href: "/salarie/paiement", libelle: "Payer", icone: "paiement" },
  { href: "/salarie/historique", libelle: "Historique", icone: "historique" },
  { href: "/salarie/partenaires", libelle: "Partenaires", icone: "partenaires" },
  { href: "/salarie/demandes", libelle: "Mes demandes", icone: "demandes" },
];

export function RailSalarie() {
  const chemin = usePathname();

  return (
    <nav className={styles.rail} aria-label="Navigation de l'espace salarié">
      <div className={styles.railMarque}>
        <Logo hauteur={22} />
        <span className={styles.railSim}>simulation</span>
      </div>

      {liens.map((lien) => {
        const actif =
          lien.href === "/salarie" ? chemin === "/salarie" : chemin.startsWith(lien.href);
        return (
          <Link
            key={lien.href}
            href={lien.href}
            aria-current={actif ? "page" : undefined}
            className={`${styles.railLien} ${actif ? styles.railLienActif : ""}`}
          >
            <Icone nom={lien.icone} taille={18} />
            {lien.libelle}
          </Link>
        );
      })}

      <div className={styles.railPied}>
        <p className={styles.railProfil}>
          {salariePrincipal.nom}
          <br />
          {salariePrincipal.employeur}
        </p>
        <Link href="/connexion" className={styles.railLien}>
          <Icone nom="deconnexion" taille={18} />
          Se déconnecter
        </Link>
      </div>
    </nav>
  );
}
