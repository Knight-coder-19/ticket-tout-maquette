"use client";

/**
 * Le tableau de bord du commerçant : ce qu'il regarde en ouvrant son espace.
 *
 * Trois blocs, dans l'ordre où on les lit le matin : les quatre chiffres, le
 * rythme des deux semaines, les derniers encaissements. Rien d'autre — un
 * tableau de bord qui montre tout ne montre rien.
 */

import "@/styles/tableau-de-bord.css";
import "@/styles/comptes.css";

import { useCallback, useEffect, useState } from "react";

import { DerniersEncaissements } from "./DerniersEncaissements";
import { GraphiqueQuatorzeJours } from "./GraphiqueQuatorzeJours";
import { TuilesRecettes } from "./TuilesRecettes";
import { listerEcritures } from "@/lib/services/administration.service";
import {
  lireRecettesJournalieres,
  lireResume,
} from "@/lib/services/partenaire.service";
import { ErreurService } from "@/types/erreurs";
import type { EcritureRegistre } from "@/types/domaine";
import type { JourneeRecettes, ResumeActivite } from "@/types/encaissement";

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

interface Donnees {
  moisEnCours: ResumeActivite;
  serie: JourneeRecettes[];
  derniers: EcritureRegistre[];
}

type Etat =
  | { phase: "chargement" }
  | { phase: "prete"; donnees: Donnees }
  | { phase: "echec"; message: string };

/** Le premier instant du mois courant, en ISO 8601 UTC. */
function debutDuMois(maintenant: number): string {
  return `${new Date(maintenant).toISOString().slice(0, 7)}-01T00:00:00.000Z`;
}

/** Le premier instant du jour courant. */
function debutDuJour(maintenant: number): string {
  return `${new Date(maintenant).toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function TableauDeBordPartenaire() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });

  const charger = useCallback(async (): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const maintenant = Date.now();
      /*
       * Les quatre appels partent ensemble : les enchaîner ferait clignoter
       * l'écran quatre fois et retarderait le premier chiffre du temps cumulé
       * des trois autres.
       */
      const [moisEnCours, serie, journal] = await Promise.all([
        lireResume(debutDuMois(maintenant), new Date(maintenant).toISOString()),
        lireRecettesJournalieres(14),
        listerEcritures({ nature: "payment" }),
      ]);

      setEtat({
        phase: "prete",
        donnees: {
          moisEnCours,
          serie,
          /* Les cinq derniers CRÉDITS : un débit sur un compte partenaire
             serait une annulation, pas un encaissement. La route rend déjà les
             écritures du plus récent au plus ancien. */
          derniers: journal.ecritures.filter((e) => e.sens === "credit").slice(0, 5),
        },
      });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (etat.phase === "chargement") {
    return (
      <div className="bord">
        <h1 className="bord__titre">Tableau de bord</h1>
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Chargement de vos chiffres…</p>
          <span className="silhouette silhouette--titre" />
          <span className="silhouette silhouette--ligne" />
          <span className="silhouette silhouette--courte" />
        </div>
      </div>
    );
  }

  if (etat.phase === "echec") {
    return (
      <div className="bord">
        <h1 className="bord__titre">Tableau de bord</h1>
        <div className="etat etat--echec" role="alert">
          <h2>Vos chiffres n&apos;ont pas pu être chargés</h2>
          <p>{etat.message}</p>
          <p>
            Vos encaissements ne sont pas perdus : ils sont au registre, et une
            lecture qui échoue n&apos;y change rien.
          </p>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => void charger()}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const { moisEnCours, serie, derniers } = etat.donnees;

  /*
   * Les recettes du jour se lisent DANS LA SÉRIE, pas dans un cinquième appel :
   * le dernier jour de la série est aujourd'hui. Un appel de plus donnerait un
   * second chiffre qui pourrait diverger du premier entre deux requêtes.
   */
  const aujourdhui = debutDuJour(Date.now()).slice(0, 10);
  const recettesDuJour = serie.find((j) => j.jour === aujourdhui)?.total ?? 0;

  return (
    <div className="bord">
      <h1 className="bord__titre">Tableau de bord</h1>
      <p className="bord__intro">
        Vos recettes du jour et du mois, le rythme des deux dernières semaines,
        et vos derniers encaissements.
      </p>

      <TuilesRecettes
        recettesDuJour={recettesDuJour}
        recettesDuMois={moisEnCours.total}
        encaissementsDuMois={moisEnCours.nombre}
      />

      <GraphiqueQuatorzeJours serie={serie} />

      <DerniersEncaissements encaissements={derniers} />
    </div>
  );
}
