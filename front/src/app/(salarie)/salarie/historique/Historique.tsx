"use client";

import { useEffect, useMemo, useState } from "react";
import type { Transaction } from "@/types/domaine";
import { BandeauSimulation } from "@/components/simulation/BandeauSimulation";
import { Carte } from "@/components/ui/Carte";
import { Bouton } from "@/components/ui/Bouton";
import { Chargement } from "@/components/ui/Chargement";
import { EtatErreur } from "@/components/ui/EtatErreur";
import { EtatVide } from "@/components/ui/EtatVide";
import { serviceSalarie } from "@/lib/services";
import { usePagination } from "@/lib/hooks/usePagination";
import { clefMois } from "@/lib/utils/date";
import { salariePrincipal } from "@/mocks/fixtures/salaries";
import styles from "../salarie.module.css";
import { ListeOperations } from "./ListeOperations";
import { FiltreMois } from "./FiltreMois";

const PAR_PAGE = 6;

export function Historique() {
  const [toutes, setToutes] = useState<Transaction[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mois, setMois] = useState<string>("tous");

  async function charger() {
    setErreur(null);
    setToutes(null);
    try {
      const premiere = await serviceSalarie.recupererTransactions(salariePrincipal.id, 1);
      const pages = Math.max(1, Math.ceil(premiere.total / premiere.taillePage));
      const suite = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) =>
          serviceSalarie.recupererTransactions(salariePrincipal.id, i + 2),
        ),
      );
      setToutes([premiere, ...suite].flatMap((p) => p.elements));
    } catch {
      setErreur("L'historique n'a pas pu être chargé.");
    }
  }

  useEffect(() => {
    // Chargement initial des donnees au montage (setState volontaire).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, []);

  const moisDisponibles = useMemo(() => {
    if (!toutes) return [];
    return [...new Set(toutes.map((t) => clefMois(t.date)))].sort().reverse();
  }, [toutes]);

  const filtrees = useMemo(() => {
    if (!toutes) return [];
    return mois === "tous" ? toutes : toutes.filter((t) => clefMois(t.date) === mois);
  }, [toutes, mois]);

  const pagination = usePagination(filtrees.length, PAR_PAGE);
  const debut = (pagination.page - 1) * PAR_PAGE;
  const pageCourante = filtrees.slice(debut, debut + PAR_PAGE);

  return (
    <>
      <header className={styles.enTete}>
        <h1>Historique des opérations</h1>
        <p>Toutes vos transactions, les plus récentes en premier.</p>
      </header>

      <div className={styles.pile}>
        <BandeauSimulation />

        {erreur ? (
          <EtatErreur message={erreur} onReessayer={charger} />
        ) : toutes === null ? (
          <Chargement libelle="Chargement de l'historique…" />
        ) : (
          <Carte>
            <div className={styles.barreFiltres}>
              <FiltreMois
                valeur={mois}
                options={moisDisponibles}
                onChange={(v) => {
                  setMois(v);
                  pagination.allerA(1);
                }}
              />
            </div>

            {pageCourante.length === 0 ? (
              <EtatVide icone="historique" titre="Aucune opération sur cette période" />
            ) : (
              <>
                <ListeOperations operations={pageCourante} />
                {pagination.nombrePages > 1 ? (
                  <div className={styles.pagination}>
                    <Bouton
                      variante="secondaire"
                      onClick={pagination.precedente}
                      disabled={pagination.page === 1}
                    >
                      Précédent
                    </Bouton>
                    <span>
                      Page {pagination.page} sur {pagination.nombrePages}
                    </span>
                    <Bouton
                      variante="secondaire"
                      onClick={pagination.suivante}
                      disabled={pagination.page === pagination.nombrePages}
                    >
                      Suivant
                    </Bouton>
                  </div>
                ) : null}
              </>
            )}
          </Carte>
        )}
      </div>
    </>
  );
}
