"use client";

import { formaterCentimes } from "@/lib/montant";
import { MENTION_SIMULATION } from "@/lib/config/constantes";
import type { EncaissementAccepte } from "@/types/encaissement";

/**
 * Troisième pas : le reçu.
 *
 * `role="status"` sur le bloc entier : le caissier vient de cliquer, l'écran a
 * changé sans que le focus bouge, et un lecteur d'écran doit annoncer le
 * résultat.
 *
 * La mention de simulation est répétée ICI, en plus du bandeau du layout. Un
 * reçu est ce qu'on montre au client, ce qu'on photographie, ce qu'on imprime :
 * il doit porter la mention même détaché de son écran.
 */
export function EtapeRecu({
  transaction,
  onSuivant,
}: {
  transaction: EncaissementAccepte;
  onSuivant: () => void;
}) {
  const heure = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(transaction.regleA);

  return (
    <section className="etape recu" role="status" aria-labelledby="recu-titre">
      <h1 className="encaissement__titre" id="recu-titre">
        {transaction.rejoue ? "Déjà encaissé" : "Encaissement accepté"}
      </h1>

      {transaction.rejoue && (
        <p className="encaissement__aide">
          Ce paiement avait déjà été enregistré. Rien n&apos;a été débité une
          seconde fois.
        </p>
      )}

      <p className="encaissement__somme">{formaterCentimes(transaction.montant)}</p>

      <dl className="encaissement__faits">
        <dt>Client</dt>
        <dd>{transaction.beneficiaire}</dd>
        <dt>Référence</dt>
        <dd className="encaissement__code">{transaction.reference}</dd>
        <dt>Enregistré le</dt>
        <dd>
          <time dateTime={new Date(transaction.regleA).toISOString()}>{heure}</time>
        </dd>
      </dl>

      <p className="encaissement__mention">
        <strong>{MENTION_SIMULATION}</strong> — ce reçu ne vaut pas justificatif
        de paiement.
      </p>

      <div className="actions">
        <button
          type="button"
          className="bouton bouton--action"
          onClick={onSuivant}
          autoFocus
        >
          Encaissement suivant
        </button>
      </div>
    </section>
  );
}
