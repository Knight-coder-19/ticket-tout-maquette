"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Le dialogue qui exige un motif avant d'agir.
 *
 * ─── Pourquoi il vit ici, à la racine de l'espace ───
 *
 * Il était écrit deux fois : `DialogueRefus` pour le refus d'une adhésion,
 * `DialogueMotif` pour la suspension d'un compte. C'était le même objet — un
 * dialogue modal, un motif obligatoire, un bouton inactif tant qu'il est vide.
 * Seuls le titre et le libellé du bouton changeaient, et cela ne fait pas deux
 * composants : cela fait deux propriétés.
 *
 * Il est partagé par deux écrans du MÊME espace, il vit donc à la racine du
 * dossier de cet espace — pas dans `src/components/`, qui est réservé à ce que
 * deux espaces ou plus partagent.
 *
 * ─── Pourquoi un `<dialog>` natif et pas une `<div>` ───
 *
 * Trois comportements sont attendus : focus capturé dedans, Échap ferme, le
 * focus revient sur le bouton qui a ouvert. Les deux premiers sont fournis par
 * la plateforme dès qu'on appelle `showModal()` : le navigateur rend le reste
 * de la page inerte, piège la tabulation, et émet `cancel` sur Échap. Les
 * réécrire à la main, c'est réécrire moins bien.
 *
 * Le troisième appartient à l'écran appelant, qui seul sait quel bouton a
 * ouvert le dialogue. `Validations` et `Comptes` le font par un `id` stable.
 *
 * ─── Le bouton de confirmation ───
 *
 * Il reste inactif tant que le motif est vide, et pendant l'envoi — on ne
 * double-clique pas une décision.
 *
 * Ce contrôle n'est PAS la garantie. Les routes refusent un motif vide par un
 * `422` de leur côté, et c'est là qu'est la règle : un bouton grisé se
 * contourne, pas un refus serveur. Ici, c'est de l'aide à la saisie.
 */

/**
 * La règle du bouton de confirmation, isolée pour être vérifiable.
 *
 * `motif.trim()` et non `motif` : accepter « espace espace » reviendrait à
 * laisser passer exactement ce que la règle interdit.
 */
export function peutConfirmerMotif(motif: string, enCours: boolean): boolean {
  return motif.trim() !== "" && !enCours;
}

export function DialogueMotif({
  titre,
  rappel,
  libelleConfirmation,
  libelleEnCours,
  avertissement = null,
  enCours,
  erreur,
  onAnnuler,
  onConfirmer,
}: {
  titre: string;
  /** Ce que le motif engage, en une phrase. Lu avant la saisie. */
  rappel: string;
  libelleConfirmation: string;
  libelleEnCours: string;
  /**
   * Une conséquence sans retour, annoncée AVANT la confirmation.
   *
   * Une action irréversible se signale avant, jamais après. Le bloc apparaît
   * au-dessus du champ de saisie, pas sous le bouton : l'agent doit l'avoir lu
   * pendant qu'il rédige, pas au moment où il clique.
   */
  avertissement?: string | null;
  enCours: boolean;
  erreur: string | null;
  onAnnuler: () => void;
  onConfirmer: (motif: string) => void;
}) {
  const [motif, setMotif] = useState("");
  const dialogue = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const element = dialogue.current;
    if (element === null) return;
    /* `showModal` et non `show` : c'est `showModal` qui rend le reste de la
       page inerte et piège le focus. */
    element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);

  const motifUtile = motif.trim();
  const peutConfirmer = peutConfirmerMotif(motif, enCours);

  return (
    <dialog
      ref={dialogue}
      className="dialogue"
      aria-labelledby="motif-titre"
      /* Échap : le navigateur émet `cancel`. On l'intercepte pour que ce soit
         l'écran appelant qui démonte le dialogue, plutôt que de le laisser se
         fermer dans le dos de son état. */
      onCancel={(evenement) => {
        evenement.preventDefault();
        if (!enCours) onAnnuler();
      }}
    >
      <h2 className="dialogue__titre" id="motif-titre">
        {titre}
      </h2>
      <p className="dialogue__rappel">{rappel}</p>

      {avertissement !== null && (
        <p className="dialogue__avertissement" role="note">
          <strong>Action sans retour.</strong> {avertissement}
        </p>
      )}

      {erreur !== null && (
        <p className="dialogue__erreur" role="alert">
          {erreur}
        </p>
      )}

      <label htmlFor="motif-champ">Motif</label>
      <textarea
        id="motif-champ"
        name="motif"
        value={motif}
        onChange={(evenement) => setMotif(evenement.target.value)}
        disabled={enCours}
        aria-describedby="motif-aide"
        /* Le focus part ici à l'ouverture : c'est le seul geste attendu. */
        autoFocus
      />
      <p className="dialogue__aide" id="motif-aide">
        {motifUtile === ""
          ? "Sans motif, la décision ne peut pas être enregistrée."
          : `${motifUtile.length} caractères.`}
      </p>

      <div className="actions">
        <button
          type="button"
          className="bouton bouton--refus"
          onClick={() => onConfirmer(motifUtile)}
          disabled={!peutConfirmer}
        >
          {enCours ? libelleEnCours : libelleConfirmation}
        </button>
        <button
          type="button"
          className="bouton bouton--discret"
          onClick={onAnnuler}
          disabled={enCours}
        >
          Annuler
        </button>
      </div>
    </dialog>
  );
}
