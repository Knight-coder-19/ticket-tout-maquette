"use client";

import { useEffect, useState } from "react";
import { encaisser } from "@/lib/services/encaissement.service";
import { formaterCentimes, formaterDuree, secondesRestantes } from "@/lib/montant";
import { ErreurService } from "@/types/erreurs";
import type { EncaissementAccepte, JetonResolu } from "@/types/encaissement";

const MESSAGES: Record<string, string> = {
  token_not_found: "Ce code n'existe plus. Demandez-en un nouveau au client.",
  token_already_used:
    "Ce code a été encaissé par un autre établissement. Rien n'a été débité chez vous.",
  token_expired: "Le code a expiré avant la validation. Demandez-en un nouveau au client.",
  account_inactive: "Le compte du client n'est pas actif.",
  partner_not_approved:
    "Votre établissement n'est pas agréé pour encaisser. Contactez l'administration.",
  insufficient_funds: "Le solde du client ne couvre plus ce montant.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  reseau:
    "Service injoignable. Réessayez : si le paiement était passé, il ne partira pas deux fois.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * Deuxième pas : vérifier, puis confirmer.
 *
 * ─── AUCUN CHAMP DE MONTANT ───
 *
 * C'est tout le changement. Le montant a été fixé par le client à l'émission et
 * les fonds sont réservés depuis (`authorize.rs:1-3`) ; le caissier lit ce
 * qu'il va encaisser et confirme. `SettleRequest` ne porte d'ailleurs aucun
 * champ de montant (`data-dictionary.md:438-441`) : il n'y aurait nulle part où
 * envoyer une saisie.
 *
 * Les trois choses à vérifier avant de valider sont donc affichées ensemble, et
 * en grand : le montant, le bénéficiaire, le temps qui reste.
 *
 * ─── La défense en profondeur, deux étages ───
 *
 * Premier étage, ici : le compte à rebours désactive le bouton dès que
 * l'échéance est passée. Il compte sur `expireA`, l'échéance SERVIE PAR LE
 * SERVEUR et convertie par l'adaptateur — pas sur une durée calculée
 * localement, qui dériverait de l'horloge du poste.
 *
 * Second étage, le serveur : il refuse de toute façon, contre sa propre
 * horloge, qui est la seule à faire foi (décision 2, invariant I7). Le premier
 * étage évite un aller-retour et une mauvaise surprise au comptoir ; c'est le
 * second qui garantit.
 *
 * ─── Le rejeu ───
 *
 * Après un échec réseau, le caissier ne sait pas si le serveur a écrit. Il
 * réessaie, et l'appel part avec `rejeu: true` — le jeton étant la clé
 * d'unicité, le serveur rend la transaction déjà écrite au lieu d'en écrire une
 * seconde. L'écran le dit alors : « déjà encaissé », pas « encaissé ».
 */
export function EtapeConfirmation({
  jeton,
  parScan,
  onAccepte,
  onAbandon,
}: {
  jeton: JetonResolu;
  /** Le jeton a-t-il été scanné, ou le code saisi à la main ? */
  parScan: boolean;
  onAccepte: (transaction: EncaissementAccepte) => void;
  onAbandon: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /* Une tentative a déjà été envoyée : la suivante est un rejeu, et le serveur
     rendra la transaction déjà écrite plutôt que d'en écrire une seconde. */
  const [dejaTente, setDejaTente] = useState(false);
  const [restant, setRestant] = useState(() => secondesRestantes(jeton.expireA));

  useEffect(() => {
    const battement = setInterval(
      () => setRestant(secondesRestantes(jeton.expireA)),
      1000,
    );
    return () => clearInterval(battement);
  }, [jeton.expireA]);

  const expire = restant === 0;

  async function valider() {
    if (enCours || expire) return;
    setEnCours(true);
    setErreur(null);
    const rejeu = dejaTente;
    setDejaTente(true);
    try {
      onAccepte(
        await encaisser({
          jti: parScan ? jeton.jti : null,
          codeCourt: parScan ? null : jeton.codeCourt,
          beneficiaire: jeton.beneficiaire,
          rejeu,
        }),
      );
    } catch (leve) {
      setErreur(messagePour(leve));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="etape" aria-labelledby="confirmation-titre">
      <h1 className="encaissement__titre" id="confirmation-titre">
        Confirmer l&apos;encaissement
      </h1>
      <p className="encaissement__aide">
        Le montant a été fixé par le client. Vérifiez-le avec lui, puis validez.
      </p>

      <p className="encaissement__somme">{formaterCentimes(jeton.montant)}</p>

      <dl className="encaissement__faits">
        <dt>Client</dt>
        <dd>{jeton.beneficiaire}</dd>
        <dt>Code</dt>
        <dd className="encaissement__code">{jeton.codeCourt}</dd>
      </dl>

      {/*
        Le compte à rebours. `role="status"` : il change tout seul, et un
        lecteur d'écran doit pouvoir l'annoncer sans que le focus bouge.
      */}
      <p
        className={expire ? "encaissement__minuteur encaissement__minuteur--expire" : "encaissement__minuteur"}
        role="status"
      >
        {expire
          ? "Code expiré — demandez-en un nouveau au client."
          : `Code valable encore ${formaterDuree(restant)}`}
      </p>

      {erreur !== null && (
        <p role="alert" className="etat etat--echec">
          {erreur}
        </p>
      )}

      <div className="actions">
        {/*
          Un seul bouton d'action. Pas de champ, pas de choix : le geste du
          caissier est binaire — c'est bien ce montant, ou ce ne l'est pas.
        */}
        <button
          type="button"
          className="bouton bouton--action"
          onClick={() => void valider()}
          disabled={enCours || expire}
        >
          {enCours
            ? "Encaissement…"
            : dejaTente
              ? "Réessayer l'encaissement"
              : "Encaisser"}
        </button>
        <button
          type="button"
          className="bouton bouton--discret"
          onClick={onAbandon}
          disabled={enCours}
        >
          Annuler
        </button>
      </div>
    </section>
  );
}
