"use client";

import { formaterCentimes } from "@/lib/montant";
import { formaterDate } from "@/lib/utils/date";
import type { EcritureRegistre, NatureEcriture } from "@/types/domaine";

/**
 * Le libellé de chaque nature.
 *
 * Énumération fermée du contrat (`operation_kind`, `data-dictionary.md:61`),
 * traduite pour l'écran — à ne pas confondre avec les catégories de
 * partenaires, qui viennent des données et ne s'écrivent jamais dans un
 * composant.
 */
const NATURES: Record<NatureEcriture, string> = {
  rechargement: "Rechargement",
  paiement: "Paiement",
  annulation: "Annulation",
  decheance: "Déchéance",
};

/** Le titulaire, dit en français plutôt qu'en identifiant de colonne. */
const TITULAIRES: Record<EcritureRegistre["typeTitulaire"], string> = {
  employee: "Salarié",
  partner: "Partenaire",
  system: "Compte système",
};

/**
 * Le tableau des écritures, la plus récente d'abord.
 *
 * ─── Le lien entre une écriture et son annulation, DES DEUX CÔTÉS ───
 *
 * Une correction comptable ne se lit que si l'on voit les deux pièces. Le
 * tableau les relie dans les deux sens :
 *   - l'écriture d'origine dit « annulée par l'écriture n° X » ;
 *   - l'écriture inverse dit « annule l'écriture n° Y ».
 *
 * Les deux liens sont des boutons qui mettent l'autre ligne en évidence et y
 * amènent le focus. Un lien à sens unique laisserait l'agent chercher.
 *
 * ─── Une seule ligne bloquée ───
 *
 * `enCours` porte l'identifiant de l'opération en cours d'annulation, pas un
 * booléen : seuls les boutons de cette ligne se désactivent.
 */
export function TableauEcritures({
  ecritures,
  enCours,
  visee,
  resteAVenir,
  onAnnuler,
  onViser,
}: {
  ecritures: EcritureRegistre[];
  /** Identifiant de l'opération dont l'annulation est en vol, ou `null`. */
  enCours: string | null;
  /** `seq` de l'écriture mise en évidence par un lien, ou `null`. */
  visee: number | null;
  /** Vrai s'il reste des écritures plus anciennes à charger. */
  resteAVenir: boolean;
  onAnnuler: (ecriture: EcritureRegistre) => void;
  onViser: (seq: number) => void;
}) {
  /* Pour relier une annulation à son origine : l'opération inverse porte, dans
     son libellé, l'identifiant de celle qu'elle corrige. On retrouve donc la
     ligne d'origine dans la page courante quand elle y est. */
  const origineDe = (ecriture: EcritureRegistre): EcritureRegistre | undefined => {
    if (ecriture.nature !== "annulation") return undefined;
    return ecritures.find(
      (autre) => autre.annuleePar === ecriture.operationId && autre.sens === "debit",
    );
  };

  return (
    <div
      className="tableau-defilant"
      tabIndex={0}
      role="region"
      aria-label="Registre des écritures, défilement horizontal"
    >
      <table className="registre">
        <caption>
          {ecritures.length === 1 ? "1 écriture" : `${ecritures.length} écritures`}
          {resteAVenir ? " affichées, d'autres restent à charger" : " au total"}, la
          plus récente d&apos;abord. L&apos;ordre est celui du journal, celui que la
          chaîne de hachage fige.
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Référence</th>
            <th scope="col">Bénéficiaire</th>
            <th scope="col" className="registre__secondaire-colonne">
              Partenaire
            </th>
            <th scope="col">Montant</th>
            <th scope="col">Nature</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {ecritures.map((ecriture) => {
            const bloquee = enCours === ecriture.operationId;
            const origine = origineDe(ecriture);
            const annulable =
              ecriture.sens === "debit" &&
              ecriture.annuleePar === null &&
              ecriture.nature !== "annulation";

            const classes = [
              ecriture.annuleePar !== null ? "ecriture--annulee" : "",
              visee === ecriture.seq ? "ecriture--visee" : "",
            ]
              .filter((c) => c !== "")
              .join(" ");

            return (
              <tr
                key={ecriture.seq}
                id={`ecriture-${ecriture.seq}`}
                className={classes === "" ? undefined : classes}
                aria-busy={bloquee ? true : undefined}
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
                  {ecriture.titulaire}
                  <span className="registre__secondaire">
                    <br />
                    {TITULAIRES[ecriture.typeTitulaire]}
                  </span>
                </td>

                <td className="registre__secondaire-colonne">
                  {ecriture.typeTitulaire === "partner" ? ecriture.titulaire : "—"}
                </td>

                <td className={`ecriture__sens ecriture__sens--${ecriture.sens}`}>
                  {ecriture.sens === "debit" ? "−" : "+"}
                  {formaterCentimes(ecriture.montant)}
                  <span className="registre__secondaire">
                    <br />
                    {ecriture.sens === "debit" ? "Débit" : "Crédit"}
                  </span>
                </td>

                <td>
                  <span className={`statut nature--${ecriture.nature}`}>
                    {NATURES[ecriture.nature]}
                  </span>

                  {/* Côté 1 : l'écriture d'origine dit qui l'a annulée. */}
                  {ecriture.annuleePar !== null && (
                    <span className="ecriture__lien">
                      Annulée
                      {ecriture.motifAnnulation !== null && (
                        <>
                          {" — "}
                          {ecriture.motifAnnulation}
                        </>
                      )}
                    </span>
                  )}

                  {/* Côté 2 : l'annulation dit ce qu'elle corrige. */}
                  {origine !== undefined && (
                    <span className="ecriture__lien">
                      <button type="button" onClick={() => onViser(origine.seq)}>
                        Annule l&apos;écriture n° {origine.seq}
                      </button>
                    </span>
                  )}
                </td>

                <td>
                  <div className="registre__actions">
                    {annulable ? (
                      <button
                        type="button"
                        id={`annuler-${ecriture.seq}`}
                        className="bouton bouton--refus"
                        onClick={() => onAnnuler(ecriture)}
                        disabled={bloquee}
                      >
                        Annuler…
                      </button>
                    ) : (
                      <span className="registre__secondaire">
                        {ecriture.annuleePar !== null
                          ? "Déjà annulée"
                          : ecriture.nature === "annulation"
                            ? "Une annulation ne s'annule pas"
                            : "—"}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
