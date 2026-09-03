"use client";

/**
 * La file des réclamations des salariés.
 *
 * ⚠⚠ DOMAINE ENTIÈREMENT DE NOTRE FAIT. Aucune route, aucune table, aucun
 * module ne le couvre côté back — vérifié dans l'audit initial
 * (`front/docs/contrat-api.md:376`) et jamais contredit depuis. Le modèle est
 * posé dans `types/domaine.ts` ; tout le reste — routes, magasin, cet écran
 * — en découle et le marque à chaque fichier.
 *
 * Comme `Validations` : la plus ancienne ouverte en premier, un statut par
 * défaut qui exclut les dossiers déjà tranchés.
 */

import "@/styles/primitives.css";
import "@/styles/reclamations.css";

import { useCallback, useEffect, useState } from "react";

import { FileReclamations } from "./FileReclamations";
import { FiltreStatut } from "./FiltreStatut";
import {
  listerReclamationsAdmin,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { ReclamationResume, StatutReclamation } from "@/types/domaine";

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
  | { phase: "prete" }
  | { phase: "echec"; message: string };

export function Reclamations() {
  const [statut, setStatut] = useState<StatutReclamation | undefined>(undefined);
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [reclamations, setReclamations] = useState<ReclamationResume[]>([]);
  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);

  const charger = useCallback(async (aAppliquer: StatutReclamation | undefined): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const page = await listerReclamationsAdmin(aAppliquer);
      setReclamations(page.reclamations);
      setCurseurSuivant(page.curseurSuivant);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger(statut);
  }, [charger, statut]);

  const chargerLaSuite = useCallback(async (): Promise<void> => {
    if (curseurSuivant === null) return;
    try {
      const page = await listerReclamationsAdmin(statut, curseurSuivant);
      setReclamations((deja) => [...deja, ...page.reclamations]);
      setCurseurSuivant(page.curseurSuivant);
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, [statut, curseurSuivant]);

  return (
    <div className="reclamations">
      <h1 className="ecran__titre">Réclamations</h1>
      <p className="ecran__intro">
        Les dossiers ouverts par des salariés, la plus ancienne attente
        d&apos;abord.
      </p>

      <FiltreStatut statut={statut} onChanger={setStatut} />

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Lecture de la file…</p>
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
            onClick={() => void charger(statut)}
          >
            Réessayer
          </button>
        </div>
      )}

      {etat.phase === "prete" && reclamations.length === 0 && (
        <div className="etat etat--vide">
          <p>
            {statut === undefined
              ? "Aucun dossier n'attend d'être traité."
              : "Aucun dossier ne correspond à ce statut."}
          </p>
        </div>
      )}

      {etat.phase === "prete" && reclamations.length > 0 && (
        <>
          <FileReclamations reclamations={reclamations} />
          {curseurSuivant !== null && (
            <div className="actions">
              <button
                type="button"
                className="bouton bouton--discret"
                onClick={() => void chargerLaSuite()}
              >
                Charger les suivants
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
