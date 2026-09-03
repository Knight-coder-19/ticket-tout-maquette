"use client";

import { DialogueMotif } from "../../DialogueMotif";

/**
 * Le changement de statut d'un bénéficiaire.
 *
 * ═══ IL NE RÉÉCRIT RIEN : IL RÉUTILISE `DialogueMotif` ═══
 *
 * Le dialogue modal, le motif obligatoire, le bouton inactif tant qu'il est
 * vide, le focus capturé, Échap qui ferme : tout cela est déjà écrit, à la
 * racine de l'espace d'administration, et sert la validation d'une adhésion et
 * la suspension d'un compte partenaire. Ce fichier ne fait que le nommer pour
 * le cas du bénéficiaire — un titre, un rappel, un libellé de bouton.
 *
 * C'est la troisième suspension du projet à demander un motif. La première
 * l'avait écrit deux fois ; on ne recommence pas.
 *
 * ═══ LA RÉACTIVATION N'OUVRE AUCUN DIALOGUE ═══
 *
 * Et c'est la moitié qui compte. Rendre ses droits à quelqu'un ne se justifie
 * pas : exiger un motif ferait porter au bénéficiaire la charge d'une
 * suspension qui, peut-être, n'aurait jamais dû avoir lieu. Le contrat suit la
 * même logique pour les partenaires — `approve` répond `204` sans rien lire,
 * `reject` exige une `RejectRequest { reason }` (`data-dictionary.md:507-508`).
 *
 * Le composant ne rend donc RIEN pour une réactivation : l'écran appelle la
 * route directement. Ouvrir un dialogue de confirmation pour un geste
 * réversible et favorable serait une cérémonie sans objet.
 */
export function DialogueStatut({
  nomAffiche,
  enCours,
  erreur,
  onAnnuler,
  onSuspendre,
}: {
  /** Pour que l'agent voie de qui il s'agit sans refermer le dialogue. */
  nomAffiche: string;
  enCours: boolean;
  erreur: string | null;
  onAnnuler: () => void;
  onSuspendre: (motif: string) => void;
}) {
  return (
    <DialogueMotif
      titre={`Suspendre ${nomAffiche}`}
      rappel="La personne ne pourra plus émettre de code de paiement. Son solde et son historique sont conservés, et la suspension se lève à tout moment."
      libelleConfirmation="Suspendre"
      libelleEnCours="Suspension…"
      enCours={enCours}
      erreur={erreur}
      onAnnuler={onAnnuler}
      onConfirmer={onSuspendre}
    />
  );
}
