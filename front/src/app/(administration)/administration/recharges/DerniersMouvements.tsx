"use client";

import { JournalEcritures } from "@/components/tableaux/JournalEcritures";
import type { EcritureRegistre } from "@/types/domaine";

/**
 * Les rechargements récents, comme un journal.
 *
 * ═══ C'EST LE MÊME REGISTRE QUE PARTOUT AILLEURS ═══
 *
 * Filtré sur `nature=topup` (`listerEcritures({ nature: "topup" })`,
 * `Recharges.tsx`) : aucune route dédiée, `GET /admin/ledger-entries`
 * (déjà servie pour le registre de l'administration et la fiche d'un
 * bénéficiaire) suffit. C'est ce qui rend R1 vérifiable ici aussi : un
 * rechargement, individuel ou de lot, apparaît dans ce journal exactement
 * comme dans le registre général — la même écriture, jamais une vue à part
 * qui pourrait diverger.
 *
 * ═══ AVEC LA COLONNE « BÉNÉFICIAIRE » ═══
 *
 * `avecBeneficiaire` — voir `JournalEcritures` (`components/tableaux/`) : ce
 * journal couvre PLUSIEURS comptes à la fois, contrairement à la fiche d'un
 * seul bénéficiaire, où la colonne serait redondante.
 */
export function DerniersMouvements({
  ecritures,
  resteAVenir,
  miseEnEvidence,
}: {
  ecritures: EcritureRegistre[];
  resteAVenir: boolean;
  /** `operationId` du rechargement qui vient d'être inscrit, ou `null`. */
  miseEnEvidence: string | null;
}) {
  return (
    <JournalEcritures
      ecritures={ecritures}
      resteAVenir={resteAVenir}
      miseEnEvidence={miseEnEvidence}
      avecBeneficiaire
      suite="le plus récent d'abord. Le solde réglé ET le disponible bougent ensemble à chaque rechargement — contrairement à l'émission d'un jeton, qui ne réserve que le disponible."
    />
  );
}
