"use client";

import { useEffect, useState, type FormEvent } from "react";
import { encaisser } from "@/lib/services/encaissement.service";
import { useCleIdempotence } from "@/lib/api/idempotence";
import {
  centimesDepuisSaisie,
  formaterCentimes,
  formaterDuree,
  secondesRestantes,
} from "@/lib/montant";
import type { EncaissementAccepte, JetonResolu } from "@/types/encaissement";
import { ErreurService } from "@/types/erreurs";

const MESSAGES: Record<string, string> = {
  token_used: "Ce code a déjà servi. Demandez-en un nouveau au client.",
  token_expired: "Le code a expiré pendant la saisie. Demandez-en un nouveau.",
  insufficient_funds: "Solde insuffisant. Proposez un autre moyen de paiement pour le reste.",
  account_inactive: "Le compte du client n'est pas actif.",
  partner_inactive: "Votre établissement n'est pas actif. Contactez l'administration.",
  invalid_amount: "Montant invalide.",
  reseau: "Service injoignable. Réessayez : le même encaissement ne partira pas deux fois.",
};

export function EtapeMontant({
  jeton,
  partnerId,
  onAccepte,
  onAbandon,
}: {
  jeton: JetonResolu;
  partnerId: string;
  onAccepte: (transaction: EncaissementAccepte) => void;
  onAbandon: () => void;
}) {
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [restant, setRestant] = useState(() => secondesRestantes(jeton.expiresAt));

  /* R3 — une clé par tentative, forgée à la caisse, qui ne change pas entre
     deux essais. Le `useRef` qui porte cette garantie est dans le hook ; les
     deux façons de la casser sont écrites au-dessus de lui. */
  const cle = useCleIdempotence();

  useEffect(() => {
    const battement = setInterval(
      () => setRestant(secondesRestantes(jeton.expiresAt)),
      1000,
    );
    return () => clearInterval(battement);
  }, [jeton.expiresAt]);

  const centimes = centimesDepuisSaisie(saisie);
  const expire = restant === 0;

  async function valider(evenement: FormEvent) {
    evenement.preventDefault();
    if (enCours || centimes === null) return;

    setEnCours(true);
    setErreur(null);
    try {
      onAccepte(
        await encaisser({
          token: jeton.token,
          partnerId,
          amount: centimes,
          idempotencyKey: cle,
          channel: "manuel",
        }),
      );
    } catch (leve) {
      setErreur(
        leve instanceof ErreurService
          ? (MESSAGES[leve.code] ?? leve.message)
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={valider} className="etape">
      <h2>Montant à encaisser</h2>
      <p className="client">
        Client : <strong>{jeton.employee.name}</strong>
      </p>

      <p className={expire ? "minuteur minuteur--expire" : "minuteur"} role="status">
        {expire
          ? "Code expiré — demandez-en un nouveau au client."
          : `Code valable encore ${formaterDuree(restant)}`}
      </p>

      <label htmlFor="montant">Montant en euros</label>
      <input
        id="montant"
        name="montant"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        autoFocus
        placeholder="0,00"
        aria-invalid={erreur !== null}
        aria-describedby="montant-aide"
        disabled={enCours || expire}
      />

      <p id="montant-aide" className="aide">
        {centimes === null
          ? "Deux décimales au plus, séparées par une virgule."
          : `Sera encaissé : ${formaterCentimes(centimes)} (simulation).`}
      </p>

      {erreur !== null && (
        <p role="alert" className="erreur">
          {erreur}
        </p>
      )}

      <div className="actions">
        <button type="button" onClick={onAbandon} disabled={enCours}>
          Annuler
        </button>
        <button type="submit" disabled={enCours || expire || centimes === null}>
          {enCours ? "Encaissement…" : "Encaisser"}
        </button>
      </div>
    </form>
  );
}
