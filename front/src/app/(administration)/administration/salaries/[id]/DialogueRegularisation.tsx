"use client";

import { useEffect, useRef, useState } from "react";

import { centimesDepuisSaisie, formaterCentimes } from "@/lib/montant";
import type { SensRegularisation, TroisSoldes } from "@/types/domaine";

/**
 * Le dialogue de régularisation : un sens, un montant, un motif.
 *
 * ─── Pourquoi ce n'est PAS `DialogueMotif` ───
 *
 * `DialogueMotif` demande un motif et rien d'autre ; celui-ci demande trois
 * choses, dont un montant qui doit être validé avant l'envoi. Les fondre
 * imposerait à `DialogueMotif` des champs optionnels que ses deux autres
 * appelants n'utiliseraient jamais — c'est-à-dire lui faire porter le cas
 * particulier d'un troisième. Le changement de statut, lui, réutilise bien
 * `DialogueMotif` tel quel.
 *
 * Il en garde en revanche toute la mécanique : `<dialog>` natif, donc focus
 * capturé, Échap qui ferme, page inerte derrière. Réécrire cela à la main,
 * c'est le réécrire moins bien.
 *
 * ─── Ce que l'écran dit avant d'agir ───
 *
 * Le plafond du débit est annoncé AVANT la saisie, pas après le refus : c'est
 * le disponible, et non le réglé. Un agent qui apprend la règle par un message
 * d'erreur l'apprend une fois de trop.
 *
 * ⚠ Le contrôle ici n'est PAS la garantie. La route refuse par un `409`, et
 * c'est là qu'est la règle R2 — un champ contrôlé se contourne, pas un refus
 * serveur.
 */
export function DialogueRegularisation({
  soldes,
  enCours,
  erreur,
  onAnnuler,
  onConfirmer,
}: {
  soldes: TroisSoldes;
  enCours: boolean;
  erreur: string | null;
  onAnnuler: () => void;
  onConfirmer: (
    sens: SensRegularisation,
    montantCentimes: number,
    motif: string,
  ) => void;
}) {
  const fenetre = useRef<HTMLDialogElement>(null);
  const [sens, setSens] = useState<SensRegularisation>("credit");
  /* La SAISIE, telle qu'elle est tapée. Les centimes en sont dérivés à chaque
     rendu plutôt que stockés : garder les deux, c'est se donner l'occasion de
     les désynchroniser. */
  const [saisie, setSaisie] = useState("");
  const montant = centimesDepuisSaisie(saisie);
  const [motif, setMotif] = useState("");

  useEffect(() => {
    const element = fenetre.current;
    if (element !== null && !element.open) element.showModal();
  }, []);

  const motifNettoye = motif.trim();
  const tropGrand =
    sens === "debit" && montant !== null && montant > soldes.disponible;
  const pretAEnvoyer =
    !enCours && montant !== null && montant > 0 && motifNettoye !== "" && !tropGrand;

  return (
    <dialog
      ref={fenetre}
      className="dialogue"
      aria-labelledby="regularisation-titre"
      onCancel={(evenement) => {
        evenement.preventDefault();
        if (!enCours) onAnnuler();
      }}
    >
      <form
        method="dialog"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          if (pretAEnvoyer && montant !== null) {
            onConfirmer(sens, montant, motifNettoye);
          }
        }}
      >
        <h2 id="regularisation-titre">Régulariser le solde</h2>

        {/*
          Ce que la régularisation fait vraiment, dit avant la saisie.
          L'agent doit savoir qu'il inscrit une écriture, pas qu'il corrige un
          nombre : c'est ce qui rend le motif indispensable plutôt qu'ennuyeux.
        */}
        <p className="dialogue__rappel">
          Une régularisation n&apos;écrit pas un nouveau solde : elle ajoute une
          écriture au registre, qui reste consultable et ne s&apos;efface pas. Le
          solde en découle.
        </p>

        <fieldset className="dialogue__sens">
          <legend>Sens de l&apos;écriture</legend>

          <label>
            <input
              type="radio"
              name="sens"
              value="credit"
              checked={sens === "credit"}
              disabled={enCours}
              onChange={() => setSens("credit")}
            />
            Créditer — ajouter au solde
          </label>

          <label>
            <input
              type="radio"
              name="sens"
              value="debit"
              checked={sens === "debit"}
              disabled={enCours}
              onChange={() => setSens("debit")}
            />
            Débiter — retirer du solde
          </label>
        </fieldset>

        {/*
          Le montant est lu par `centimesDepuisSaisie` : elle découpe la chaîne
          et ne fait JAMAIS `parseFloat(x) * 100`, qui introduirait exactement
          l'erreur qu'on cherche à éviter. « 12,50 » devient 1250, entier.

          ⚠ `components/formulaires/ChampMontant.tsx` est une ébauche vide de
          l'arborescence initiale. Elle le reste : remplir un composant partagé
          pour un unique appelant serait de la généralité spéculative. Le jour
          où l'écran de paiement du salarié sera écrit, les deux saisies
          pourront remonter ensemble.
        */}
        <label htmlFor="regularisation-montant">Montant</label>
        <input
          id="regularisation-montant"
          type="text"
          inputMode="decimal"
          value={saisie}
          placeholder="12,50"
          autoComplete="off"
          spellCheck={false}
          disabled={enCours}
          aria-describedby="regularisation-montant-aide"
          aria-invalid={saisie.trim() !== "" && montant === null}
          onChange={(evenement) => setSaisie(evenement.target.value)}
        />
        <p className="dialogue__aide" id="regularisation-montant-aide">
          En euros. La virgule et le point sont acceptés, deux décimales au plus.
        </p>

        {saisie.trim() !== "" && montant === null && (
          <p className="etat etat--echec" role="alert">
            Ce montant n&apos;est pas lisible. Exemple : 12,50.
          </p>
        )}

        {sens === "debit" && (
          <p className="dialogue__plafond">
            Au plus {formaterCentimes(soldes.disponible)} : c&apos;est le solde
            disponible.
            {soldes.reserve > 0 && (
              <>
                {" "}
                Les {formaterCentimes(soldes.reserve)} réservés par un paiement en
                cours ne peuvent pas être débités.
              </>
            )}
          </p>
        )}

        {tropGrand && (
          <p className="etat etat--echec" role="alert">
            Ce montant dépasse le solde disponible.
          </p>
        )}

        <label htmlFor="regularisation-motif">Motif</label>
        <textarea
          id="regularisation-motif"
          value={motif}
          rows={3}
          disabled={enCours}
          required
          aria-describedby="regularisation-motif-aide"
          onChange={(evenement) => setMotif(evenement.target.value)}
        />
        <p className="dialogue__aide" id="regularisation-motif-aide">
          Obligatoire. Il est inscrit au registre avec l&apos;écriture et reste
          lisible par la suite.
        </p>

        {erreur !== null && (
          <p className="etat etat--echec" role="alert">
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
          <button type="submit" className="bouton bouton--action" disabled={!pretAEnvoyer}>
            {enCours ? "Inscription…" : "Inscrire l'écriture"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
