"use client";

/**
 * Le répertoire des bénéficiaires.
 *
 * Recherche, filtre par statut et par employeur, pagination keyset. Le tableau
 * dit s'il est complet.
 *
 * ⚠ Il s'appuie sur des routes que NOUS proposons : le répertoire existe en
 * base (`employees`, `employers`, `employment_links`) et dans
 * `core/src/directory/`, mais la section 4 du contrat ne le lit nulle part.
 * Voir `app/api/v1/admin/employees/route.ts`.
 */

import "@/styles/primitives.css";
import "@/styles/beneficiaires.css";

import { useCallback, useEffect, useState } from "react";

import { RechercheSalaries, type FiltresRecherche } from "./RechercheSalaries";
import { TableauSalaries } from "./TableauSalaries";
import {
  listerBeneficiaires,
  listerEmployeurs,
  type FiltresRepertoire,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { EmployeurRepertoire, LigneRepertoire } from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  validation_failed: "Un des filtres n'est pas valide.",
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

const AUCUN: FiltresRecherche = { recherche: "", statut: "", employeurId: "" };

function enRequete(filtres: FiltresRecherche): FiltresRepertoire {
  return {
    ...(filtres.recherche !== "" ? { recherche: filtres.recherche.trim() } : {}),
    ...(filtres.statut !== "" ? { statut: filtres.statut } : {}),
    ...(filtres.employeurId !== "" ? { employeurId: filtres.employeurId } : {}),
  };
}

export function Salaries() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [lignes, setLignes] = useState<LigneRepertoire[]>([]);
  const [filtres, setFiltres] = useState<FiltresRecherche>(AUCUN);
  const [employeurs, setEmployeurs] = useState<EmployeurRepertoire[]>([]);
  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);
  const [suiteEnCours, setSuiteEnCours] = useState(false);

  const charger = useCallback(async (aAppliquer: FiltresRecherche): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const page = await listerBeneficiaires(enRequete(aAppliquer));
      setLignes(page.lignes);
      setCurseurSuivant(page.curseurSuivant);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger(filtres);
    /* Les filtres sont un objet reconstruit à chaque rendu ; le dépendre en
       entier relancerait la requête sans fin. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charger, filtres.recherche, filtres.statut, filtres.employeurId]);

  /* Le référentiel : un échec ici ne ferme pas l'écran. Un menu d'employeurs
     vide gêne le filtrage ; il n'empêche pas de lire le répertoire. */
  useEffect(() => {
    void (async () => {
      try {
        setEmployeurs(await listerEmployeurs());
      } catch {
        setEmployeurs([]);
      }
    })();
  }, []);

  /** La suite. Le tableau annonce déjà qu'il est incomplet. */
  const chargerLaSuite = useCallback(async (): Promise<void> => {
    if (curseurSuivant === null) return;
    setSuiteEnCours(true);
    try {
      const page = await listerBeneficiaires(enRequete(filtres), curseurSuivant);
      setLignes((deja) => [...deja, ...page.lignes]);
      setCurseurSuivant(page.curseurSuivant);
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    } finally {
      setSuiteEnCours(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curseurSuivant, filtres.recherche, filtres.statut, filtres.employeurId]);

  return (
    <div className="beneficiaires">
      <h1 className="ecran__titre">Bénéficiaires</h1>
      <p className="ecran__intro">
        Les personnes inscrites au dispositif par leur employeur. Le solde
        affiché est le disponible : ce qui peut être dépensé aujourd&apos;hui.
      </p>

      <RechercheSalaries
        filtres={filtres}
        employeurs={employeurs}
        onChanger={setFiltres}
      />

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Lecture du répertoire…</p>
          <span className="silhouette silhouette--titre" />
          <span className="silhouette silhouette--ligne" />
          <span className="silhouette silhouette--courte" />
        </div>
      )}

      {etat.phase === "echec" && (
        <div className="etat etat--echec" role="alert">
          <p>{etat.message}</p>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => void charger(filtres)}
          >
            Réessayer
          </button>
        </div>
      )}

      {etat.phase === "prete" && lignes.length === 0 && (
        <div className="etat etat--vide">
          <p>Aucun bénéficiaire ne répond à ces filtres.</p>
          <p>
            Ce n&apos;est pas une erreur : personne dans le répertoire ne
            correspond. Élargissez la recherche, ou retirez un filtre.
          </p>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => setFiltres(AUCUN)}
          >
            Retirer tous les filtres
          </button>
        </div>
      )}

      {etat.phase === "prete" && lignes.length > 0 && (
        <>
          <TableauSalaries lignes={lignes} resteAVenir={curseurSuivant !== null} />

          {curseurSuivant !== null && (
            <div className="actions">
              <button
                type="button"
                className="bouton bouton--discret"
                onClick={() => void chargerLaSuite()}
                disabled={suiteEnCours}
              >
                {suiteEnCours ? "Chargement…" : "Charger les suivants"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
