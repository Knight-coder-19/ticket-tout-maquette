"use client";

/**
 * Validation des demandes. Motif obligatoire, décision horodatée.
 */

import "@/styles/validations.css";

import { useCallback, useEffect, useRef, useState } from "react";

import { CarteDemande } from "./CarteDemande";
import { DialogueRefus } from "./DialogueRefus";
import { JournalDecisions } from "./JournalDecisions";
import {
  accepterDemande,
  lireJournalDecisions,
  listerDemandesEnAttente,
  refuserDemande,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { DecisionJournal, DemandeAdhesion } from "@/types/domaine";

/**
 * Ce que l'agent doit lire pour chaque refus, et le geste qui suit.
 * Le front reagit sur le CODE, jamais sur le message du serveur
 * (`data-dictionary.md:626`).
 */
const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Verifiez la connexion, puis reessayez.",
  unauthorized: "Votre session a expire. Reconnectez-vous, puis reprenez.",
  forbidden: "Votre compte n'a pas les droits d'administration.",
  partner_not_found: "Cette demande n'existe plus. Rechargez la liste.",
  partner_already_reviewed:
    "Cette demande a deja ete tranchee, peut-etre par un collegue. Rechargez la liste.",
  validation_failed:
    "Le serveur a refuse la decision : le motif est obligatoire et ne peut pas etre vide.",
  reponse_illisible:
    "Le serveur a repondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

type Etat =
  | { phase: "chargement" }
  | { phase: "prete" }
  | { phase: "echec"; message: string };

export function Validations() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [demandes, setDemandes] = useState<DemandeAdhesion[]>([]);
  const [journal, setJournal] = useState<DecisionJournal[]>([]);

  /** Identifiant de la demande dont la decision est en vol. */
  const [enCours, setEnCours] = useState<string | null>(null);
  /** La demande dont on ouvre le dialogue de refus. */
  const [refusPour, setRefusPour] = useState<DemandeAdhesion | null>(null);
  const [erreurRefus, setErreurRefus] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState<string | null>(null);

  const zoneAnnonce = useRef<HTMLParagraphElement | null>(null);

  const charger = useCallback(async (): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      /* Les deux listes ensemble : un journal qui arrive apres coup ferait
         clignoter l'ecran deux fois pour une seule action. */
      const [page, entrees] = await Promise.all([
        listerDemandesEnAttente(),
        lireJournalDecisions(),
      ]);
      setDemandes(page.demandes);
      setJournal(entrees);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  /** Rend le focus au bouton qui a ouvert le dialogue. */
  const rendreLeFocus = useCallback((demandeId: string): void => {
    const bouton = document.getElementById(`refuser-${demandeId}`);
    if (bouton instanceof HTMLElement) bouton.focus();
  }, []);

  async function decider(
    demande: DemandeAdhesion,
    action: () => Promise<void>,
    resume: string,
  ): Promise<void> {
    setEnCours(demande.id);
    setErreurRefus(null);
    try {
      await action();
      /* La demande quitte la liste et parait au journal : on recharge les deux
         depuis le serveur plutot que de deviner leur nouvel etat. Le serveur
         est la source, l'ecran n'est qu'une vue. */
      const [page, entrees] = await Promise.all([
        listerDemandesEnAttente(),
        lireJournalDecisions(),
      ]);
      setDemandes(page.demandes);
      setJournal(entrees);
      setRefusPour(null);
      setAnnonce(resume);
      /* Le bouton qui avait le focus vient de disparaitre avec sa carte : on
         emmene le focus sur l'annonce, qui dit ce qui s'est passe. */
      window.setTimeout(() => zoneAnnonce.current?.focus(), 0);
    } catch (leve) {
      const message = messagePour(leve);
      if (refusPour !== null) setErreurRefus(message);
      else setEtat({ phase: "echec", message });
    } finally {
      setEnCours(null);
    }
  }

  const enAttente = demandes.length;

  return (
    <>
      <h1>Validations d&apos;adhesion</h1>

      <p
        className="journal__horodatage"
        role="status"
        tabIndex={-1}
        ref={zoneAnnonce}
      >
        {annonce ?? ""}
      </p>

      <section className="validations__section" aria-labelledby="file-titre">
        <h2 className="validations__titre" id="file-titre">
          Demandes en attente
        </h2>

        {etat.phase === "chargement" && (
          <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
            <p className="journal__vide">Chargement des demandes…</p>
            {/* Des silhouettes plutot qu'un ecran blanc : l'agent voit qu'il
                y a quelque chose a attendre, et ou cela va apparaitre. */}
            <span className="silhouette silhouette--titre" />
            <span className="silhouette silhouette--ligne" />
            <span className="silhouette silhouette--courte" />
          </div>
        )}

        {etat.phase === "echec" && (
          <div className="etat etat--echec" role="alert">
            <h3>La liste n&apos;a pas pu etre chargee</h3>
            <p>{etat.message}</p>
            <p>
              Les demandes ne sont pas perdues : elles sont chez le serveur, et
              rien n&apos;a ete decide.
            </p>
            <button type="button" className="bouton bouton--discret" onClick={() => void charger()}>
              Reessayer
            </button>
          </div>
        )}

        {etat.phase === "prete" && enAttente === 0 && (
          /* Liste vide : une bonne nouvelle. Ni `role="alert"`, ni rouge, ni
             point d'exclamation -- rien n'a echoue, tout a ete traite. */
          <div className="etat etat--vide">
            <h3>Aucune demande en attente</h3>
            <p>
              Tous les dossiers deposes ont ete tranches. Les decisions passees
              restent consultables dans le journal ci-dessous.
            </p>
          </div>
        )}

        {etat.phase === "prete" && enAttente > 0 && (
          <>
            <p className="validations__compte">
              {enAttente === 1
                ? "1 demande attend une decision, la plus ancienne en premier."
                : `${enAttente} demandes attendent une decision, la plus ancienne en premier.`}
            </p>
            <div className="file">
              <ul className="file__liste">
                {demandes.map((demande) => (
                  <li key={demande.id}>
                    <CarteDemande
                      demande={demande}
                      enCours={enCours === demande.id}
                      onAccepter={() =>
                        void decider(
                          demande,
                          () => accepterDemande(demande.id),
                          `Adhesion de ${demande.enseigne} acceptee.`,
                        )
                      }
                      onRefuser={() => {
                        setErreurRefus(null);
                        setRefusPour(demande);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <section className="validations__section" aria-labelledby="journal-titre">
        <h2 className="validations__titre" id="journal-titre">
          Journal des decisions
        </h2>
        <p className="validations__compte">
          Chaque decision y figure avec son auteur et son horodatage. Rien ne
          s&apos;y efface.
        </p>
        <JournalDecisions decisions={journal} />
      </section>

      {refusPour !== null && (
        <DialogueRefus
          demande={refusPour}
          enCours={enCours === refusPour.id}
          erreur={erreurRefus}
          onAnnuler={() => {
            const id = refusPour.id;
            setRefusPour(null);
            setErreurRefus(null);
            /* Le focus revient sur le bouton qui a ouvert le dialogue. */
            window.setTimeout(() => rendreLeFocus(id), 0);
          }}
          onConfirmer={(motif) =>
            void decider(
              refusPour,
              () => refuserDemande(refusPour.id, motif),
              `Adhesion de ${refusPour.enseigne} refusee.`,
            )
          }
        />
      )}
    </>
  );
}
