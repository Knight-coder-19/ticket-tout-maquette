"use client";

import { MENTION_SIMULATION } from "@/lib/config/constantes";
import { formaterDate } from "@/lib/utils/date";
import type { MonCompte } from "@/types/domaine";

/**
 * Le badge à afficher en devanture.
 *
 * Un commerçant agréé doit avoir quelque chose à montrer. C'est la seule pièce
 * du projet destinée à quitter l'écran : elle sort sur du papier, elle est
 * collée sur une vitrine, et plus personne ne voit alors le bandeau de
 * simulation de l'application.
 *
 * ─── Tout ce qui la retient d'être prise pour une vraie ───
 *
 * 1. La mention de simulation est DANS la carte, en tête, avant le nom du
 *    ministère. Elle ne peut pas être prise pour une mention légale de bas de
 *    page, et une découpe qui la retirerait retirerait aussi le bloc-marque.
 * 2. Le bloc-marque est purement typographique. Aucun emblème, aucune
 *    armoirie, aucun sceau dessiné : reproduire une marque de l'État est
 *    précisément ce qui ferait basculer une démonstration en pièce officielle.
 * 3. Le pied porte le mot SPÉCIMEN une seconde fois, avec la référence du
 *    dossier — de quoi vérifier la pièce auprès de l'administration, et de
 *    quoi la dater.
 * 4. Rien n'y est vérifiable : pas de code à scanner, pas de numéro de série,
 *    pas de signature. Une pièce officielle se contrôle ; celle-ci s'annonce.
 *
 * ─── Le bleu encadre, il ne remplit pas ───
 *
 * La charte réserve l'aplat institutionnel à la marque et lui interdit le fond
 * d'un bouton (`tokens.css:13`). Ici il est un filet : c'est ce que la carte
 * peut porter sans enfreindre la règle.
 *
 * ─── L'impression ───
 *
 * La feuille est dans `styles/compte.css`. Elle masque tout puis rend la carte
 * seule visible, et ne fait reposer aucune information sur une couleur de
 * fond : les navigateurs les suppriment à l'impression sauf réglage explicite,
 * et une carte qui compterait sur un aplat sortirait blanche.
 *
 * Le bouton déclenche `window.print()` — d'où `"use client"`. Il est hors de
 * la carte, donc absent du papier.
 */
export function CarteSceau({ compte }: { compte: MonCompte }) {
  return (
    <section aria-labelledby="sceau-titre">
      <h2 className="fiche__titre" id="sceau-titre">
        Votre carte de partenaire
      </h2>
      <p className="compte__intro">
        À imprimer et à afficher en devanture. Elle indique à vos clients que
        votre établissement accepte les paiements du dispositif.
      </p>

      <article className="sceau">
        {/*
          En tête, et non en pied. C'est la première ligne lue, et elle porte
          la formule exacte de `MENTION_SIMULATION` — la même que le bandeau
          de l'application et que tous les écrans où un montant s'affiche.
        */}
        <p className="sceau__specimen">
          <strong>SPÉCIMEN</strong> · {MENTION_SIMULATION}
        </p>

        <div className="sceau__corps">
          <div className="sceau__marque">
            <p className="sceau__ministere">Ministère du Job et Bonheur</p>
            <p className="sceau__dispositif">CartePro</p>
          </div>

          {/*
            La qualité, dans les termes du contrat : « Partenaire Officiel du
            Ministère » (A4). Ce n'est pas une colonne — le front l'affiche
            quand le statut vaut `approved` (`data-dictionary.md:166`), et
            c'est le layout qui garantit qu'on n'arrive ici que dans ce cas.
          */}
          <p className="sceau__qualite">Partenaire agréé</p>

          <p className="sceau__enseigne">{compte.enseigne}</p>
          {compte.ville !== null && <p className="sceau__lieu">{compte.ville}</p>}

          <p className="sceau__pied">
            Référence du dossier {compte.id}
            {compte.decideeLe !== null && ` · agréé le ${formaterDate(compte.decideeLe)}`}
            <br />
            Document de démonstration, sans valeur officielle.
          </p>
        </div>
      </article>

      <div className="actions">
        <button
          type="button"
          className="bouton bouton--discret"
          onClick={() => window.print()}
        >
          Imprimer la carte
        </button>
      </div>
    </section>
  );
}
