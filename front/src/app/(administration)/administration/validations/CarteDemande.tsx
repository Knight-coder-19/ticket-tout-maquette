"use client";

import { formaterAnciennete, formaterDate, joursEcoules } from "@/lib/utils/date";
import type { DemandeAdhesion } from "@/types/domaine";

/**
 * Une demande d'adhesion, telle que l'agent doit la lire pour trancher.
 *
 * Composant de presentation : il ne sait ni charger, ni decider. Il recoit
 * une demande et deux gestes, il rend du HTML. Toute la logique d'ecran vit
 * dans `Validations`.
 *
 * La categorie est affichee TELLE QUE LES DONNEES LA DONNENT. Aucune liste de
 * categories n'apparait dans ce fichier, et il ne doit jamais y en avoir :
 * ajouter, renommer ou retirer une categorie ne doit toucher aucune ligne
 * d'interface (B. Sellami). La mise en capitale est faite en CSS, ce qui
 * n'est pas une traduction.
 */
export function CarteDemande({
  demande,
  enCours,
  onAccepter,
  onRefuser,
}: {
  demande: DemandeAdhesion;
  /** Une decision est en cours pour cette demande : on ne double-clique pas. */
  enCours: boolean;
  onAccepter: () => void;
  onRefuser: () => void;
}) {
  const jours = joursEcoules(demande.deposeeLe);
  const dossierIncomplet = demande.identifiantFiscal === null;

  return (
    <article className="demande" aria-labelledby={`demande-${demande.id}`}>
      <h3 className="demande__enseigne" id={`demande-${demande.id}`}>
        {demande.enseigne}
      </h3>
      <p className="demande__raison-sociale">{demande.raisonSociale}</p>

      <dl className="demande__faits">
        <dt>Identifiant fiscal</dt>
        <dd>
          {demande.identifiantFiscal ?? (
            <span className="pastille pastille--incomplet">
              Dossier incomplet — IFU absent
            </span>
          )}
        </dd>

        <dt>Categorie</dt>
        <dd className="demande__categorie">{demande.categorie}</dd>

        <dt>Ville</dt>
        <dd>
          {demande.ville === null
            ? "Commerce en ligne, sans etablissement"
            : `${demande.ville}${demande.departement === null ? "" : ` (${demande.departement})`}`}
        </dd>

        <dt>Deposee le</dt>
        <dd>
          <time dateTime={demande.deposeeLe}>{formaterDate(demande.deposeeLe)}</time>
        </dd>

        <dt>Attente</dt>
        <dd className="demande__attente">{formaterAnciennete(jours)}</dd>
      </dl>

      <div className="actions">
        {/*
          Accepter en un geste : pas de dialogue, pas de confirmation. Le
          contrat ne demande aucun motif a l'acceptation (`data-dictionary.md:507`),
          et une decision favorable qui se reprend est une decision qu'on
          n'aurait pas du rendre lourde.
        */}
        <button
          type="button"
          className="bouton bouton--action"
          onClick={onAccepter}
          disabled={enCours}
        >
          {enCours ? "Decision en cours…" : "Accepter"}
        </button>

        {/*
          L'identifiant est stable et sert au retour de focus : quand le
          dialogue de refus se ferme sans decision, `Validations` ramene le
          focus ici, sur le bouton qui l'a ouvert.
        */}
        <button
          type="button"
          id={`refuser-${demande.id}`}
          className="bouton bouton--refus"
          onClick={onRefuser}
          disabled={enCours}
        >
          Refuser…
        </button>
      </div>

      {dossierIncomplet && (
        <p className="dialogue__aide">
          Le dossier ne porte pas d'identifiant fiscal. Un refus doit le dire
          dans son motif, pour que le commercant sache quoi joindre.
        </p>
      )}
    </article>
  );
}
