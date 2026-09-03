"use client";

import { LegendeCompletude } from "@/components/tableaux/LegendeCompletude";
import { TableauDefilant } from "@/components/tableaux/TableauDefilant";
import { formaterCentimes } from "@/lib/montant";
import type { LigneEncaissement } from "@/types/encaissement";

/** Le mode d'entrée, dit en français. Énumération fermée du contrat. */
const MODES: Record<LigneEncaissement["modeSaisie"], string> = {
  qr_scan: "QR scanné",
  short_code: "Code saisi",
};

/**
 * Le tableau des encaissements.
 *
 * Le tableau défilant, les classes `.registre*` et la pastille viennent de
 * `primitives.css`, partagés avec les deux registres de l'administration. Rien
 * n'est recopié ici.
 *
 * ─── Il dit s'il est complet ───
 *
 * `resteAVenir` traverse jusqu'à la légende du tableau. C'est le défaut trouvé
 * sur le registre de l'administration : une page de 20 lignes affichée comme si
 * c'était tout, et le commerçant croit avoir vu son mois entier. La légende dit
 * donc « 20 encaissements affichés, d'autres restent à charger » ou « 34
 * encaissements au total » — jamais un nombre nu qui laisse deviner.
 */
export function TableauEncaissements({
  lignes,
  resteAVenir,
}: {
  lignes: LigneEncaissement[];
  resteAVenir: boolean;
}) {
  const quand = (iso: string): string =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(Date.parse(iso));

  return (
    <TableauDefilant etiquette="Journal des encaissements">
      <table className="registre">
        <LegendeCompletude
          nombre={lignes.length}
          resteAVenir={resteAVenir}
          singulier="encaissement"
          pluriel="encaissements"
          suite="le plus récent d'abord."
        />
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Référence</th>
            <th scope="col">Bénéficiaire</th>
            <th scope="col">Montant</th>
            <th scope="col" className="registre__secondaire-colonne">
              Mode d&apos;entrée
            </th>
            <th scope="col">État</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.reference}>
              <td>
                <time dateTime={ligne.survenueLe}>{quand(ligne.survenueLe)}</time>
                {/* Repli : sous un conteneur étroit, la colonne du mode
                    disparaît et se retrouve ici. Rien n'est perdu. */}
                <span className="registre__repli">{MODES[ligne.modeSaisie]}</span>
              </td>

              <th scope="row" className="ecriture__reference">
                {ligne.reference.slice(0, 8)}…
              </th>

              <td>{ligne.beneficiaire}</td>

              <td className="registre__nombre">{formaterCentimes(ligne.montant)}</td>

              <td className="registre__secondaire-colonne">{MODES[ligne.modeSaisie]}</td>

              <td>
                {/* Le texte dit l'état ; la couleur ne fait que le répéter. */}
                <span
                  className={
                    ligne.etat === "annule"
                      ? "statut nature--annulation"
                      : "statut nature--paiement"
                  }
                >
                  {ligne.etat === "annule" ? "Annulé" : "Réglé"}
                </span>
                {ligne.motifAnnulation !== null && (
                  <span className="registre__secondaire">
                    <br />
                    {ligne.motifAnnulation}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableauDefilant>
  );
}
