"use client";

/**
 * Le journal des encaissements du commerçant.
 *
 * Un registre, comme les comptes de l'administration : un tableau qu'on filtre
 * et qu'on balaye. Le tableau défilant, la barre de filtres et les états
 * viennent de `primitives.css` — partagés, jamais recopiés.
 */

import "@/styles/primitives.css";
import "@/styles/transactions.css";

import { useCallback, useEffect, useState } from "react";

import { ExportCsv } from "./ExportCsv";
import { FiltrePeriode, type Periode } from "./FiltrePeriode";
import { TableauEncaissements } from "./TableauEncaissements";
import {
  listerEncaissements,
  type FiltresEncaissements,
} from "@/lib/services/partenaire.service";
import { ErreurService } from "@/types/erreurs";
import type { LigneEncaissement } from "@/types/encaissement";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  partner_not_approved:
    "Votre établissement n'est pas agréé. Contactez l'administration du dispositif.",
  validation_failed: "La période demandée n'est pas valide.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

type Etat =
  | { phase: "chargement" }
  | { phase: "prete" }
  | { phase: "echec"; message: string };

/** Les bornes de l'écran, en instants ISO 8601 pour le serveur. */
function enFiltres(periode: Periode): FiltresEncaissements {
  return {
    ...(periode.depuis !== "" ? { depuis: `${periode.depuis}T00:00:00.000Z` } : {}),
    ...(periode.jusqua !== "" ? { jusqua: `${periode.jusqua}T23:59:59.999Z` } : {}),
  };
}

export function TransactionsPartenaire() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [lignes, setLignes] = useState<LigneEncaissement[]>([]);
  const [periode, setPeriode] = useState<Periode>({ depuis: "", jusqua: "" });

  /* Le curseur de la page suivante. `null` = on tient tout le journal. */
  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);
  const [suiteEnCours, setSuiteEnCours] = useState(false);

  const charger = useCallback(async (aAppliquer: Periode): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const page = await listerEncaissements(enFiltres(aAppliquer));
      setLignes(page.lignes);
      setCurseurSuivant(page.curseurSuivant);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger(periode);
    /* `periode` est un objet reconstruit à chaque rendu ; le dépendre en entier
       relancerait la requête sans fin. Ses deux valeurs suffisent. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charger, periode.depuis, periode.jusqua]);

  /**
   * Charge la suite du journal.
   *
   * ⚠ LA PAGINATION NE TRONQUE JAMAIS EN SILENCE. La route sert 20 lignes par
   * page (`extractors/pagination.rs:1-3`). Un journal qui s'arrêterait là sans
   * le dire ferait croire au commerçant qu'il a vu son mois entier — c'est le
   * défaut trouvé sur le registre de l'administration. Le tableau annonce donc
   * s'il est complet, et ce bouton n'apparaît que s'il reste quelque chose.
   */
  const chargerLaSuite = useCallback(async (): Promise<void> => {
    if (curseurSuivant === null) return;
    setSuiteEnCours(true);
    try {
      const page = await listerEncaissements(enFiltres(periode), curseurSuivant);
      setLignes((deja) => [...deja, ...page.lignes]);
      setCurseurSuivant(page.curseurSuivant);
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    } finally {
      setSuiteEnCours(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curseurSuivant, periode.depuis, periode.jusqua]);

  return (
    <div className="journal-partenaire">
      <h1 className="journal-partenaire__titre">Mes encaissements</h1>
      <p className="journal-partenaire__intro">
        Tous les paiements encaissés par votre établissement, le plus récent
        d&apos;abord. Un encaissement annulé par l&apos;administration reste au
        journal, marqué comme tel.
      </p>

      <FiltrePeriode periode={periode} onChanger={setPeriode} />

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Chargement de vos encaissements…</p>
          <span className="silhouette silhouette--titre" />
          <span className="silhouette silhouette--ligne" />
          <span className="silhouette silhouette--courte" />
        </div>
      )}

      {etat.phase === "echec" && (
        <div className="etat etat--echec" role="alert">
          <h2>Vos encaissements n&apos;ont pas pu être chargés</h2>
          <p>{etat.message}</p>
          <p>
            Rien n&apos;est perdu : vos encaissements sont au registre, et une
            lecture qui échoue n&apos;y change rien.
          </p>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => void charger(periode)}
          >
            Réessayer
          </button>
        </div>
      )}

      {etat.phase === "prete" && lignes.length === 0 && (
        <div className="etat">
          <h2>Aucun encaissement</h2>
          <p>
            {periode.depuis === "" && periode.jusqua === ""
              ? "Vous n'avez pas encore encaissé de paiement. Ils apparaîtront ici dès le premier."
              : "Aucun encaissement sur cette période. Élargissez-la ou affichez tout."}
          </p>
        </div>
      )}

      {etat.phase === "prete" && lignes.length > 0 && (
        <>
          <TableauEncaissements lignes={lignes} resteAVenir={curseurSuivant !== null} />

          {curseurSuivant !== null && (
            <p className="filtres__etat">
              <button
                type="button"
                className="bouton bouton--discret"
                onClick={() => void chargerLaSuite()}
                disabled={suiteEnCours}
              >
                {suiteEnCours ? "Chargement…" : "Charger les encaissements plus anciens"}
              </button>
            </p>
          )}

          <ExportCsv lignes={lignes} complet={curseurSuivant === null} />
        </>
      )}
    </div>
  );
}
