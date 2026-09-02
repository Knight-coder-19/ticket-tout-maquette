"use client";

import { useState, type FormEvent } from "react";
import { resoudreJeton } from "@/lib/services/encaissement.service";
import { ErreurEncaissement, type JetonResolu } from "@/types/encaissement";

/** Ce que le caissier doit lire, et le geste qu'il doit faire, pour chaque refus. */
const MESSAGES: Record<string, string> = {
  unknown_token: "Ce code ne correspond à aucun paiement. Vérifiez la saisie.",
  token_used: "Ce code a déjà servi. Demandez-en un nouveau au client.",
  token_expired: "Ce code a dépassé cinq minutes. Demandez-en un nouveau au client.",
  account_inactive: "Le compte du client n'est pas actif.",
  reseau: "Service injoignable. Réessayez, ou passez en file d'attente.",
};

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
      <h2>Code du client</h2>
      <p className="aide">
        Scannez le QR du client, ou saisissez le numéro affiché sous le code.
      </p>

      <label htmlFor="jeton">Numéro du paiement</label>
      <input
        id="jeton"
        name="jeton"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        autoComplete="off"
        autoFocus
        inputMode="text"
        spellCheck={false}
        aria-invalid={erreur !== null}
        aria-describedby={erreur ? "jeton-erreur" : undefined}
        disabled={enCours}
      />

      {erreur !== null && (
        <p id="jeton-erreur" role="alert" className="erreur">
          {erreur}
        </p>
      )}

      <button type="submit" disabled={enCours || code.length === 0}>
        {enCours ? "Vérification…" : "Continuer"}
      </button>
    </form>
  );
}
