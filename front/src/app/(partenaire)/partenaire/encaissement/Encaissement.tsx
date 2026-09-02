"use client";

import { useState } from "react";
import { EtapeJeton } from "./EtapeJeton";
import { EtapeMontant } from "./EtapeMontant";
import { formaterCentimes } from "@/lib/montant";
import type { EncaissementAccepte, JetonResolu } from "@/types/encaissement";

/**
 * TODO — à remplacer par l'identifiant porté par la session partenaire,
 * dès que `auth.service.ts` expose l'établissement connecté. C'est le seul
 * fil qui pend dans cet écran.
 */
const PARTENAIRE = "PRT-DEMO";

type Etat =
  | { pas: "jeton" }
  | { pas: "montant"; jeton: JetonResolu }
  | { pas: "accepte"; transaction: EncaissementAccepte };

/**
 * L'encaissement est une machine à trois états, pas un formulaire à
 * plusieurs champs. Le type `Etat` le dit : à l'étape « montant » il y a
 * forcément un jeton résolu, et à l'étape « jeton » il n'y en a pas. Le
 * compilateur refuse alors d'écrire un écran qui demande un montant sans
 * savoir qui paie.
 */
export function Encaissement() {
  const [etat, setEtat] = useState<Etat>({ pas: "jeton" });

  if (etat.pas === "jeton") {
    return (
      <section className="encaissement">
        <EtapeJeton onResolu={(jeton) => setEtat({ pas: "montant", jeton })} />
      </section>
    );
  }

  if (etat.pas === "montant") {
    return (
      <section className="encaissement">
        <EtapeMontant
          key={etat.jeton.token}
          jeton={etat.jeton}
          partnerId={PARTENAIRE}
          onAccepte={(transaction) => setEtat({ pas: "accepte", transaction })}
          onAbandon={() => setEtat({ pas: "jeton" })}
        />
      </section>
    );
  }

  const { transaction } = etat;
  return (
    <section className="encaissement recu" role="status">
      <h2>{transaction.rejoue ? "Déjà encaissé" : "Encaissement accepté"}</h2>

      {transaction.rejoue && (
        <p className="aide">
          Cette opération avait déjà été enregistrée. Rien n'a été débité une
          seconde fois.
        </p>
      )}

      <p className="somme">{formaterCentimes(transaction.amount)}</p>
      <p>
        Client : <strong>{transaction.employee.name}</strong>
      </p>
      <p className="reference">Référence : {transaction.ref}</p>
      <p className="mention">
        Simulation — aucune valeur réelle n&apos;a circulé.
      </p>

      <button type="button" onClick={() => setEtat({ pas: "jeton" })}>
        Nouvel encaissement
      </button>
    </section>
  );
}
