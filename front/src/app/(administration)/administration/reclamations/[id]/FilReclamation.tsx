"use client";

/**
 * Le fil complet d'un dossier de réclamation.
 *
 * ⚠⚠ DOMAINE ENTIÈREMENT DE NOTRE FAIT — voir `types/domaine.ts` et l'en-tête
 * de `app/api/v1/admin/claims/route.ts` pour le constat complet.
 *
 * Trois choses assemblées : les échanges (`FilMessages`), le résumé du
 * salarié en marge (`DossierBeneficiaire`), l'écriture visée si le dossier en
 * cite une (`OperationVisee`, relue en direct au registre). La clôture ouvre
 * `DialogueCloture`, qui réutilise `DialogueMotif`.
 */

import "@/styles/primitives.css";
import "@/styles/reclamations.css";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DialogueCloture } from "./DialogueCloture";
import { DossierBeneficiaire } from "./DossierBeneficiaire";
import { FilMessages } from "./FilMessages";
import { OperationVisee } from "./OperationVisee";
import {
  cloturerReclamationAdmin,
  lireBeneficiaire,
  lireReclamation,
  repondreAReclamation,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { FicheBeneficiaire, Reclamation, StatutReclamation } from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  not_found: "Cette réclamation n'existe pas, ou n'existe plus.",
  claim_closed: "Ce dossier a été clos entre-temps : il n'accepte plus de nouveau message.",
  claim_already_closed: "Ce dossier a déjà été clos, peut-être par un collègue.",
  validation_failed: "La demande a été refusée : vérifiez le texte saisi.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

const LIBELLES: Record<StatutReclamation, string> = {
  ouverte: "Ouverte",
  en_cours: "En cours",
  close: "Close",
};
const TEINTES: Record<StatutReclamation, string> = {
  ouverte: "en_attente",
  en_cours: "agree",
  close: "ferme",
};

type Etat =
  | { phase: "chargement" }
  | { phase: "prete"; reclamation: Reclamation; beneficiaire: FicheBeneficiaire | null }
  | { phase: "echec"; message: string };

export function FilReclamation({ id }: { id: string }) {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [enCoursReponse, setEnCoursReponse] = useState(false);
  const [erreurReponse, setErreurReponse] = useState<string | null>(null);
  const [dialogueOuvert, setDialogueOuvert] = useState(false);
  const [enCoursCloture, setEnCoursCloture] = useState(false);
  const [erreurCloture, setErreurCloture] = useState<string | null>(null);

  const charger = useCallback(async (): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const reclamation = await lireReclamation(id);
      /* Le bénéficiaire est chargé À PART : un salarié introuvable (compte
         supprimé d'un jeu de démonstration futur, par exemple) ne doit pas
         empêcher de lire le fil lui-même. */
      const beneficiaire = await lireBeneficiaire(reclamation.salarieId).catch(() => null);
      setEtat({ phase: "prete", reclamation, beneficiaire });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const repondre = useCallback(
    async (texte: string): Promise<void> => {
      setEnCoursReponse(true);
      setErreurReponse(null);
      try {
        await repondreAReclamation(id, texte);
        await charger();
      } catch (leve) {
        setErreurReponse(messagePour(leve));
      } finally {
        setEnCoursReponse(false);
      }
    },
    [id, charger],
  );

  const cloturer = useCallback(
    async (motif: string): Promise<void> => {
      setEnCoursCloture(true);
      setErreurCloture(null);
      try {
        await cloturerReclamationAdmin(id, motif);
        setDialogueOuvert(false);
        await charger();
      } catch (leve) {
        setErreurCloture(messagePour(leve));
      } finally {
        setEnCoursCloture(false);
      }
    },
    [id, charger],
  );

  if (etat.phase === "chargement") {
    return (
      <div className="reclamations">
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Lecture du dossier…</p>
          <span className="silhouette silhouette--titre" />
          <span className="silhouette silhouette--ligne" />
        </div>
      </div>
    );
  }

  if (etat.phase === "echec") {
    return (
      <div className="reclamations">
        <div className="etat etat--echec" role="alert">
          <p>{etat.message}</p>
          <button type="button" className="bouton bouton--discret" onClick={() => void charger()}>
            Réessayer
          </button>
        </div>
        <p>
          <Link href="/administration/reclamations">Retour à la file</Link>
        </p>
      </div>
    );
  }

  const { reclamation, beneficiaire } = etat;
  const clos = reclamation.statut === "close";

  return (
    <div className="reclamations fil-reclamation">
      <p className="fil-reclamation__fil-ariane">
        <Link href="/administration/reclamations">Réclamations</Link>
      </p>

      <div className="fil-reclamation__entete">
        <h1 className="ecran__titre">{reclamation.salarieNom}</h1>
        <span className={`statut statut--${TEINTES[reclamation.statut]}`}>
          {LIBELLES[reclamation.statut]}
        </span>
      </div>

      {clos && reclamation.motifCloture !== null && (
        <p className="fil-reclamation__motif-cloture">
          <strong>Clos.</strong> {reclamation.motifCloture}
        </p>
      )}

      <div className="fil-reclamation__grille">
        <div className="fil-reclamation__principal">
          <FilMessages
            messages={reclamation.messages}
            nomSalarie={reclamation.salarieNom}
            clos={clos}
            enCours={enCoursReponse}
            erreur={erreurReponse}
            onRepondre={(texte) => void repondre(texte)}
          />

          <OperationVisee
            operationId={reclamation.operationId}
            salarieId={reclamation.salarieId}
          />

          {!clos && (
            <div className="actions">
              <button
                type="button"
                id="ouvrir-cloture"
                className="bouton bouton--refus"
                onClick={() => {
                  setErreurCloture(null);
                  setDialogueOuvert(true);
                }}
              >
                Clore le dossier…
              </button>
            </div>
          )}
        </div>

        {beneficiaire !== null && (
          <DossierBeneficiaire beneficiaire={beneficiaire} />
        )}
      </div>

      {dialogueOuvert && (
        <DialogueCloture
          nomSalarie={reclamation.salarieNom}
          enCours={enCoursCloture}
          erreur={erreurCloture}
          onAnnuler={() => {
            setDialogueOuvert(false);
            document.getElementById("ouvrir-cloture")?.focus();
          }}
          onCloturer={(motif) => void cloturer(motif)}
        />
      )}
    </div>
  );
}
