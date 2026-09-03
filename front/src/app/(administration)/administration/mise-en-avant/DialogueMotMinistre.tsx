"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Le mot du ministre, au moment de mettre un partenaire en avant.
 *
 * ═══ FACULTATIF, ET LE BOUTON N'ATTEND PAS QU'ON ÉCRIVE ═══
 *
 * À la différence de `DialogueMotif` — dont il ne réutilise PAS le composant,
 * volontairement, voir plus bas — le bouton de confirmation est actif dès
 * l'ouverture. Un motif de suspension DOIT exister ; un mot du ministre PEUT
 * ne pas exister, et beaucoup de mises en avant n'en porteront jamais un.
 * Bloquer la confirmation tant que le champ est vide contredirait le mot
 * « facultatif » de l'énoncé.
 *
 * ═══ POURQUOI CE N'EST PAS `DialogueMotif` ═══
 *
 * `DialogueMotif` incarne un motif TECHNIQUE et OBLIGATOIRE — une
 * justification qu'on doit pouvoir opposer à quelqu'un. Ici c'est l'inverse
 * sur les deux plans : un texte facultatif, et surtout un texte qui n'a rien
 * d'une justification. Le réutiliser en désactivant sa contrainte
 * d'obligation ferait porter à un seul composant deux tons opposés — celui
 * qui refuse et celui qui célèbre — et le jour où l'un des deux textes
 * changerait, l'autre risquerait de suivre par erreur.
 *
 * Il en reprend en revanche toute la mécanique déjà éprouvée : `<dialog>`
 * natif (focus capturé, Échap qui ferme, page inerte derrière).
 *
 * ═══ LE TON EST DIT, PAS SEULEMENT ATTENDU ═══
 *
 * Le texte d'aide sous le champ rappelle que ce n'est pas un motif : ce sont
 * des mots qui paraîtront sur la vitrine publique, adressés au public, pas à
 * l'administration. Un administrateur qui écrirait par réflexe « dossier
 * conforme, RAS » — le ton d'un motif d'acceptation — doit être rappelé à
 * l'ordre avant d'envoyer, pas après.
 */
export function DialogueMotMinistre({
  nomPartenaire,
  enCours,
  erreur,
  onAnnuler,
  onConfirmer,
}: {
  nomPartenaire: string;
  enCours: boolean;
  erreur: string | null;
  onAnnuler: () => void;
  /** `mot` est `null` si le champ est laissé vide : voir `regulariser`-style union ailleurs. */
  onConfirmer: (mot: string | null) => void;
}) {
  const fenetre = useRef<HTMLDialogElement>(null);
  const [mot, setMot] = useState("");

  useEffect(() => {
    const element = fenetre.current;
    if (element !== null && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={fenetre}
      className="dialogue"
      aria-labelledby="mot-ministre-titre"
      onCancel={(evenement) => {
        evenement.preventDefault();
        if (!enCours) onAnnuler();
      }}
    >
      <form
        method="dialog"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          if (!enCours) {
            const nettoye = mot.trim();
            onConfirmer(nettoye === "" ? null : nettoye);
          }
        }}
      >
        <h2 className="dialogue__titre" id="mot-ministre-titre">
          Mettre {nomPartenaire} en avant
        </h2>

        <p className="dialogue__rappel">
          Un mot du ministre est facultatif. S&apos;il est écrit, il paraît tel
          quel sur la vitrine publique — adressé au public, pas à
          l&apos;administration. Le ton est positif : ce n&apos;est pas un motif
          qui justifie une décision, comme pour un refus ou une suspension.
        </p>

        <label htmlFor="mot-ministre-texte">Mot du ministre (facultatif)</label>
        <textarea
          id="mot-ministre-texte"
          value={mot}
          disabled={enCours}
          placeholder="Par exemple : « Un savoir-faire qui fait la fierté du quartier. »"
          aria-describedby="mot-ministre-aide"
          onChange={(evenement) => setMot(evenement.target.value)}
        />
        <p className="dialogue__aide" id="mot-ministre-aide">
          Laissez vide pour mettre en avant sans commentaire.
        </p>

        {erreur !== null && (
          <p className="dialogue__erreur" role="alert">
            {erreur}
          </p>
        )}

        <div className="actions">
          <button
            type="button"
            className="bouton bouton--discret"
            disabled={enCours}
            onClick={onAnnuler}
          >
            Annuler
          </button>
          <button type="submit" className="bouton bouton--action" disabled={enCours}>
            {enCours ? "Publication…" : "Mettre en avant"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
