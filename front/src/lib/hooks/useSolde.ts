"use client";

import { useCallback, useEffect, useState } from "react";
import type { Solde } from "@/types/domaine";
import { lireSolde } from "@/lib/services/salarie.service";

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
 *
 * Aucun identifiant en paramètre : `GET /me/balance` est scopé à la session,
 * pas à un salarié passé en argument (le back n'a d'ailleurs aucune route
 * qui accepte un `salarieId` dans l'URL côté espace employé).
 */
export function useSolde(): EtatSolde {
  const [solde, setSolde] = useState<Solde | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setSolde(await lireSolde());
    } catch {
      setErreur("Le solde n'a pas pu être récupéré. Réessayez.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    // Chargement initial : le setState est ici volontaire (recuperation de
    // donnees au montage), pas une synchronisation d'etat derive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void rafraichir();
  }, [rafraichir]);

  return { solde, chargement, erreur, rafraichir };
}
