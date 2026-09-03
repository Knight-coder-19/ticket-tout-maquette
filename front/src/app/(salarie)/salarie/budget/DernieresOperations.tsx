"use client";

import { useEffect, useState } from "react";
import type { Transaction } from "@/types/domaine";
import { Carte } from "@/components/ui/Carte";
import { Bouton } from "@/components/ui/Bouton";
import { Chargement } from "@/components/ui/Chargement";
import { EtatVide } from "@/components/ui/EtatVide";
import { listerTransactions } from "@/lib/services/salarie.service";
import { LigneOperation } from "../LigneOperation";
import styles from "../salarie.module.css";

export function DernieresOperations() {
  const [operations, setOperations] = useState<Transaction[] | null>(null);

  useEffect(() => {
    let vivant = true;
    listerTransactions(undefined, 4)
      .then((page) => {
        if (vivant) setOperations(page.lignes);
      })
      .catch(() => {
        if (vivant) setOperations([]);
      });
    return () => {
      vivant = false;
    };
  }, []);

  return (
    <Carte
      titre="Transactions récentes"
      action={
        <Bouton href="/salarie/historique" variante="discret">
          Tout l&apos;historique
        </Bouton>
      }
    >
      {operations === null ? (
        <Chargement />
      ) : operations.length === 0 ? (
        <EtatVide icone="historique" titre="Aucune opération pour le moment" />
      ) : (
        <ul className={styles.liste}>
          {operations.map((op) => (
            <LigneOperation key={op.id} transaction={op} />
          ))}
        </ul>
      )}
    </Carte>
  );
}
