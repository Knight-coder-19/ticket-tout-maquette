"use client";

import { LegendeCompletude } from "@/components/tableaux/LegendeCompletude";
import { TableauDefilant } from "@/components/tableaux/TableauDefilant";
import type { ComptePartenaire } from "@/types/domaine";

/**
 * La liste des partenaires agréés, avec un interrupteur par ligne.
 *
 * ─── Seuls les agréés y figurent, et à deux niveaux ───
 *
 * L'écran appelant ne demande que des comptes `statut: "agree"` au registre
 * (`listerComptes({ statut: "approved" })`) : ce tableau ne reçoit donc que des
 * lignes déjà filtrées. Mais la garantie qui compte n'est pas ici — elle est
 * dans `ajouterMiseEnAvant` (`mocks/magasin.ts`), qui refuse l'écriture même
 * si ce filtre côté écran était contourné. Un tableau qui ne fait QUE cacher
 * les inéligibles resterait un filtre de confort, pas une règle.
 *
 * ─── L'interrupteur, pas une case à cocher ───
 *
 * `role="switch"` sur un bouton : l'état bascule d'un geste, sans ouvrir de
 * formulaire pour retirer, et sans qu'aucune saisie ne soit requise pour
 * ajouter SANS mot — le dialogue ne s'ouvre que si l'écran appelant choisit
 * de le proposer. Le texte dit l'état (« En avant » / « Absent ») ; la couleur
 * ne fait que le répéter.
 */
export function TableauBascule({
  comptes,
  enAvant,
  resteAVenir,
  enCours,
  onBasculer,
}: {
  comptes: ComptePartenaire[];
  /** Identifiants des partenaires actuellement en avant sur l'emplacement courant. */
  enAvant: ReadonlySet<string>;
  resteAVenir: boolean;
  /** Identifiant du partenaire dont la bascule est en vol, ou `null`. */
  enCours: string | null;
  /** `vers` dit le sens voulu : `true` pour mettre en avant, `false` pour retirer. */
  onBasculer: (compte: ComptePartenaire, vers: boolean) => void;
}) {
  return (
    <TableauDefilant etiquette="Partenaires agréés">
      <table className="registre">
        <LegendeCompletude
          nombre={comptes.length}
          resteAVenir={resteAVenir}
          singulier="partenaire agréé"
          pluriel="partenaires agréés"
          suite="par ordre alphabétique. Seuls les partenaires agréés peuvent être mis en avant."
        />
        <thead>
          <tr>
            <th scope="col">Enseigne</th>
            <th scope="col" className="registre__secondaire-colonne">
              Catégorie
            </th>
            <th scope="col" className="registre__secondaire-colonne">
              Ville
            </th>
            <th scope="col">Sur la vitrine</th>
          </tr>
        </thead>
        <tbody>
          {comptes.map((compte) => {
            const actif = enAvant.has(compte.id);
            const bloque = enCours === compte.id;
            return (
              <tr key={compte.id} aria-busy={bloque ? true : undefined}>
                <th scope="row" className="registre__enseigne">
                  {compte.enseigne}
                  <span className="registre__repli">{compte.categorie}</span>
                </th>

                <td className="registre__secondaire-colonne">{compte.categorie}</td>

                <td className="registre__secondaire-colonne">
                  {compte.ville ?? <span className="registre__secondaire">En ligne</span>}
                </td>

                <td>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={actif}
                    className={`bascule ${actif ? "bascule--active" : ""}`}
                    disabled={bloque}
                    onClick={() => onBasculer(compte, !actif)}
                  >
                    <span className="bascule__piste" aria-hidden="true">
                      <span className="bascule__curseur" />
                    </span>
                    <span className="bascule__libelle">
                      {actif ? "En avant" : "Absent"}
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableauDefilant>
  );
}
