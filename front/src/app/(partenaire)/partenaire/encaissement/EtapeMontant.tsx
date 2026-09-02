"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { encaisser } from "@/lib/services/encaissement.service";
import {
  centimesDepuisSaisie,
  formaterCentimes,
  formaterDuree,
  secondesRestantes,
} from "@/lib/montant";
import {
  ErreurEncaissement,
  type EncaissementAccepte,
  type JetonResolu,
} from "@/types/encaissement";

const MESSAGES: Record<string, string> = {
  token_used: "Ce code a déjà servi. Demandez-en un nouveau au client.",
  token_expired: "Le code a expiré pendant la saisie. Demandez-en un nouveau.",
  insufficient_funds: "Solde insuffisant. Proposez un autre moyen de paiement pour le reste.",
  account_inactive: "Le compte du client n'est pas actif.",
  partner_inactive: "Votre établissement n'est pas actif. Contactez l'administration.",
  invalid_amount: "Montant invalide.",
  reseau: "Service injoignable. Réessayez : le même encaissement ne partira pas deux fois.",
};

/**
 * Forge une clé d'idempotence.
 *
 * `crypto.randomUUID` n'existe que dans un contexte sécurisé : en https ou
 * sur localhost. Une démonstration ouverte depuis un téléphone sur
 * http://192.168.x.x n'y a pas droit, et l'écran planterait au moment
 * précis où il compte. D'où la solution de repli.
 */
function nouvelleCle(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cle-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

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

  /*
   * R3 — la clé est forgée ici, à la caisse, une fois pour cette tentative,
   * et elle ne bouge plus. C'est tout le mécanisme : si le caissier
   * double-clique, si le réseau lâche après que le serveur a écrit, si la
   * requête est rejouée depuis la file hors ligne, le serveur reconnaît la
   * clé et renvoie la transaction déjà écrite. Un seul débit.
   *
   * Régénérer la clé à chaque essai — la mettre dans le corps du composant,
   * ou dans un useState recalculé — annulerait la protection : deux clés
   * différentes, deux débits.
   */
  const cle = useRef<string | null>(null);
  if (cle.current === null) cle.current = nouvelleCle();

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
          idempotencyKey: cle.current as string,
          channel: "manuel",
        }),
      );
    } catch (leve) {
      setErreur(
        leve instanceof ErreurEncaissement
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
