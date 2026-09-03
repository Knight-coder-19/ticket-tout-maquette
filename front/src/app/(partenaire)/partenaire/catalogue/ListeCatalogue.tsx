"use client";

import type { FicheCatalogue } from "@/types/domaine";

/**
 * Le réseau des partenaires agréés.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * UNE LISTE DE FICHES, PAS UN TABLEAU
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Le fichier s'appelait `TableauCatalogue`. Trois raisons ont fait pencher
 * pour une liste, et elles tiennent à la donnée, pas au goût :
 *
 *   1. RIEN NE SE COMPARE COLONNE PAR COLONNE. Un tableau existe pour aligner
 *      des grandeurs qu'on met en regard — des volumes, des dates, des états.
 *      Le catalogue ne porte aucun chiffre : ce sont des coordonnées. Le
 *      registre des comptes, lui, EST un tableau, parce qu'on y compare des
 *      recettes et des statuts et qu'on y agit.
 *
 *   2. LA MOITIÉ DES CHAMPS SONT NULLABLES. `city`, `district`, `address_line`
 *      et `website_url` peuvent tous manquer (`data-dictionary.md:475-478`), et
 *      un commerce en ligne n'a par construction ni ville ni adresse. Un
 *      tableau afficherait des rangées de cellules vides ; une fiche omet
 *      simplement la ligne.
 *
 *   3. LES LONGUEURS SONT HÉTÉROGÈNES. « Au Marché de Lyon, Halle centrale,
 *      allée 3, Croix-Rousse » à côté de « Services Plus » : en colonnes,
 *      l'une force la largeur que l'autre laisse vide.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * SA PROPRE FICHE EST DISTINGUÉE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * C'est la seule qu'un commerçant peut vérifier. Elle porte un marqueur
 * TEXTUEL — « Votre établissement » — et pas seulement un fond de couleur : un
 * agent qui ne perçoit pas les teintes, ou qui imprime, doit la reconnaître.
 *
 * Elle porte aussi la phrase qui donne son sens à l'écran : voilà ce que vos
 * clients voient. Un commerçant qui trouve une erreur dans sa fiche sait alors
 * qu'elle est publique, et qu'il faut la corriger.
 */

const MODES: Record<FicheCatalogue["modeService"], string> = {
  physique: "Sur place",
  en_ligne: "En ligne",
  les_deux: "Sur place et en ligne",
};

function Fiche({ fiche, estLaMienne }: { fiche: FicheCatalogue; estLaMienne: boolean }) {
  const lieu =
    fiche.ville === null
      ? null
      : [fiche.ville, fiche.departement].filter((p) => p !== null).join(", ");

  return (
    <li className={estLaMienne ? "fiche fiche--mienne" : "fiche"}>
      <article aria-labelledby={`fiche-${fiche.id}`}>
        <div className="fiche__tete">
          <h3 className="fiche__enseigne" id={`fiche-${fiche.id}`}>
            {fiche.enseigne}
          </h3>
          {/* Le marqueur est TEXTUEL. La couleur ne fait que le répéter. */}
          {estLaMienne && (
            <span className="statut fiche__marqueur">Votre établissement</span>
          )}
          {fiche.estOfficiel && (
            <span className="statut nature--rechargement">Partenaire officiel</span>
          )}
        </div>

        <p className="fiche__categorie">{fiche.categorie}</p>

        <dl className="fiche__faits">
          <dt>Mode</dt>
          <dd>{MODES[fiche.modeService]}</dd>

          {/* Une ligne omise plutôt qu'une cellule vide : c'est tout l'intérêt
              de la fiche sur le tableau. */}
          {lieu !== null && (
            <>
              <dt>Ville</dt>
              <dd>{lieu}</dd>
            </>
          )}

          {fiche.quartier !== null && (
            <>
              <dt>Quartier</dt>
              <dd>{fiche.quartier}</dd>
            </>
          )}

          {fiche.adresse !== null && (
            <>
              <dt>Adresse</dt>
              <dd>{fiche.adresse}</dd>
            </>
          )}

          {fiche.siteWeb !== null && (
            <>
              <dt>Site</dt>
              <dd>
                {/*
                  `rel="noreferrer"` : le site d'un partenaire est une adresse
                  que nous n'entretenons pas, et rien ne justifie de lui
                  transmettre l'adresse de la page d'où vient le visiteur.
                */}
                <a href={fiche.siteWeb} target="_blank" rel="noreferrer">
                  {fiche.siteWeb.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </>
          )}
        </dl>

        {estLaMienne && (
          <p className="fiche__note">
            Voilà ce que vos clients voient dans le catalogue. Si une
            information est inexacte, signalez-la à l&apos;administration du
            dispositif.
          </p>
        )}
      </article>
    </li>
  );
}

export function ListeCatalogue({
  fiches,
  monId,
  resteAVenir,
}: {
  fiches: FicheCatalogue[];
  /** Identifiant du partenaire connecté, pour distinguer sa fiche. */
  monId: string | null;
  /** Vrai s'il reste des fiches à charger. */
  resteAVenir: boolean;
}) {
  return (
    <>
      {/*
        Le compte, et s'il est complet.
        Même règle que les deux registres : une liste qui s'arrête à la
        première page sans le dire laisse croire qu'on a vu tout le réseau.
      */}
      <p className="catalogue__compte" role="status">
        {fiches.length === 1 ? "1 établissement agréé" : `${fiches.length} établissements agréés`}
        {resteAVenir ? " affichés, d'autres restent à charger." : " au total."}
      </p>

      <ul className="catalogue__liste">
        {fiches.map((fiche) => (
          <Fiche key={fiche.id} fiche={fiche} estLaMienne={fiche.id === monId} />
        ))}
      </ul>
    </>
  );
}
