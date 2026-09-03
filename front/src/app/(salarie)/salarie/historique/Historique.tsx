"use client";

import { useEffect, useMemo, useState } from "react";
import type { Transaction } from "@/types/domaine";
import { BandeauSimulation } from "@/components/simulation/BandeauSimulation";
import { Carte } from "@/components/ui/Carte";
import { Bouton } from "@/components/ui/Bouton";
import { Chargement } from "@/components/ui/Chargement";
import { EtatErreur } from "@/components/ui/EtatErreur";
import { EtatVide } from "@/components/ui/EtatVide";
import { listerTransactions } from "@/lib/services/salarie.service";
import { usePagination } from "@/lib/hooks/usePagination";
import { clefMois } from "@/lib/utils/date";
import styles from "../salarie.module.css";
import { ListeOperations } from "./ListeOperations";
import { FiltreMois } from "./FiltreMois";

const PAR_PAGE = 6;
const TAILLE_LOT_RESEAU = 20;
/**
 * Garde-fou sur le nombre de lignes ramenées avant de filtrer par mois côté
 * client. `Paginated<T>` ne porte aucun `total` (D10) : impossible de savoir
 * à l'avance combien de lots un relevé complet demande, donc on plafonne
 * plutôt que de marcher le curseur indéfiniment sur un compte très actif.
 */
const PLAFOND_LIGNES = 500;

export function Historique() {
  const [toutes, setToutes] = useState<Transaction[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mois, setMois] = useState<string>("tous");

  async function charger() {
    setErreur(null);
    setToutes(null);
    try {
      const lignes: Transaction[] = [];
      let curseur: string | undefined;
      do {
        const page = await listerTransactions(curseur, TAILLE_LOT_RESEAU);
        lignes.push(...page.lignes);
        curseur = page.curseurSuivant ?? undefined;
      } while (curseur !== undefined && lignes.length < PLAFOND_LIGNES);
      setToutes(lignes);
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
