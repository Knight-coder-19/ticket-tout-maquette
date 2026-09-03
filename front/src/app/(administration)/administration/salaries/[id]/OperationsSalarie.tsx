"use client";

import { LegendeCompletude } from "@/components/tableaux/LegendeCompletude";
import { TableauDefilant } from "@/components/tableaux/TableauDefilant";
import { formaterCentimes } from "@/lib/montant";
import { formaterDate } from "@/lib/utils/date";
import type { EcritureRegistre, NatureEcriture } from "@/types/domaine";

/**
 * Les écritures du compte d'un bénéficiaire.
 *
 * ═══ C'EST ICI QUE R1 SE VOIT ═══
 *
 * Ce tableau est ce qui rend la règle vérifiable à l'écran. Après une
 * régularisation, le solde a changé ET la ligne qui l'explique apparaît en
 * tête, mise en évidence. Un solde qui bougerait sans qu'aucune écriture
 * n'apparaisse serait la preuve que quelqu'un a écrit un nombre à la main.
 *
 * La zone défilante et la légende viennent de `components/tableaux/`.
 *
 * ─── Le sens est dit en toutes lettres ───
 *
 * « Débit » et « Crédit », pas seulement un signe et une couleur. Un signe
 * moins se perd à l'impression et une teinte ne se lit pas en noir et blanc ;
 * sur un relevé de compte, se tromper de sens n'est pas une petite erreur.
 */

const NATURES: Record<NatureEcriture, string> = {
  rechargement: "Rechargement",
  paiement: "Paiement",
  annulation: "Annulation",
  decheance: "Déchéance",
  regularisation: "Régularisation",
};

export function OperationsSalarie({
  ecritures,
  resteAVenir,
  miseEnEvidence,
}: {
  ecritures: EcritureRegistre[];
  resteAVenir: boolean;
  /**
   * `operationId` de l'écriture à mettre en évidence, ou `null`.
   *
   * Renseigné juste après une régularisation : la ligne qui vient d'être
   * inscrite se distingue, pour que l'agent voie SON écriture et non « une »
   * écriture de plus.
   */
  miseEnEvidence: string | null;
}) {
  return (
    <TableauDefilant etiquette="Écritures du compte">
      <table className="registre">
        <LegendeCompletude
          nombre={ecritures.length}
          resteAVenir={resteAVenir}
          singulier="écriture"
          pluriel="écritures"
          feminin
          suite="la plus récente d'abord. Le solde est la somme de ces lignes, jamais une valeur saisie."
        />
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Référence</th>
            <th scope="col">Nature</th>
            <th scope="col" className="registre__secondaire-colonne">
              Motif
            </th>
            <th scope="col" className="registre__nombre">
              Montant
            </th>
          </tr>
        </thead>
        <tbody>
          {ecritures.map((ecriture) => (
            <tr
              key={ecriture.seq}
              className={
                miseEnEvidence === ecriture.operationId ? "ecriture--visee" : undefined
              }
            >
              <td>
                <time dateTime={ecriture.survenueLe}>
                  {formaterDate(ecriture.survenueLe)}
                </time>
              </td>

              <th scope="row" className="ecriture__reference">
                n° {ecriture.seq}
                <span className="ecriture__empreinte">
                  {ecriture.empreinte.slice(0, 16)}…
                </span>
              </th>

              <td>
                <span className={`statut nature--${ecriture.nature}`}>
                  {NATURES[ecriture.nature]}
                </span>
                {miseEnEvidence === ecriture.operationId && (
                  <span className="ecriture__lien">Écriture que vous venez d&apos;inscrire</span>
                )}
              </td>

              <td className="registre__secondaire-colonne">
                {ecriture.libelle ?? "—"}
              </td>

              <td className={`ecriture__sens ecriture__sens--${ecriture.sens}`}>
                {ecriture.sens === "debit" ? "−" : "+"}
                {formaterCentimes(ecriture.montant)}
                <span className="registre__secondaire">
                  <br />
                  {ecriture.sens === "debit" ? "Débit" : "Crédit"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableauDefilant>
  );
}
