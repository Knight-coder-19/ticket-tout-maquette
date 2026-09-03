"use client";

import "@/styles/encaissement.css";

import { useState } from "react";
import { EtapeConfirmation } from "./EtapeConfirmation";
import { EtapeJeton } from "./EtapeJeton";
import { EtapeRecu } from "./EtapeRecu";
import type { EncaissementAccepte, JetonResolu } from "@/types/encaissement";

/**
 * L'encaissement, en trois pas.
 *
 * ─── Une machine à états, pas un formulaire ───
 *
 * Le type `Etat` est une union discriminée, et c'est ce qui rend l'écran juste
 * par construction : au pas « confirmation » il y a forcément un jeton résolu,
 * au pas « code » il n'y en a pas, et au pas « reçu » il y a forcément une
 * transaction. Le compilateur refuse d'écrire un écran qui confirmerait un
 * paiement sans savoir lequel.
 *
 * ─── Ce qui a disparu ───
 *
 * L'étape « montant » et sa saisie. Dans le modèle du back, le salarié fixe le
 * montant à l'émission et les fonds sont réservés ; le caissier confirme. Il
 * n'y a plus rien à saisir entre le code et la validation — d'où trois pas et
 * non quatre.
 *
 * ─── Pourquoi `key` sur la confirmation ───
 *
 * Elle porte un compte à rebours et la mémoire d'une tentative déjà envoyée.
 * Changer de jeton doit repartir d'un état neuf : sans `key`, React réutilise
 * l'instance et le nouveau paiement hériterait du minuteur du précédent.
 */
type Etat =
  | { pas: "code" }
  | { pas: "confirmation"; jeton: JetonResolu; parScan: boolean }
  | { pas: "recu"; transaction: EncaissementAccepte };

export function Encaissement() {
  const [etat, setEtat] = useState<Etat>({ pas: "code" });

  if (etat.pas === "code") {
    return (
      <div className="encaissement">
        <EtapeJeton
          onResolu={(jeton) =>
            /* `parScan: false` : seule la saisie manuelle est branchée. Le jour
               où la caméra le sera, c'est `EtapeJeton` qui dira par où le jeton
               est arrivé — le règlement envoie alors `jti` plutôt que le code
               court, et `entry_mode` s'en déduit côté serveur. */
            setEtat({ pas: "confirmation", jeton, parScan: false })
          }
        />
      </div>
    );
  }

  if (etat.pas === "confirmation") {
    return (
      <div className="encaissement">
        <EtapeConfirmation
          key={etat.jeton.jti}
          jeton={etat.jeton}
          parScan={etat.parScan}
          onAccepte={(transaction) => setEtat({ pas: "recu", transaction })}
          onAbandon={() => setEtat({ pas: "code" })}
        />
      </div>
    );
  }

  return (
    <div className="encaissement">
      <EtapeRecu
        transaction={etat.transaction}
        onSuivant={() => setEtat({ pas: "code" })}
      />
    </div>
  );
}
