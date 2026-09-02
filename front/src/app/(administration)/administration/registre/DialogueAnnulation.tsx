"use client";

import { DialogueMotif } from "../DialogueMotif";
import type { EcritureRegistre } from "@/types/domaine";

/**
 * Le dialogue d'annulation d'une écriture.
 *
 * ─── Ce n'est PAS un second dialogue ───
 *
 * Il n'implémente rien : ni modale, ni piège à focus, ni règle de bouton. Tout
 * cela vit dans `DialogueMotif`, à la racine de l'espace, partagé avec
 * Validations et Comptes.
 *
 * Ce fichier ne porte qu'une chose, et c'est pour cela qu'il existe : les MOTS
 * de la règle R1, dits à l'agent. Les mettre en ligne dans `Registre` les
 * noierait dans la logique d'écran ; les mettre dans `DialogueMotif` les
 * imposerait aux deux autres écrans, où ils seraient faux.
 *
 * ─── Ce que l'avertissement dit, et pourquoi ───
 *
 * « Rien ne sera supprimé. » C'est la règle R1, et l'agent doit la comprendre
 * AVANT de confirmer, pas après : il ne clique pas sur « supprimer », il
 * demande une écriture de plus. Un agent qui croit effacer et qui découvre
 * ensuite deux lignes au registre a été trompé par son interface.
 *
 * Le vocabulaire suit le glossaire : « rien n'est jamais annulé »
 * (`data-dictionary.md:666`), une erreur se corrige par une opération inverse
 * qui laisse la trace des deux (`data-model.md:139-140`). Le mot « annulation »
 * reste dans l'interface parce que c'est celui de l'agent ; le texte explique
 * ce qu'il recouvre.
 */
export function DialogueAnnulation({
  ecriture,
  enCours,
  erreur,
  onAnnuler,
  onConfirmer,
}: {
  ecriture: EcritureRegistre;
  enCours: boolean;
  erreur: string | null;
  onAnnuler: () => void;
  onConfirmer: (motif: string) => void;
}) {
  return (
    <DialogueMotif
      titre={`Annuler l'écriture n° ${ecriture.seq}`}
      rappel="Le motif est obligatoire et reste au registre. Il explique la correction à quiconque relira le journal, y compris dans plusieurs années."
      avertissement="Rien ne sera supprimé. L'écriture d'origine reste au registre, intacte, et une écriture inverse est ajoutée à la suite : elle la référence, porte votre motif, et s'enchaîne comme les autres. Le journal ne perd jamais une ligne — c'est ce qui permet de vérifier qu'il n'a pas été retouché."
      libelleConfirmation="Écrire l'annulation"
      libelleEnCours="Écriture en cours…"
      enCours={enCours}
      erreur={erreur}
      onAnnuler={onAnnuler}
      onConfirmer={onConfirmer}
    />
  );
}
