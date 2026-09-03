"use client";

import { DialogueMotif } from "../../DialogueMotif";

/**
 * La clôture d'un dossier — réutilise `DialogueMotif`, comme partout
 * ailleurs dans l'espace administration.
 *
 * Rien de nouveau à écrire : le dialogue modal, le motif obligatoire, le
 * bouton inactif tant qu'il est vide, le focus capturé, Échap qui ferme —
 * tout cela sert déjà la validation d'une adhésion, la suspension d'un
 * compte partenaire, la suspension d'un bénéficiaire. Ce fichier ne fait que
 * le nommer pour le cas d'une réclamation.
 */
export function DialogueCloture({
  nomSalarie,
  enCours,
  erreur,
  onAnnuler,
  onCloturer,
}: {
  nomSalarie: string;
  enCours: boolean;
  erreur: string | null;
  onAnnuler: () => void;
  onCloturer: (motif: string) => void;
}) {
  return (
    <DialogueMotif
      titre={`Clore le dossier de ${nomSalarie}`}
      rappel="Le fil reste consultable en entier après la clôture, mais n'accepte plus de nouveau message. Le motif explique comment le dossier a été traité."
      libelleConfirmation="Clore le dossier"
      libelleEnCours="Clôture…"
      enCours={enCours}
      erreur={erreur}
      onAnnuler={onAnnuler}
      onConfirmer={onCloturer}
    />
  );
}
