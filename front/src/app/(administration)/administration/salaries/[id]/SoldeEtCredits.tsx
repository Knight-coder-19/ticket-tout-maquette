"use client";

import { formaterCentimes } from "@/lib/montant";
import { MENTION_SIMULATION } from "@/lib/config/constantes";
import type { TroisSoldes } from "@/types/domaine";

/**
 * Les trois soldes d'un bénéficiaire.
 *
 * ═══ ILS NE SONT PAS INTERCHANGEABLES, ET L'ÉCRAN LE DIT ═══
 *
 * C'est la raison d'être de ce composant. Un agent qui ne voit qu'un nombre
 * conclut ce qu'il peut ; s'il voit « disponible : 5,00 € » sur un compte qui
 * en possède 30, il croit à une erreur ou à une perte. Les trois sont donc
 * montrés ensemble, avec la relation qui les lie écrite en toutes lettres.
 *
 * ─── La hiérarchie est délibérée ───
 *
 * `disponible` est en grand : « c'est CE nombre qu'on affiche en grand »
 * (`data-dictionary.md:378`). Les deux autres l'expliquent, en retrait. Mettre
 * les trois à la même taille obligerait à lire les trois pour répondre à la
 * seule question courante — combien cette personne peut-elle dépenser
 * maintenant.
 *
 * ─── La phrase qui compte ───
 *
 * Quand une part est réservée, l'écran dit explicitement qu'elle n'est PAS
 * perdue et pourquoi elle reviendra. C'est la phrase que l'agent répétera au
 * bénéficiaire qui appelle, et elle vaut mieux qu'un nombre qu'il devrait
 * interpréter seul.
 *
 * Aucune part réservée ? La phrase disparaît. Une explication permanente pour
 * un cas qui n'a pas lieu apprend à ne plus lire les explications.
 */
export function SoldeEtCredits({
  soldes,
  jetonsEnCours,
}: {
  soldes: TroisSoldes;
  /** Nombre de paiements en cours : ce qui EXPLIQUE la réservation. */
  jetonsEnCours: number;
}) {
  const reserve = soldes.reserve > 0;

  return (
    <section className="soldes" aria-labelledby="soldes-titre">
      <h2 className="soldes__titre" id="soldes-titre">
        Solde
      </h2>

      <dl className="soldes__liste">
        <div className="soldes__bloc soldes__bloc--principal">
          <dt>Disponible</dt>
          <dd className="soldes__valeur soldes__valeur--grande">
            {formaterCentimes(soldes.disponible)}
          </dd>
        </div>

        <div className="soldes__bloc">
          <dt>Réglé</dt>
          <dd className="soldes__valeur">{formaterCentimes(soldes.regle)}</dd>
        </div>

        <div className="soldes__bloc">
          <dt>Réservé</dt>
          <dd className="soldes__valeur">{formaterCentimes(soldes.reserve)}</dd>
        </div>
      </dl>

      <p className="soldes__relation">
        Disponible = réglé − réservé.
      </p>

      {reserve && (
        <p className="soldes__explication">
          <strong>Ces {formaterCentimes(soldes.reserve)} ne sont pas perdus.</strong>{" "}
          Ils sont immobilisés par{" "}
          {jetonsEnCours === 1
            ? "un paiement en cours"
            : `${jetonsEnCours} paiements en cours`}{" "}
          : le montant a été réservé au moment où le code a été présenté au
          commerçant. Si le paiement aboutit, la somme part ; s&apos;il
          n&apos;aboutit pas, elle revient au disponible dès que le code expire,
          au bout de cinq minutes.
        </p>
      )}

      {/* La mention accompagne toute valeur monétaire affichée. */}
      <p className="soldes__mention">{MENTION_SIMULATION}</p>
    </section>
  );
}
