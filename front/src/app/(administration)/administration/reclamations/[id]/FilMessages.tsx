"use client";

import { useState } from "react";

import { formaterDate } from "@/lib/utils/date";
import type { MessageReclamation } from "@/types/domaine";

/**
 * Le fil complet d'un dossier, dans l'ordre, plus le champ pour répondre.
 *
 * ─── Chaque message, son auteur visuellement distingué ───
 *
 * Le texte le dit en toutes lettres (« Vous » / le nom du salarié) ET la
 * position/la teinte le répètent — jamais la couleur seule. Un agent qui
 * relit un long fil doit pouvoir suivre qui a dit quoi sans lire chaque nom.
 *
 * ─── UN DOSSIER CLOS AFFICHE ENCORE SON FIL, EN LECTURE ───
 *
 * Rien n'est masqué après la clôture : les messages restent tous là. Seul le
 * champ de réponse disparaît, remplacé par une note qui dit pourquoi — un
 * dossier clos qui refuserait juste silencieusement de répondre au clic
 * laisserait l'agent chercher ce qui bloque.
 */
export function FilMessages({
  messages,
  nomSalarie,
  clos,
  enCours,
  erreur,
  onRepondre,
}: {
  messages: MessageReclamation[];
  nomSalarie: string;
  clos: boolean;
  enCours: boolean;
  erreur: string | null;
  onRepondre: (texte: string) => void;
}) {
  const [saisie, setSaisie] = useState("");
  const texteNettoye = saisie.trim();

  return (
    <section className="fil-messages" aria-labelledby="fil-titre">
      <h2 className="fil-reclamation__soustitre" id="fil-titre">
        Échanges
      </h2>

      <ol className="fil-messages__liste">
        {messages.map((message) => (
          <li
            key={message.id}
            className={`message message--${message.auteur}`}
          >
            <p className="message__entete">
              <span className="message__auteur">
                {message.auteur === "agent" ? "Vous" : nomSalarie}
              </span>
              <time className="message__date" dateTime={message.envoyeLe}>
                {formaterDate(message.envoyeLe)}
              </time>
            </p>
            <p className="message__texte">{message.texte}</p>
          </li>
        ))}
      </ol>

      {clos ? (
        <p className="fil-messages__clos">
          Ce dossier est clos : il n&apos;accepte plus de nouveau message. Le
          fil ci-dessus reste consultable en entier.
        </p>
      ) : (
        <form
          className="fil-messages__reponse"
          onSubmit={(evenement) => {
            evenement.preventDefault();
            if (!enCours && texteNettoye !== "") {
              onRepondre(texteNettoye);
              setSaisie("");
            }
          }}
        >
          <label htmlFor="fil-reponse-texte">Répondre</label>
          <textarea
            id="fil-reponse-texte"
            value={saisie}
            rows={3}
            disabled={enCours}
            required
            onChange={(evenement) => setSaisie(evenement.target.value)}
          />

          {erreur !== null && (
            <p className="etat etat--echec" role="alert">
              {erreur}
            </p>
          )}

          <div className="actions">
            <button
              type="submit"
              className="bouton bouton--action"
              disabled={enCours || texteNettoye === ""}
            >
              {enCours ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
