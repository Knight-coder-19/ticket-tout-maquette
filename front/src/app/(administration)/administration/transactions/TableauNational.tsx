"use client";

import { LegendeCompletude } from "@/components/tableaux/LegendeCompletude";
import { TableauDefilant } from "@/components/tableaux/TableauDefilant";
import { formaterCentimes } from "@/lib/montant";
import type { TransactionNationale } from "@/types/domaine";

/**
 * Le tableau de l'activité nationale.
 *
 * ─── Ce qu'il ne refait pas ───
 *
 * La zone défilante et la légende de complétude viennent de
 * `components/tableaux/`, où elles ont remonté en écrivant cet écran : elles
 * étaient jusque-là écrites deux fois, dans le registre et dans le journal du
 * commerçant, et celui-ci en aurait été la troisième copie. Les classes
 * `.registre*` et la pastille sont dans `primitives.css`. Rien n'est recopié.
 *
 * ─── Ce qu'il montre, et que le registre ne montre pas ───
 *
 * Une ligne par PAIEMENT, avec la ville et la catégorie du commerçant. Le
 * registre montre les deux écritures d'une opération, leur empreinte et leur
 * rang dans la chaîne ; celui-ci montre l'activité. Même fait, deux questions.
 *
 * ─── Une ville absente n'est pas une donnée manquante ───
 *
 * Un commerce en ligne n'a pas de ville, par contrainte du schéma
 * (`physical_needs_city`, A1). La cellule le dit en toutes lettres plutôt que
 * d'afficher un tiret qu'on lirait comme une lacune.
 */
export function TableauNational({
  transactions,
  resteAVenir,
}: {
  transactions: TransactionNationale[];
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
    <TableauDefilant etiquette="Transactions nationales">
      <table className="registre">
        <LegendeCompletude
          nombre={transactions.length}
          resteAVenir={resteAVenir}
          singulier="transaction"
          pluriel="transactions"
          feminin
          suite="la plus récente d'abord. Le total en tête porte sur l'ensemble du filtre, pas sur cette page."
        />
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Partenaire</th>
            <th scope="col">Ville</th>
            <th scope="col" className="registre__secondaire-colonne">
              Catégorie
            </th>
            {/* L'unité est dans l'en-tête, pas répétée dans chaque cellule. */}
            <th scope="col" className="registre__nombre">
              Montant
            </th>
            <th scope="col">État</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr
              key={transaction.id}
              className={transaction.annulee ? "ecriture--annulee" : undefined}
            >
              <td>
                <time dateTime={transaction.survenueLe}>
                  {quand(transaction.survenueLe)}
                </time>
                {/* Repli : sous un conteneur étroit, la colonne de catégorie
                    disparaît et se retrouve ici. Rien n'est perdu. */}
                <span className="registre__repli">
                  {transaction.categorie ?? "catégorie inconnue"}
                </span>
              </td>

              <th scope="row" className="registre__enseigne">
                {transaction.enseigne ?? "Établissement introuvable"}
                <span className="registre__secondaire">
                  <br />
                  {transaction.partenaireId}
                </span>
              </th>

              <td>
                {transaction.ville === null ? (
                  <span className="registre__secondaire">En ligne</span>
                ) : (
                  <>
                    {transaction.ville}
                    <span className="registre__secondaire">
                      <br />
                      {transaction.departement}
                    </span>
                  </>
                )}
              </td>

              <td className="registre__secondaire-colonne">
                {transaction.categorie ?? "—"}
              </td>

              <td className="registre__nombre">
                {formaterCentimes(transaction.montant)}
              </td>

              <td>
                {/* Le texte dit l'état ; la couleur ne fait que le répéter. */}
                <span
                  className={
                    transaction.annulee
                      ? "statut nature--annulation"
                      : "statut nature--paiement"
                  }
                >
                  {transaction.annulee ? "Annulée" : "Réglée"}
                </span>
                {transaction.motifAnnulation !== null && (
                  <span className="registre__secondaire">
                    <br />
                    {transaction.motifAnnulation}
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
