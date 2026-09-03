"use client";

import { useCallback, useEffect, useState } from "react";
import type { CodePaiement } from "@/types/domaine";
import { serviceSalarie } from "@/lib/services";
import { secondesRestantes } from "@/lib/utils/date";

type EtatCode = {
  code: CodePaiement | null;
  restant: number;
  expire: boolean;
  chargement: boolean;
  erreur: string | null;
  generer: () => Promise<void>;
};

/**
 * Cycle de vie du code de paiement : generation, compte a rebours,
 * expiration, regeneration.
 *
 * La regeneration en un geste repond a la demande du Ministre (ne pas
 * bloquer le salarie en caisse) sans allonger la duree de validite
 * au-dela des 5 minutes imposees par T. Vignal.
 */
export function useCodePaiement(salarieId: string): EtatCode {
  const [code, setCode] = useState<CodePaiement | null>(null);
  const [restant, setRestant] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const generer = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const nouveau = await serviceSalarie.genererCodePaiement(salarieId);
      setCode(nouveau);
      setRestant(secondesRestantes(nouveau.expireLe));
    } catch {
      setErreur("Le code n'a pas pu être généré. Réessayez.");
    } finally {
      setChargement(false);
    }
  }, [salarieId]);

  useEffect(() => {
    if (!code) return;
    const minuteur = setInterval(() => {
      setRestant(secondesRestantes(code.expireLe));
    }, 1000);
    return () => clearInterval(minuteur);
  }, [code]);

  return {
    code,
    restant,
    expire: code !== null && restant === 0,
    chargement,
    erreur,
    generer,
  };
}
