"use client";

import { LegendeCompletude } from "./LegendeCompletude";
import { TableauDefilant } from "./TableauDefilant";
import { formaterCentimes } from "@/lib/montant";
import { formaterDate } from "@/lib/utils/date";
import type { EcritureRegistre, NatureEcriture } from "@/types/domaine";

/**
 * Le journal en lecture seule des écritures d'un compte, ou de plusieurs.
 *
 * ─── Pourquoi il a remonté ───
 *
 * Écrit pour la fiche d'un bénéficiaire (une seule personne, donc aucune
 * colonne « Bénéficiaire » n'avait de sens), puis « Derniers mouvements » des
 * rechargements en a eu besoin à l'identique, à ceci près qu'il couvre
 * PLUSIEURS comptes et doit donc dire lequel chaque ligne concerne. Deux
 * écrans, un même objet — `avecBeneficiaire` est la seule différence, pas une
 * raison d'écrire deux tableaux.
 *
 * ─── Ce qu'il n'est PAS ───
 *
 * Le registre de l'administration (`administration/registre/TableauEcritures`)
 * reste un composant à part : il porte les liens d'annulation, les deux
 * colonnes titulaire/partenaire et les actions. Ici, aucune action — c'est un
 * RELEVÉ, pas un poste de travail. Les deux partagent seulement le
 * vocabulaire des natures (`LIBELLES_NATURE`), qui était recopié à l'identique
 * dans les deux fichiers.
 *
 * ─── Le sens est dit en toutes lettres ───
 *
 * « Débit » et « Crédit », pas seulement un signe et une couleur.
 */

/**
 * Le libellé de chaque nature, en toutes lettres.
 *
 * ⚠ Recopié à l'identique dans deux fichiers avant de remonter ici. Une seule
 * énumération fermée du contrat (`operation_kind`), plus `regularisation`,
 * notre ajout — voir `mocks/registre.ts`.
 */
export const LIBELLES_NATURE: Record<NatureEcriture, string> = {
  rechargement: "Rechargement",
  paiement: "Paiement",
  annulation: "Annulation",
  decheance: "Déchéance",
  regularisation: "Régularisation",
};

export function JournalEcritures({
  ecritures,
  resteAVenir,
  miseEnEvidence,
  avecBeneficiaire = false,
  suite = "la plus récente d'abord. Le solde est la somme de ces lignes, jamais une valeur saisie.",
}: {
  ecritures: EcritureRegistre[];
  resteAVenir: boolean;
  /**
   * `operationId` de l'écriture à mettre en évidence, ou `null`.
   *
   * Renseigné juste après une écriture qui vient d'être inscrite — une
   * régularisation, un rechargement — pour que l'agent voie LA sienne, pas
   * « une » ligne de plus.
   */
  miseEnEvidence: string | null;
  /**
   * Vrai quand le journal couvre plusieurs comptes : une colonne
   * supplémentaire dit alors lequel chaque ligne concerne. Faux sur la fiche
   * d'un seul bénéficiaire, où la question ne se pose pas.
   */
  avecBeneficiaire?: boolean;
  /** La fin de la légende, propre à ce que l'écran appelant veut rappeler. */
  suite?: string;
}) {
  return (
    <TableauDefilant etiquette="Écritures">
      <table className="registre">
        <LegendeCompletude
          nombre={ecritures.length}
          resteAVenir={resteAVenir}
          singulier="écriture"
          pluriel="écritures"
          feminin
          suite={suite}
        />
        <thead>
          <tr>
            <th scope="col">Date</th>
            {avecBeneficiaire && <th scope="col">Bénéficiaire</th>}
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

              {avecBeneficiaire && (
                <td className="registre__enseigne">{ecriture.titulaire}</td>
              )}

              <th scope="row" className="ecriture__reference">
                n° {ecriture.seq}
                <span className="ecriture__empreinte">
                  {ecriture.empreinte.slice(0, 16)}…
                </span>
              </th>

              <td>
                <span className={`statut nature--${ecriture.nature}`}>
                  {LIBELLES_NATURE[ecriture.nature]}
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
