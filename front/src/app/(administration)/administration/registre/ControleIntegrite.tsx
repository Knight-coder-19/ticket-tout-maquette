"use client";

import type { VerificationIntegrite } from "@/types/domaine";

/**
 * Le contrôle d'intégrité de la chaîne.
 *
 * ─── Pourquoi ce n'est pas une pastille verte ───
 *
 * Une coche ne prouve rien. Elle ne dit ni combien d'écritures ont été lues,
 * ni quand. Un jury à qui l'on montre une pastille verte n'a aucune raison d'y
 * croire — et il a raison : rien ne distingue une pastille calculée d'une
 * pastille peinte.
 *
 * Le résultat porte donc trois nombres, dans le flux du texte :
 *   - l'état de la chaîne, en toutes lettres ;
 *   - le nombre d'écritures réellement vérifiées ;
 *   - l'heure du contrôle, à la seconde.
 *
 * Et quand la chaîne est rompue, la POSITION de la première écriture fautive.
 * C'est ce chiffre-là qui transforme « il y a un problème » en « allez voir
 * l'écriture 7 ».
 *
 * L'heure vient du front, pas du serveur : la route ne rend pas d'horodatage
 * (`data-dictionary.md:576-580`). Un résultat d'intégrité sans heure pourrait
 * dater d'hier.
 */
export function ControleIntegrite({
  resultat,
  enCours,
  onVerifier,
}: {
  resultat: VerificationIntegrite | null;
  enCours: boolean;
  onVerifier: () => void;
}) {
  const heure =
    resultat === null
      ? null
      : new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "long",
          timeStyle: "medium",
          timeZone: "UTC",
        }).format(resultat.controleeA);

  const classe =
    enCours || resultat === null
      ? "attente"
      : resultat.intacte
        ? "intacte"
        : "rompue";

  return (
    <section className="controle" aria-labelledby="controle-titre">
      <h2 className="controle__titre" id="controle-titre">
        Intégrité de la chaîne
      </h2>

      {/*
        `aria-live="polite"` : le résultat arrive après coup, sans que le focus
        bouge. Sans cela, un lecteur d'écran ne dirait jamais que la
        vérification a répondu.
      */}
      <p
        className={`controle__resultat controle__resultat--${classe}`}
        role="status"
        aria-live="polite"
      >
        {enCours && (
          <>
            <span className="controle__travail" aria-hidden="true" />
            Vérification en cours : chaque écriture est relue et son empreinte
            recalculée…
          </>
        )}

        {!enCours && resultat === null && (
          <>Aucun contrôle n&apos;a encore été lancé pendant cette session.</>
        )}

        {!enCours && resultat !== null && (
          <>
            <span
              className={`controle__verdict controle__verdict--${resultat.intacte ? "intacte" : "rompue"}`}
            >
              {resultat.intacte
                ? "Chaîne intègre"
                : "Chaîne rompue — le registre a été altéré"}
            </span>

            <span className="controle__chiffres">
              {resultat.ecrituresVerifiees === 1
                ? "1 écriture vérifiée"
                : `${resultat.ecrituresVerifiees} écritures vérifiées`}
            </span>
            {resultat.intacte ? (
              <>
                {" "}
                — chacune porte bien l&apos;empreinte de celle qui la précède.
              </>
            ) : (
              <>
                {" "}
                — la première en défaut est l&apos;écriture{" "}
                <span className="controle__chiffres">
                  n° {resultat.premiereFautive}
                </span>
                .
              </>
            )}

            <span className="controle__heure">
              Contrôle du{" "}
              <time dateTime={new Date(resultat.controleeA).toISOString()}>
                {heure}
              </time>{" "}
              (UTC)
            </span>
          </>
        )}
      </p>

      <div className="controle__action">
        <button
          type="button"
          id="relancer-controle"
          className="bouton bouton--action"
          onClick={onVerifier}
          disabled={enCours}
        >
          {enCours ? "Vérification…" : "Vérifier la chaîne"}
        </button>
      </div>
    </section>
  );
}
