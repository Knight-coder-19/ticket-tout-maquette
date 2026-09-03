"use client";

import { useCallback, useEffect, useState } from "react";
import type { Solde } from "@/types/domaine";
import { serviceSalarie } from "@/lib/services";

type EtatSolde = {
  solde: Solde | null;
  chargement: boolean;
  erreur: string | null;
  rafraichir: () => Promise<void>;
};

/**
 * Le solde doit refleter la realite apres chaque operation.
 * Ce hook centralise la strategie de rafraichissement, de facon a ne pas
 * la disperser dans les composants.
 */
export function useSolde(salarieId: string): EtatSolde {
  const [solde, setSolde] = useState<Solde | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setSolde(await serviceSalarie.recupererSolde(salarieId));
    } catch {
      setErreur("Le solde n'a pas pu être récupéré. Réessayez.");
    } finally {
      setChargement(false);
    }
  }, [salarieId]);

  useEffect(() => {
    // Chargement initial : le setState est ici volontaire (recuperation de
    // donnees au montage), pas une synchronisation d'etat derive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void rafraichir();
  }, [rafraichir]);

  return { solde, chargement, erreur, rafraichir };
}
