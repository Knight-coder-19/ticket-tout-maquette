"use client";

import { useEffect, useRef, useState } from "react";
import type { DemandeAdhesion } from "@/types/domaine";

/**
 * Le dialogue de refus. Motif obligatoire (B. Sellami).
 *
 * ─── Pourquoi un `<dialog>` natif et pas une `<div>` ───
 *
 * Trois comportements sont demandes : focus capture dedans, Echap ferme, le
 * focus revient sur le bouton qui a ouvert. Les deux premiers sont fournis par
 * la plateforme des lors qu'on appelle `showModal()` : le navigateur rend le
 * reste de la page inerte, piege la tabulation dans le dialogue, et emet
 * `cancel` sur Echap. Les reecrire a la main, c'est reecrire moins bien.
 *
 * Le troisieme est gere par `Validations`, qui sait quel bouton a ouvert le
 * dialogue et l'identifie par un `id` stable.
 *
 * ─── Le bouton de confirmation ───
 *
 * Il reste inactif tant que le motif est vide. `motif.trim()` et non `motif` :
 * accepter « espace espace » reviendrait a laisser passer exactement ce que la
 * regle interdit. Il se desactive aussi pendant l'envoi -- on ne double-clique
 * pas une decision.
 *
 * Le controle n'est PAS la garantie. La route refuse un motif vide en 422 de
 * son cote (`admin/partners/[id]/reject/route.ts`), et c'est la qu'est la
 * regle : un bouton grise se contourne, pas un refus serveur. Ici, c'est de
 * l'aide a la saisie.
 */
/**
 * La regle du bouton de confirmation, isolee pour etre verifiable.
 *
 * `motif.trim()` et non `motif` : accepter « espace espace » reviendrait a
 * laisser passer exactement ce que la regle interdit. Et `enCours` desactive
 * aussi -- on ne double-clique pas une decision.
 */
export function peutConfirmerRefus(motif: string, enCours: boolean): boolean {
  return motif.trim() !== "" && !enCours;
}

export function DialogueRefus({
  demande,
  enCours,
  erreur,
  onAnnuler,
  onConfirmer,
}: {
  demande: DemandeAdhesion;
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
       page inerte et piege le focus. */
    element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);

  const motifUtile = motif.trim();
  const peutConfirmer = peutConfirmerRefus(motif, enCours);

  return (
    <dialog
      ref={dialogue}
      className="dialogue"
      aria-labelledby="refus-titre"
      /* Echap : le navigateur emet `cancel`. On l'intercepte pour que ce soit
         `Validations` qui demonte le dialogue, plutot que de le laisser se
         fermer dans le dos de l'etat de l'ecran. */
      onCancel={(evenement) => {
        evenement.preventDefault();
        if (!enCours) onAnnuler();
      }}
    >
      <h2 className="dialogue__titre" id="refus-titre">
        Refuser l&apos;adhésion de {demande.enseigne}
      </h2>
      <p className="dialogue__rappel">
        Le motif est obligatoire et sera enregistré avec la décision. Il est
        communiqué au commerçant : écrivez ce qu&apos;il doit corriger.
      </p>

      {erreur !== null && (
        <p className="dialogue__erreur" role="alert">
          {erreur}
        </p>
      )}

      <label htmlFor="motif-refus">Motif du refus</label>
      <textarea
        id="motif-refus"
        name="motif"
        value={motif}
        onChange={(evenement) => setMotif(evenement.target.value)}
        disabled={enCours}
        aria-describedby="motif-aide"
        /* Le focus part ici a l'ouverture : c'est le seul geste attendu. */
        autoFocus
      />
      <p className="dialogue__aide" id="motif-aide">
        {motifUtile === ""
          ? "Sans motif, le refus ne peut pas être enregistré."
          : `${motifUtile.length} caractères.`}
      </p>

      <div className="actions">
        <button
          type="button"
          className="bouton bouton--refus"
          onClick={() => onConfirmer(motifUtile)}
          disabled={!peutConfirmer}
        >
          {enCours ? "Enregistrement…" : "Confirmer le refus"}
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
