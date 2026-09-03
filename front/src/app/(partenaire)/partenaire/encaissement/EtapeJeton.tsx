"use client";

import { useState, type FormEvent } from "react";
import { resoudreJeton } from "@/lib/services/encaissement.service";
import { ErreurService } from "@/types/erreurs";
import type { JetonResolu } from "@/types/encaissement";

/** Ce que le caissier doit lire, et le geste qui suit, pour chaque refus. */
const MESSAGES: Record<string, string> = {
  token_not_found: "Ce code ne correspond à aucun paiement. Vérifiez la saisie.",
  token_already_used: "Ce code a déjà servi. Demandez-en un nouveau au client.",
  token_expired: "Ce code a dépassé cinq minutes. Demandez-en un nouveau au client.",
  account_inactive: "Le compte du client n'est pas actif.",
  partner_not_approved:
    "Votre établissement n'est pas agréé pour encaisser. Contactez l'administration.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  reseau: "Service injoignable. Réessayez, ou passez en file d'attente.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * Premier pas : obtenir le code du client.
 *
 * ─── Deux entrées, une seule écrite ───
 *
 * Scanner le QR et saisir le code court mènent au même endroit — la route
 * accepte les deux références (`TokenRef`, `core/src/payments/mod.rs:1`). La
 * saisie manuelle est écrite ; le scan est une entrée séparée, désactivée, que
 * quelqu'un branchera sur une caméra.
 *
 * Il n'y a PAS de caméra simulée. Un bouton qui prétendrait scanner et qui
 * remplirait le champ tout seul ferait croire le parcours vérifié alors qu'il
 * ne le serait pas, et le jour du branchement personne ne saurait ce qui a été
 * éprouvé. Le bouton est là, visible, inerte, et il dit pourquoi.
 */
export function EtapeJeton({ onResolu }: { onResolu: (jeton: JetonResolu) => void }) {
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const code = saisie.trim();

  async function valider(evenement: FormEvent) {
    evenement.preventDefault();
    if (enCours || code.length === 0) return;

    setEnCours(true);
    setErreur(null);
    try {
      onResolu(await resoudreJeton(code));
    } catch (leve) {
      setErreur(messagePour(leve));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <h1 className="encaissement__titre">Encaisser un paiement</h1>
      <p className="encaissement__aide">
        Demandez au client le code affiché sur son téléphone. Le montant a déjà
        été fixé par le client : vous n&apos;avez qu&apos;à le confirmer.
      </p>

      <form onSubmit={valider} className="etape">
        <label htmlFor="jeton">Code du paiement</label>
        <input
          id="jeton"
          name="jeton"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          autoComplete="off"
          autoFocus
          inputMode="text"
          spellCheck={false}
          placeholder="K7M2-P4XQ"
          aria-invalid={erreur !== null}
          aria-describedby={erreur !== null ? "jeton-erreur" : "jeton-aide"}
          disabled={enCours}
        />
        <p className="encaissement__aide" id="jeton-aide">
          Huit caractères, en deux groupes de quatre. Les tirets, les espaces et
          les minuscules sont acceptés.
        </p>

        {erreur !== null && (
          <p id="jeton-erreur" role="alert" className="etat etat--echec">
            {erreur}
          </p>
        )}

        <div className="actions">
          <button
            type="submit"
            className="bouton bouton--action"
            disabled={enCours || code.length === 0}
          >
            {enCours ? "Vérification…" : "Continuer"}
          </button>

          {/*
            L'entrée « scanner », séparée et inerte.

            `disabled` et non masquée : le caissier voit que le geste existe et
            qu'il n'est pas encore branché. Une entrée cachée reviendrait à
            faire découvrir la fonction le jour où elle apparaît, sans que
            personne n'ait prévu la place qu'elle prend à l'écran.
          */}
          <button
            type="button"
            className="bouton bouton--discret"
            disabled
            aria-describedby="scan-aide"
          >
            Scanner le QR
          </button>
        </div>
        <p className="encaissement__aide" id="scan-aide">
          La lecture du QR par la caméra n&apos;est pas encore disponible sur ce
          poste. En attendant, saisissez le code affiché sous le QR du client.
        </p>
      </form>
    </>
  );
}
