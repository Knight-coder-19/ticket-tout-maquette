import { PastilleStatut } from "@/components/partenaires/PastilleStatut";
import { formaterDate } from "@/lib/utils/date";
import type { MonCompte } from "@/types/domaine";

/**
 * Ce que le dispositif sait de l'établissement, rendu à son titulaire.
 *
 * ─── En lecture, parce que le contrat ne permet rien d'autre ───
 *
 * Les vingt-huit routes de la section 4 ne comportent AUCUNE modification d'un
 * partenaire : ni `PUT`, ni `PATCH` sur `/partner/...`, ni côté administration
 * — `approve` et `reject` ne touchent que le statut. Le seul `PUT` du contrat
 * réordonne les mises en avant (:530).
 *
 * L'écran ne propose donc aucun bouton « Modifier ». Un formulaire qui
 * enverrait sa requête à une route inexistante échouerait sous les doigts du
 * commerçant, après qu'il aurait ressaisi ses informations.
 *
 * ⚠ Et le canal de correction n'est pas écrit non plus : pas de route de
 * réclamation, pas d'adresse de support, aucun `contact_*` du dispositif —
 * `contact_email` est celui DU partenaire, l'adresse à laquelle on lui écrit.
 * Le texte le dit tel quel plutôt que d'inventer une adresse : dans un
 * dispositif de l'État, une adresse fausse est pire qu'une adresse absente.
 *
 * ─── Les valeurs manquantes s'affichent, ici ───
 *
 * Le catalogue OMET une valeur absente : un client n'a que faire d'une ligne
 * vide. La fiche, elle, la MONTRE — c'est un relevé de ce que le dispositif
 * détient, et l'absence est justement ce que le commerçant peut signaler. Un
 * identifiant fiscal manquant disparaîtrait s'il était omis, et personne ne
 * saurait qu'il l'est.
 */

/** Ce que le dispositif ne détient pas. */
function Absente({ children }: { children: React.ReactNode }) {
  return <span className="fiche__absente">{children}</span>;
}

/**
 * La ville, ou la raison pour laquelle il n'y en a pas.
 *
 * `city_id` est `NULL` si et seulement si le commerce est en ligne
 * (contrainte `physical_needs_city`, A1). Sans le mode de service, l'écran
 * afficherait « non renseignée » à un commerçant qui n'a rien oublié.
 */
function Ville({ compte }: { compte: MonCompte }) {
  if (compte.ville !== null) return <>{compte.ville}</>;
  if (compte.modeService === "en_ligne") {
    return <Absente>Sans objet — commerce exclusivement en ligne</Absente>;
  }
  return <Absente>Non renseignée</Absente>;
}

export function FicheEtablissement({ compte }: { compte: MonCompte }) {
  return (
    <section className="fiche" aria-labelledby="fiche-titre">
      <h2 className="fiche__titre" id="fiche-titre">
        Fiche de l&apos;établissement
      </h2>
      <p className="compte__intro">
        Ces informations sont celles que le dispositif détient sur votre
        établissement. Elles ne se modifient pas depuis cet espace.
      </p>

      <dl className="fiche__liste">
        <dt className="fiche__intitule">Enseigne</dt>
        <dd className="fiche__valeur">{compte.enseigne}</dd>

        <dt className="fiche__intitule">Raison sociale</dt>
        <dd className="fiche__valeur">{compte.raisonSociale}</dd>

        <dt className="fiche__intitule">Identifiant fiscal</dt>
        <dd className="fiche__valeur">
          {compte.identifiantFiscal ?? <Absente>Non renseigné</Absente>}
        </dd>

        <dt className="fiche__intitule">Catégorie</dt>
        <dd className="fiche__valeur">{compte.categorie}</dd>

        <dt className="fiche__intitule">Ville</dt>
        <dd className="fiche__valeur">
          <Ville compte={compte} />
        </dd>

        {/*
          « Décision d'agrément » et non « Membre depuis » : le champ est
          `reviewed_at`, la date de la DERNIÈRE décision. Pour un compte
          rouvert après une suspension, c'est celle de la réouverture. La date
          du tout premier agrément n'est récupérable nulle part — la colonne
          est écrasée à chaque décision, et le journal d'audit qui la
          conserverait n'a aucune route de lecture. Intituler cette ligne
          « Membre depuis » afficherait une date fausse pour ces comptes-là.
        */}
        <dt className="fiche__intitule">Décision d&apos;agrément</dt>
        <dd className="fiche__valeur">
          {compte.decideeLe === null ? (
            <Absente>Aucune décision enregistrée</Absente>
          ) : (
            formaterDate(compte.decideeLe)
          )}
        </dd>

        <dt className="fiche__intitule">Statut</dt>
        <dd className="fiche__valeur">
          <PastilleStatut statut={compte.statut} />
        </dd>

        <dt className="fiche__intitule">Demande déposée le</dt>
        <dd className="fiche__valeur">{formaterDate(compte.deposeeLe)}</dd>

        <dt className="fiche__intitule">Courriel de contact</dt>
        <dd className="fiche__valeur">{compte.courrielContact}</dd>
      </dl>

      <p className="compte__intro">
        Pour corriger l&apos;une de ces informations, adressez-vous à
        l&apos;administration du dispositif : elle seule peut les modifier, et
        aucune démarche n&apos;est possible depuis cet espace. Le canal de
        correction n&apos;est pas encore ouvert dans ce démonstrateur — il
        reste à fixer par le dispositif.
      </p>
    </section>
  );
}
