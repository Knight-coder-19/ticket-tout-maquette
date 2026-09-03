"use client";

import { JournalEcritures } from "@/components/tableaux/JournalEcritures";
import type { EcritureRegistre } from "@/types/domaine";

/**
 * Les écritures du compte d'un bénéficiaire.
 *
 * ═══ C'EST ICI QUE R1 SE VOIT ═══
 *
 * Après une régularisation, le solde a changé ET la ligne qui l'explique
 * apparaît en tête, mise en évidence. Un solde qui bougerait sans qu'aucune
 * écriture n'apparaisse serait la preuve que quelqu'un a écrit un nombre à la
 * main.
 *
 * Un simple habillage de `JournalEcritures` (`components/tableaux/`), sans
 * la colonne « Bénéficiaire » : sur la fiche d'une seule personne, elle serait
 * redondante avec le titre de l'écran. « Derniers mouvements » des
 * rechargements en a eu besoin, lui, parce qu'il couvre plusieurs comptes à
 * la fois — c'est la seule différence entre les deux écrans.
 */
export function OperationsSalarie({
  ecritures,
  resteAVenir,
  miseEnEvidence,
}: {
  ecritures: EcritureRegistre[];
  resteAVenir: boolean;
  miseEnEvidence: string | null;
}) {
  return (
    <JournalEcritures
      ecritures={ecritures}
      resteAVenir={resteAVenir}
      miseEnEvidence={miseEnEvidence}
    />
  );
}
