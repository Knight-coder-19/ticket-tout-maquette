"use client";

import Link from "next/link";

import { LegendeCompletude } from "@/components/tableaux/LegendeCompletude";
import { TableauDefilant } from "@/components/tableaux/TableauDefilant";
import { formaterCentimes } from "@/lib/montant";
import type { LigneRepertoire, StatutBeneficiaire } from "@/types/domaine";

/**
 * Le répertoire, en tableau.
 *
 * Un tableau et non des fiches : on y compare des soldes et des statuts d'une
 * ligne à l'autre, et on cherche une personne dans une liste. C'est le même
 * raisonnement que pour le registre des comptes partenaires — et l'inverse de
 * celui du catalogue, où rien ne se compare colonne par colonne.
 *
 * La zone défilante et la légende de complétude viennent de
 * `components/tableaux/`. Les classes `.registre*` sont dans `primitives.css`.
 * Rien n'est recopié.
 *
 * ─── Le solde affiché est le DISPONIBLE ───
 *
 * Une seule colonne de solde, et c'est celle-là : « c'est CE nombre qu'on
 * affiche en grand » (`data-dictionary.md:378`). Les trois soldes sont sur la
 * fiche — un répertoire n'est pas l'endroit où expliquer une réservation, et
 * trois colonnes de montants se confondraient à la lecture.
 */

/** Les trois valeurs de `user_status`, en toutes lettres. */
const LIBELLES: Record<StatutBeneficiaire, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  ferme: "Fermé",
};

/** La forme est dans `primitives.css` ; le vocabulaire est celui du salarié. */
function PastilleBeneficiaire({ statut }: { statut: StatutBeneficiaire }) {
  const teinte =
    statut === "actif" ? "agree" : statut === "suspendu" ? "suspendu" : "ferme";
  return <span className={`statut statut--${teinte}`}>{LIBELLES[statut]}</span>;
}

export function TableauSalaries({
  lignes,
  resteAVenir,
}: {
  lignes: LigneRepertoire[];
  resteAVenir: boolean;
}) {
  return (
    <TableauDefilant etiquette="Répertoire des bénéficiaires">
      <table className="registre">
        <LegendeCompletude
          nombre={lignes.length}
          resteAVenir={resteAVenir}
          singulier="bénéficiaire"
          pluriel="bénéficiaires"
          suite="par ordre alphabétique."
        />
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Employeur</th>
            <th scope="col" className="registre__secondaire-colonne">
              Matricule
            </th>
            <th scope="col">Statut</th>
            {/* L'unité est dans l'en-tête, pas répétée dans chaque cellule. */}
            <th scope="col" className="registre__nombre">
              Solde disponible
            </th>
            <th scope="col">Fiche</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.id}>
              <th scope="row" className="registre__enseigne">
                {ligne.nomAffiche}
                {/* Repli : sous un conteneur étroit, la colonne du matricule
                    disparaît et se retrouve ici. Rien n'est perdu. */}
                <span className="registre__repli">{ligne.matricule}</span>
              </th>

              <td>
                {ligne.employeur ?? (
                  <span className="registre__secondaire">Employeur introuvable</span>
                )}
              </td>

              <td className="registre__secondaire-colonne">{ligne.matricule}</td>

              <td>
                <PastilleBeneficiaire statut={ligne.statut} />
              </td>

              <td className="registre__nombre">{formaterCentimes(ligne.disponible)}</td>

              <td>
                <div className="registre__actions">
                  <Link
                    href={`/administration/salaries/${ligne.id}`}
                    className="bouton bouton--discret"
                  >
                    Ouvrir
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableauDefilant>
  );
}
