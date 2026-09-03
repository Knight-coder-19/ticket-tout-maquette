"use client";

import { formaterCentimes } from "@/lib/montant";
import type { ApercuLot } from "@/types/domaine";

/**
 * L'aperçu d'un lot importé, ligne par ligne — jamais un import à l'aveugle.
 *
 * ═══ CE QUE `csv.rs` ET `batch.rs` PRODUISENT, RENDU LISIBLE ═══
 *
 * `csv.rs` ne valide que le FORMAT du fichier ; `batch.rs` résout ensuite
 * chaque ligne contre les salariés réels de l'employeur. Les deux étages
 * produisent la même forme d'erreur, et cette liste ne les distingue pas :
 * une ligne est valide, ou elle ne l'est pas, et la raison est écrite en
 * toutes lettres à côté.
 *
 * ═══ CHAQUE LIGNE, PAS SEULEMENT LES ERREURS ═══
 *
 * Le contrat (`BatchPreview`) ne rend que `errors[]` — les lignes en échec.
 * `lines[]` EST NOTRE AJOUT (voir `types/api.ts`) : un administrateur qui
 * s'apprête à créditer de l'argent public doit pouvoir lire QUI reçoit QUOI,
 * pas seulement combien de lignes ont échoué. Un total et un décompte
 * n'auraient pas permis de repérer une ligne valide mais malencontreuse — le
 * mauvais salarié, le bon montant.
 *
 * ═══ LA VALIDATION EST REFUSÉE, PAS SEULEMENT DÉCONSEILLÉE ═══
 *
 * Le bouton est désactivé dès qu'une ligne porte une erreur — mais ce n'est
 * qu'une aide à la lecture. La route `.../validate` refuse elle-même le lot
 * si une seule ligne est en erreur (`funding/batch.rs:2`) : c'est là qu'est
 * la règle, pas dans ce bouton.
 */
export function ListeBeneficiaires({
  apercu,
  enCours,
  erreur,
  onValider,
}: {
  apercu: ApercuLot;
  enCours: boolean;
  erreur: string | null;
  onValider: () => void;
}) {
  const propre = apercu.erreurs.length === 0;

  return (
    <section className="apercu-lot" aria-labelledby="apercu-titre">
      <h3 className="recharges__soustitre" id="apercu-titre">
        Aperçu — {apercu.nomFichier}
      </h3>

      <p className="apercu-lot__resume">
        {apercu.nombreLignes} {apercu.nombreLignes === 1 ? "ligne" : "lignes"}, pour un total
        de {formaterCentimes(apercu.montantTotal)}.
        {propre ? (
          <> Aucune erreur : prêt à être validé.</>
        ) : (
          <>
            {" "}
            {apercu.erreurs.length}{" "}
            {apercu.erreurs.length === 1 ? "ligne en erreur" : "lignes en erreur"} : la
            validation est refusée tant qu&apos;elles n&apos;ont pas été corrigées dans le
            fichier, puis réimporté.
          </>
        )}
      </p>

      <div
        className="tableau-defilant"
        tabIndex={0}
        role="region"
        aria-label="Lignes de l'import, défilement horizontal"
      >
        <table className="registre">
          <thead>
            <tr>
              <th scope="col">Ligne</th>
              <th scope="col">Matricule ou courriel</th>
              <th scope="col">Salarié résolu</th>
              <th scope="col" className="registre__nombre">
                Montant
              </th>
              <th scope="col">Erreur</th>
            </tr>
          </thead>
          <tbody>
            {apercu.lignes.map((ligne) => (
              <tr
                key={ligne.ligne}
                className={ligne.erreur !== null ? "ecriture--annulee" : undefined}
              >
                <td>{ligne.ligne}</td>
                <td>{ligne.matriculeOuCourriel}</td>
                <td>
                  {ligne.nomResolu ?? (
                    <span className="registre__secondaire">Non résolu</span>
                  )}
                </td>
                <td className="registre__nombre">
                  {ligne.montant === null ? (
                    <span className="registre__secondaire">—</span>
                  ) : (
                    formaterCentimes(ligne.montant)
                  )}
                </td>
                <td>
                  {ligne.erreur !== null && (
                    <span className="etat etat--echec" role="alert">
                      {ligne.erreur}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {erreur !== null && (
        <p className="etat etat--echec" role="alert">
          {erreur}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          className="bouton bouton--action"
          disabled={!propre || enCours}
          onClick={onValider}
        >
          {enCours ? "Validation…" : "Valider l'import"}
        </button>
      </div>
    </section>
  );
}
