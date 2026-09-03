"use client";

import { formaterCentimes } from "@/lib/montant";
import { formaterDate } from "@/lib/utils/date";
import { PastilleStatut } from "@/components/partenaires/PastilleStatut";
import type { ComptePartenaire } from "@/types/domaine";

/**
 * Le tableau du registre.
 *
 * Composant de présentation : il ne charge rien et ne décide rien. Il reçoit
 * des comptes et trois gestes, il rend des lignes.
 *
 * ─── Le défilement horizontal ───
 *
 * Il vit dans `.tableau-defilant`, jamais sur la page. Le conteneur porte
 * `tabindex={0}` et un nom accessible : une zone qui défile doit être
 * atteignable au clavier, sinon les colonnes de droite ne sont pas consultables
 * sans souris.
 *
 * ─── Une seule ligne bloquée à la fois ───
 *
 * `enCours` porte l'identifiant du compte dont l'action est en vol, pas un
 * booléen. Seuls les boutons de CETTE ligne se désactivent ; le reste du
 * tableau reste utilisable, et l'agent peut continuer à lire pendant qu'une
 * décision part.
 */
export function TableauPartenaires({
  comptes,
  enCours,
  onSuspendre,
  onReactiver,
  onFermer,
}: {
  comptes: ComptePartenaire[];
  /** Identifiant du compte dont une action est en vol, ou `null`. */
  enCours: string | null;
  onSuspendre: (compte: ComptePartenaire) => void;
  onReactiver: (compte: ComptePartenaire) => void;
  onFermer: (compte: ComptePartenaire) => void;
}) {
  return (
    <div
      className="tableau-defilant"
      tabIndex={0}
      role="region"
      aria-label="Registre des comptes partenaires, défilement horizontal"
    >
      <table className="registre">
        <caption>
          {comptes.length === 1
            ? "1 compte partenaire"
            : `${comptes.length} comptes partenaires`}
          , classés par enseigne.
        </caption>
        <thead>
          <tr>
            <th scope="col">Établissement</th>
            <th scope="col" className="registre__secondaire-colonne">
              Catégorie
            </th>
            <th scope="col" className="registre__secondaire-colonne">
              Ville
            </th>
            <th scope="col">Statut</th>
            <th scope="col">Activité</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {comptes.map((compte) => {
            const bloquee = enCours === compte.id;
            return (
              <tr key={compte.id} aria-busy={bloquee ? true : undefined}>
                <th scope="row" className="registre__enseigne">
                  {compte.enseigne}
                  <span className="registre__raison-sociale">{compte.raisonSociale}</span>
                  {/* Repli : sous un conteneur étroit, les deux colonnes
                      secondaires disparaissent et se replient ici. Rien n'est
                      perdu, tout change de place. */}
                  <span className="registre__repli">
                    {compte.categorie}
                    {" · "}
                    {compte.ville ?? "En ligne"}
                  </span>
                </th>

                <td className="registre__secondaire-colonne demande__categorie">
                  {compte.categorie}
                </td>

                <td className="registre__secondaire-colonne">
                  {compte.ville === null ? (
                    <span className="registre__secondaire">En ligne, sans établissement</span>
                  ) : (
                    <>
                      {compte.ville}
                      {compte.departement !== null && (
                        <span className="registre__secondaire"> ({compte.departement})</span>
                      )}
                    </>
                  )}
                </td>

                <td>
                  <PastilleStatut statut={compte.statut} />
                  {compte.decideeLe !== null && (
                    <span className="registre__secondaire">
                      <br />
                      depuis le{" "}
                      <time dateTime={compte.decideeLe}>{formaterDate(compte.decideeLe)}</time>
                    </span>
                  )}
                </td>

                <td className="registre__nombre">
                  {formaterCentimes(compte.totalRecu)}
                  <span className="registre__secondaire">
                    <br />
                    {compte.nombreTransactions === 1
                      ? "1 règlement"
                      : `${compte.nombreTransactions} règlements`}
                  </span>
                </td>

                <td>
                  <div className="registre__actions">
                    {compte.statut === "agree" && (
                      <button
                        type="button"
                        id={`suspendre-${compte.id}`}
                        className="bouton bouton--refus"
                        onClick={() => onSuspendre(compte)}
                        disabled={bloquee}
                      >
                        Suspendre…
                      </button>
                    )}
                    {compte.statut === "suspendu" && (
                      <button
                        type="button"
                        id={`reactiver-${compte.id}`}
                        className="bouton bouton--action"
                        onClick={() => onReactiver(compte)}
                        disabled={bloquee}
                      >
                        {bloquee ? "Réactivation…" : "Réactiver"}
                      </button>
                    )}
                    {(compte.statut === "agree" || compte.statut === "suspendu") && (
                      <button
                        type="button"
                        id={`fermer-${compte.id}`}
                        className="bouton bouton--discret"
                        onClick={() => onFermer(compte)}
                        disabled={bloquee}
                      >
                        Fermer…
                      </button>
                    )}
                    {/* Un compte en attente, refusé ou fermé n'offre aucune
                        action ici : les demandes se tranchent dans Validations,
                        et une fermeture ne se défait pas. */}
                    {compte.statut !== "agree" && compte.statut !== "suspendu" && (
                      <span className="registre__secondaire">Aucune action</span>
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
