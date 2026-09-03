"use client";

/**
 * Le tableau de bord national.
 *
 * ✅ `GET /admin/dashboard` est du contrat (`data-dictionary.md:561-573`) —
 * voir la route pour les deux ajouts (`by_category`, `weekly`) et pourquoi
 * le DTO seul ne suffisait pas à servir cet écran en entier.
 *
 * Six pièces : ce qui attend une action (`BandeauFlux`), les cinq chiffres
 * clés (`TuilesNationales`), la répartition géographique et par catégorie
 * (`RepartitionGeographique`, `RepartitionCategories`), le rythme
 * hebdomadaire (`VolumeHebdomadaire`).
 */

import "@/styles/primitives.css";
import "@/styles/tableau-de-bord-national.css";

import { useCallback, useEffect, useState } from "react";

import { BandeauFlux } from "./BandeauFlux";
import { RepartitionCategories } from "./RepartitionCategories";
import { RepartitionGeographique } from "./RepartitionGeographique";
import { TuilesNationales } from "./TuilesNationales";
import { VolumeHebdomadaire } from "./VolumeHebdomadaire";
import { FiltrePeriode, type Periode } from "@/components/filtres/FiltrePeriode";
import { lireTableauDeBordNational } from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { TableauDeBordNational as DonneesTableauDeBord } from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

type Etat =
  | { phase: "chargement" }
  | { phase: "prete"; donnees: DonneesTableauDeBord }
  | { phase: "echec"; message: string };

/** `YYYY-MM-DD` → instant ISO, borne incluse. */
function enBornes(periode: Periode): { depuis?: string; jusqua?: string } {
  return {
    ...(periode.depuis !== "" ? { depuis: `${periode.depuis}T00:00:00.000Z` } : {}),
    ...(periode.jusqua !== "" ? { jusqua: `${periode.jusqua}T23:59:59.999Z` } : {}),
  };
}

export function TableauDeBordNational() {
  const [periode, setPeriode] = useState<Periode>({ depuis: "", jusqua: "" });
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });

  const charger = useCallback(async (aAppliquer: Periode): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const donnees = await lireTableauDeBordNational(enBornes(aAppliquer));
      setEtat({ phase: "prete", donnees });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger(periode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charger, periode.depuis, periode.jusqua]);

  return (
    <div className="tableau-national">
      <h1 className="ecran__titre">Tableau de bord national</h1>

      <BandeauFlux />

      <FiltrePeriode
        periode={periode}
        onChanger={setPeriode}
        sansFiltre="les huit dernières semaines sont affichées."
      />

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Lecture du tableau de bord…</p>
          <span className="silhouette silhouette--titre" />
          <span className="silhouette silhouette--ligne" />
        </div>
      )}

      {etat.phase === "echec" && (
        <div className="etat etat--echec" role="alert">
          <p>{etat.message}</p>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => void charger(periode)}
          >
            Réessayer
          </button>
        </div>
      )}

      {etat.phase === "prete" && (
        <>
          <TuilesNationales chiffres={etat.donnees.chiffres} />
          <VolumeHebdomadaire semaines={etat.donnees.semaines} />
          <RepartitionGeographique
            parVille={etat.donnees.parVille}
            enLigne={etat.donnees.enLigne}
          />
          <RepartitionCategories parCategorie={etat.donnees.parCategorie} />
        </>
      )}
    </div>
  );
}
