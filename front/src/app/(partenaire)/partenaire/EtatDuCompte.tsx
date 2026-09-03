import { formaterDate } from "@/lib/utils/date";
import type { MonCompte, StatutPartenaire } from "@/types/domaine";

/**
 * Ce qu'un partenaire voit à la place de son espace quand son compte n'est pas
 * opérationnel.
 *
 * ─── Ce n'est pas une route ───
 *
 * Aucun `page.tsx` ne mène ici. C'est un ÉTAT du compte, porté par le layout :
 * le commerçant tape l'adresse de son espace, et selon l'état de son dossier il
 * reçoit l'espace ou ce message. Le rediriger vers une page dédiée lui
 * demanderait de comprendre pourquoi son adresse a changé.
 *
 * ─── Le ton ───
 *
 * Factuel, jamais culpabilisant. On s'adresse à quelqu'un dont le dossier vient
 * peut-être d'être refusé, et qui n'a rien fait de mal : il a rempli un
 * formulaire, une administration a décidé. Le texte dit ce qui est, pourquoi, et
 * ce qu'il peut faire ensuite. Il ne dit pas « vous n'avez pas », ne commence
 * pas par « malheureusement », et ne suggère nulle part une faute.
 *
 * ─── Les quatre états ───
 *
 * `agree` est le seul état opérationnel ; les quatre autres passent par ici :
 * en attente, refusé, suspendu, fermé. Chacun a son titre, sa situation et sa
 * suite — un partenaire dont le dossier est encore à l'examen n'a pas à lire un
 * message de refus, et le laisser entrer dans un espace où rien ne fonctionne
 * serait pire encore.
 *
 * Le composant s'est d'abord appelé `AdhesionRefusee`. Le nom n'annonçait qu'un
 * des quatre états : renommé, parce qu'un nom qui ment sur son contenu finit
 * par tromper quelqu'un.
 */

const TITRES: Record<StatutPartenaire, string> = {
  en_attente: "Votre demande d'adhésion est en cours d'examen",
  agree: "Votre compte est actif",
  refuse: "Votre demande d'adhésion n'a pas été retenue",
  suspendu: "Votre compte est temporairement suspendu",
  ferme: "Votre compte a été fermé",
};

/** Ce qui est, en une phrase. */
const SITUATIONS: Record<StatutPartenaire, string> = {
  en_attente:
    "Votre dossier a bien été reçu et attend d'être examiné par l'administration du dispositif. L'espace partenaire s'ouvrira dès que la décision sera prise.",
  agree: "Votre établissement peut encaisser les paiements du dispositif.",
  refuse:
    "L'administration du dispositif a examiné votre dossier et ne l'a pas retenu. Les encaissements ne sont pas ouverts pour votre établissement.",
  suspendu:
    "Les encaissements sont interrompus le temps d'une vérification. Votre compte et son historique sont conservés.",
  ferme:
    "Ce compte a été fermé et ne peut plus servir à encaisser. Son historique reste conservé au registre du dispositif.",
};

/** Ce qu'il peut faire ensuite. */
const SUITES: Record<StatutPartenaire, string> = {
  en_attente:
    "Aucune démarche n'est attendue de votre part pour l'instant. Vous serez informé de la décision par courriel.",
  agree: "",
  refuse:
    "Si un élément du dossier vous paraît avoir manqué, vous pouvez déposer une nouvelle demande en le joignant.",
  suspendu:
    "Vous pouvez demander le détail de la vérification en cours et, le cas échéant, la levée de la suspension.",
  ferme:
    "Si cette fermeture ne correspond pas à votre situation, signalez-le : un compte fermé par erreur se traite au cas par cas.",
};

export function EtatDuCompte({ compte }: { compte: MonCompte }) {
  return (
    <section
      className={`adhesion adhesion--${compte.statut}`}
      aria-labelledby="adhesion-titre"
    >
      <h1 className="adhesion__titre" id="adhesion-titre">
        {TITRES[compte.statut]}
      </h1>

      <p>
        {compte.enseigne}
        {compte.ville !== null && <> — {compte.ville}</>}
        {". "}
        {SITUATIONS[compte.statut]}
      </p>

      {/* Le motif, cité tel qu'il a été enregistré. Il vient du champ que le
          contrat déclare « visible du partenaire en cas de rejet »
          (`data-dictionary.md:158`). */}
      {compte.motif !== null && (
        <>
          <p className="adhesion__date">
            Motif enregistré
            {compte.decideeLe !== null && (
              <>
                {" le "}
                <time dateTime={compte.decideeLe}>
                  {formaterDate(compte.decideeLe)}
                </time>
              </>
            )}
            {" :"}
          </p>
          <blockquote className="adhesion__motif">
            <p>{compte.motif}</p>
          </blockquote>
        </>
      )}

      {compte.motif === null && compte.statut !== "en_attente" && (
        <p className="adhesion__date">
          Aucun motif n&apos;a été enregistré avec cette décision. Vous pouvez en
          demander le détail.
        </p>
      )}

      <p className="adhesion__suite">{SUITES[compte.statut]}</p>

      {/*
        À qui s'adresser. L'adresse est celle du dossier, pas une adresse de
        support inventée : c'est par elle que l'administration a déjà écrit, et
        c'est celle que le commerçant reconnaîtra.
      */}
      <p className="adhesion__suite">
        Pour toute question sur ce dossier, écrivez à l&apos;administration du
        dispositif en rappelant votre référence <strong>{compte.id}</strong> et
        l&apos;adresse de votre dossier,{" "}
        <a href={`mailto:${compte.courrielContact}`}>{compte.courrielContact}</a>.
      </p>
    </section>
  );
}
