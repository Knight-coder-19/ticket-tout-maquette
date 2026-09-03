"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CodePaiement } from "@/types/domaine";
import { annulerCodePaiement, genererCodePaiement } from "@/lib/services/salarie.service";
import { secondesRestantes } from "@/lib/utils/date";

type EtatCode = {
  code: CodePaiement | null;
  restant: number;
  expire: boolean;
  chargement: boolean;
  erreur: string | null;
  /** `montantCentimes` : le salarié le fixe à l'émission (D4), pas le partenaire. */
  generer: (montantCentimes: number) => Promise<void>;
};

/**
 * Cycle de vie du code de paiement : generation, compte a rebours,
 * expiration, regeneration.
 *
 * La regeneration en un geste repond a la demande du Ministre (ne pas
 * bloquer le salarie en caisse) sans allonger la duree de validite
 * au-dela des 5 minutes imposees par T. Vignal.
 *
 * ⚠ Annule le jeton précédent avant d'en émettre un nouveau. Sans ça, un
 * salarié qui régénère laisse le montant du jeton abandonné réservé
 * (`held`) jusqu'à son expiration naturelle — le disponible affiché
 * mentirait pendant jusqu'à 5 minutes. `DELETE /me/payment-tokens/{jti}`
 * existe précisément pour rendre cette réservation tout de suite.
 */
export function useCodePaiement(): EtatCode {
  const [code, setCode] = useState<CodePaiement | null>(null);
  const [restant, setRestant] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const jtiActif = useRef<string | null>(null);

  const generer = useCallback(async (montantCentimes: number) => {
    setChargement(true);
    setErreur(null);
    try {
      if (jtiActif.current !== null) {
        try {
          await annulerCodePaiement(jtiActif.current);
        } catch {
          /* Déjà expiré ou consommé entre-temps : pas une raison de
             bloquer la nouvelle émission, seulement de ne plus y compter. */
        }
        jtiActif.current = null;
      }

      const emis = await genererCodePaiement(montantCentimes);
      jtiActif.current = emis.jti;
      setCode(emis.code);
      setRestant(secondesRestantes(emis.code.expireLe));
    } catch {
      setErreur("Le code n'a pas pu être généré. Réessayez.");
    } finally {
      setChargement(false);
    }
  }, []);

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
