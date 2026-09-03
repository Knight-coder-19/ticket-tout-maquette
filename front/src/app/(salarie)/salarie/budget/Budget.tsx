"use client";

import { BandeauSimulation } from "@/components/simulation/BandeauSimulation";
import { useSolde } from "@/lib/hooks/useSolde";
import { salariePrincipal } from "@/mocks/fixtures/salaries";
import styles from "../salarie.module.css";
import { CarteSolde } from "./CarteSolde";
import { ActionsRapides } from "./ActionsRapides";
import { DernieresOperations } from "./DernieresOperations";
import { ChoixDuMinistre } from "./ChoixDuMinistre";

export function Budget() {
  const { solde, chargement, erreur, rafraichir } = useSolde();

  return (
    <>
      <header className={styles.enTete}>
        <h1>Bonjour {salariePrincipal.nom.split(" ")[0]}</h1>
        <p>Votre budget Ticket Tout et vos transactions récentes.</p>
      </header>

      <div className={styles.pile}>
        <BandeauSimulation />
        <CarteSolde solde={solde} chargement={chargement} erreur={erreur} onReessayer={rafraichir} />
        <ActionsRapides />
        <DernieresOperations />
        <ChoixDuMinistre />
      </div>
    </>
  );
}
