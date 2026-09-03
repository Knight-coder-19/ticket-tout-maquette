"use client";

/**
 * La fiche d'un bénéficiaire.
 *
 * Trois blocs : qui il est, ce qu'il possède, ce qui l'explique. Et deux
 * gestes : régulariser son solde, changer son statut.
 *
 * ═══ APRÈS UNE RÉGULARISATION, LES DEUX SONT MONTRÉS ═══
 *
 * Le nouveau solde ET l'écriture qui l'explique. La route rend les deux dans
 * la même réponse ; l'écran met la ligne en évidence dans le journal, qu'il
 * recharge dans la foulée.
 *
 * C'est la forme visible de la règle R1 : le solde n'est pas une valeur qu'on
 * corrige, c'est une conséquence qu'on peut remonter. Un écran qui afficherait
 * le nouveau nombre sans la ligne laisserait croire le contraire.
 */

import "@/styles/primitives.css";
import "@/styles/beneficiaires.css";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { DialogueRegularisation } from "./DialogueRegularisation";
import { DialogueStatut } from "./DialogueStatut";
import { OperationsSalarie } from "./OperationsSalarie";
import { SoldeEtCredits } from "./SoldeEtCredits";
import { formaterCentimes } from "@/lib/montant";
import { formaterDate } from "@/lib/utils/date";
import {
  listerEcritures,
  lireBeneficiaire,
  reactiverBeneficiaire,
  regulariserSolde,
  suspendreBeneficiaire,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type {
  EcritureRegistre,
  FicheBeneficiaire,
  Regularisation,
  SensRegularisation,
  StatutBeneficiaire,
} from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  not_found: "Ce bénéficiaire n'existe pas, ou n'existe plus.",
  validation_failed: "La demande a été refusée : vérifiez le montant et le motif.",
  insufficient_funds:
    "Le montant dépasse le solde disponible. Un débit ne peut pas entamer les fonds réservés par un paiement en cours.",
  account_closed: "Ce compte est fermé : il n'accepte plus d'écriture.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

const LIBELLES: Record<StatutBeneficiaire, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  ferme: "Fermé",
};

type Etat =
  | { phase: "chargement" }
  | { phase: "prete"; fiche: FicheBeneficiaire }
  | { phase: "echec"; message: string };

/** Le dialogue ouvert, s'il y en a un. */
type Demande = { sorte: "regularisation" } | { sorte: "suspension" } | null;

export function FicheSalarie({ id }: { id: string }) {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [ecritures, setEcritures] = useState<EcritureRegistre[]>([]);
  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);
  const [demande, setDemande] = useState<Demande>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreurGeste, setErreurGeste] = useState<string | null>(null);

  /** La dernière régularisation, pour montrer le solde ET son écriture. */
  const [derniere, setDerniere] = useState<Regularisation | null>(null);

  const charger = useCallback(async (): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const [fiche, journal] = await Promise.all([
        lireBeneficiaire(id),
        listerEcritures({ titulaireId: id }),
      ]);
      setEtat({ phase: "prete", fiche });
      setEcritures(journal.ecritures);
      setCurseurSuivant(journal.curseurSuivant);
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /**
   * Régularise, puis relit TOUT.
   *
   * La réponse porte déjà le nouveau solde et l'écriture ; on recharge quand
   * même la fiche et le journal. Reconstruire l'état à partir de la seule
   * réponse reviendrait à tenir un second exemplaire de la vérité côté écran —
   * exactement ce que R1 refuse pour les soldes.
   */
  const regulariser = useCallback(
    async (sens: SensRegularisation, montant: number, motif: string): Promise<void> => {
      setEnCours(true);
      setErreurGeste(null);
      try {
        const issue = await regulariserSolde(id, sens, montant, motif);
        setDerniere(issue);
        setDemande(null);
        await charger();
      } catch (leve) {
        setErreurGeste(messagePour(leve));
      } finally {
        setEnCours(false);
      }
    },
    [id, charger],
  );

  const suspendre = useCallback(
    async (motif: string): Promise<void> => {
      setEnCours(true);
      setErreurGeste(null);
      try {
        await suspendreBeneficiaire(id, motif);
        setDemande(null);
        await charger();
      } catch (leve) {
        setErreurGeste(messagePour(leve));
      } finally {
        setEnCours(false);
      }
    },
    [id, charger],
  );

  /* La réactivation n'ouvre aucun dialogue : elle ne demande aucun motif. */
  const reactiver = useCallback(async (): Promise<void> => {
    setEnCours(true);
    setErreurGeste(null);
    try {
      await reactiverBeneficiaire(id);
      await charger();
    } catch (leve) {
      setErreurGeste(messagePour(leve));
    } finally {
      setEnCours(false);
    }
  }, [id, charger]);

  if (etat.phase === "chargement") {
    return (
      <div className="beneficiaires">
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Lecture de la fiche…</p>
          <span className="silhouette silhouette--titre" />
          <span className="silhouette silhouette--ligne" />
          <span className="silhouette silhouette--courte" />
        </div>
      </div>
    );
  }

  if (etat.phase === "echec") {
    return (
      <div className="beneficiaires">
        <div className="etat etat--echec" role="alert">
          <p>{etat.message}</p>
          <button type="button" className="bouton bouton--discret" onClick={() => void charger()}>
            Réessayer
          </button>
        </div>
        <p>
          <Link href="/administration/salaries">Retour au répertoire</Link>
        </p>
      </div>
    );
  }

  const { fiche } = etat;
  const teinte =
    fiche.statut === "actif" ? "agree" : fiche.statut === "suspendu" ? "suspendu" : "ferme";

  return (
    <div className="beneficiaires">
      <p className="beneficiaires__fil">
        <Link href="/administration/salaries">Bénéficiaires</Link>
      </p>

      <h1 className="ecran__titre">{fiche.nomAffiche}</h1>

      <section className="fiche" aria-labelledby="identite-titre">
        <h2 className="fiche__titre" id="identite-titre">
          Identité
        </h2>
        <dl className="fiche__liste">
          <dt className="fiche__intitule">Employeur</dt>
          <dd className="fiche__valeur">
            {fiche.employeur ?? (
              <span className="fiche__absente">Employeur introuvable</span>
            )}
          </dd>

          <dt className="fiche__intitule">Matricule</dt>
          <dd className="fiche__valeur">{fiche.matricule}</dd>

          <dt className="fiche__intitule">Téléphone</dt>
          <dd className="fiche__valeur">
            {fiche.telephone ?? <span className="fiche__absente">Non renseigné</span>}
          </dd>

          <dt className="fiche__intitule">Entré le</dt>
          <dd className="fiche__valeur">{formaterDate(`${fiche.entreLe}T00:00:00.000Z`)}</dd>

          <dt className="fiche__intitule">Statut</dt>
          <dd className="fiche__valeur">
            <span className={`statut statut--${teinte}`}>{LIBELLES[fiche.statut]}</span>
          </dd>
        </dl>
      </section>

      <SoldeEtCredits soldes={fiche.soldes} jetonsEnCours={fiche.jetonsEnCours} />

      {/*
        Ce qui vient de se passer, dit une fois et sans ambiguïté : le montant
        inscrit, son sens, son motif, et le solde qui en découle. La ligne
        correspondante est mise en évidence dans le journal, plus bas.
      */}
      {derniere !== null && (
        <div className="etat etat--succes" role="status">
          <p>
            <strong>Écriture inscrite au registre.</strong>{" "}
            {derniere.ecriture.sens === "credit" ? "Crédit" : "Débit"} de{" "}
            {formaterCentimes(derniere.ecriture.montant)} — «&nbsp;
            {derniere.ecriture.motif}&nbsp;».
          </p>
          <p>
            Le solde disponible est maintenant de{" "}
            {formaterCentimes(derniere.soldes.disponible)}. Il n&apos;a pas été
            saisi : il découle de cette écriture, visible ci-dessous.
          </p>
        </div>
      )}

      {erreurGeste !== null && demande === null && (
        <p className="etat etat--echec" role="alert">
          {erreurGeste}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          id="ouvrir-regularisation"
          className="bouton bouton--action"
          disabled={enCours || fiche.statut === "ferme"}
          onClick={() => {
            setErreurGeste(null);
            setDemande({ sorte: "regularisation" });
          }}
        >
          Régulariser le solde…
        </button>

        {fiche.statut === "actif" && (
          <button
            type="button"
            id="ouvrir-suspension"
            className="bouton bouton--refus"
            disabled={enCours}
            onClick={() => {
              setErreurGeste(null);
              setDemande({ sorte: "suspension" });
            }}
          >
            Suspendre…
          </button>
        )}

        {/* Aucun dialogue : rendre ses droits ne se justifie pas. */}
        {fiche.statut === "suspendu" && (
          <button
            type="button"
            className="bouton bouton--discret"
            disabled={enCours}
            onClick={() => void reactiver()}
          >
            {enCours ? "Réactivation…" : "Réactiver"}
          </button>
        )}

        {fiche.statut === "ferme" && (
          <span className="registre__secondaire">
            Compte fermé : son historique est conservé, mais il n&apos;accepte plus
            d&apos;écriture.
          </span>
        )}
      </div>

      <OperationsSalarie
        ecritures={ecritures}
        resteAVenir={curseurSuivant !== null}
        miseEnEvidence={derniere?.ecriture.operationId ?? null}
      />

      {demande?.sorte === "regularisation" && (
        <DialogueRegularisation
          soldes={fiche.soldes}
          enCours={enCours}
          erreur={erreurGeste}
          onAnnuler={() => {
            setDemande(null);
            document.getElementById("ouvrir-regularisation")?.focus();
          }}
          onConfirmer={(sens, montant, motif) => void regulariser(sens, montant, motif)}
        />
      )}

      {demande?.sorte === "suspension" && (
        <DialogueStatut
          nomAffiche={fiche.nomAffiche}
          enCours={enCours}
          erreur={erreurGeste}
          onAnnuler={() => {
            setDemande(null);
            document.getElementById("ouvrir-suspension")?.focus();
          }}
          onSuspendre={(motif) => void suspendre(motif)}
        />
      )}
    </div>
  );
}
