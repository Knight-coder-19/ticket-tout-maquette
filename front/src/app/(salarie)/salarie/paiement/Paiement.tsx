"use client";

import { useState } from "react";
import { BandeauSimulation } from "@/components/simulation/BandeauSimulation";
import { CarteVisuelle } from "@/components/marque/CarteVisuelle";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { EtatErreur } from "@/components/ui/EtatErreur";
import { Icone } from "@/components/ui/Icone";
import { useCodePaiement } from "@/lib/hooks/useCodePaiement";
import { env } from "@/lib/config/env";
import { centimesDepuisSaisie, formaterCentimes } from "@/lib/montant";
import styles from "../salarie.module.css";
import { CodeAffiche } from "./CodeAffiche";
import { MinuteurValidite } from "./MinuteurValidite";
import { NumeroJeton } from "./NumeroJeton";
import { PaiementAccepte } from "./PaiementAccepte";

const TTL = Math.min(env.qrTtlSecondes, 300);

export function Paiement() {
  const { code, restant, expire, chargement, erreur, generer } = useCodePaiement();
  const [accepte, setAccepte] = useState(false);
  /*
   * ⚠ C'est le salarié qui fixe le montant à l'émission, pas le partenaire à
   * la caisse (`AuthorizeRequest.amount`, data-dictionary.md:401-410 ; D4).
   * Sans ce champ, le back n'a rien à réserver : `POST /me/payment-tokens`
   * refuse un montant absent ou nul (`422 VALIDATION_FAILED`).
   */
  const [saisieMontant, setSaisieMontant] = useState("");
  const montant = centimesDepuisSaisie(saisieMontant);
  const montantInvalide = saisieMontant.trim() !== "" && montant === null;

  if (accepte) {
    return (
      <>
        <header className={`${styles.enTete} ${styles.enTeteCentre}`}>
          <h1>Payer</h1>
        </header>
        <PaiementAccepte onNouveau={() => setAccepte(false)} />
      </>
    );
  }

  return (
    <>
      <header className={`${styles.enTete} ${styles.enTeteCentre}`}>
        <h1>Payer chez un partenaire</h1>
        <p>Présentez ce code au partenaire. Il reste valable {TTL / 60} minutes.</p>
      </header>

      <div className={styles.paiement}>
        <BandeauSimulation />

        {erreur ? (
          <EtatErreur
            message={erreur}
            onReessayer={() => {
              if (montant !== null) void generer(montant);
            }}
          />
        ) : null}

        {!code ? (
          <Carte>
            <p>
              Un code à usage unique est généré à la demande, pour le montant
              que vous choisissez ci-dessous. Il expire automatiquement au
              bout de {TTL / 60} minutes, conformément aux règles de sécurité.
            </p>
            <div className={styles.champMontant}>
              <label htmlFor="paiement-montant">Montant à payer</label>
              <input
                id="paiement-montant"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={saisieMontant}
                aria-invalid={montantInvalide}
                aria-describedby="paiement-montant-aide"
                onChange={(e) => setSaisieMontant(e.target.value)}
              />
              <p className={styles.demo} id="paiement-montant-aide">
                {montantInvalide
                  ? "Montant invalide : deux décimales au plus, strictement positif."
                  : "En euros, réservé sur votre solde disponible dès la génération."}
              </p>
            </div>
            <div style={{ marginTop: "var(--espace-4)" }}>
              <Bouton
                onClick={() => {
                  if (montant !== null) void generer(montant);
                }}
                disabled={chargement || montant === null}
                pleine
              >
                <Icone nom="paiement" taille={18} />
                {chargement ? "Génération…" : "Générer un code de paiement"}
              </Bouton>
            </div>
          </Carte>
        ) : (
          <>
            <CarteVisuelle entete={<span className={styles.soldeMarquePuce}>Code de paiement</span>}>
              <div className={`${styles.code} ${expire ? styles.codeExpire : ""}`}>
                <div className={styles.codeTuile}>
                  <CodeAffiche valeur={code.valeur} expire={expire} />
                </div>
                <NumeroJeton valeur={code.valeur} />
                <p className={styles.demo}>{formaterCentimes(montant ?? 0)}</p>
                <MinuteurValidite restant={restant} total={TTL} />
                {expire ? (
                  <p role="status" style={{ color: "var(--couleur-accent-ambre)", fontWeight: 700 }}>
                    Code expiré. Générez-en un nouveau.
                  </p>
                ) : null}
              </div>
            </CarteVisuelle>

            <div className={styles.actions}>
              <Bouton
                onClick={() => {
                  if (montant !== null) void generer(montant);
                }}
                variante="secondaire"
                disabled={chargement || montant === null}
              >
                <Icone nom="actualiser" taille={16} />
                {expire ? "Nouveau code" : "Régénérer"}
              </Bouton>
              {/* Demonstration : il n'y a pas de vrai scan partenaire sur cette branche. */}
              <Bouton onClick={() => setAccepte(true)} variante="secondaire" disabled={expire}>
                Simuler l&apos;acceptation
              </Bouton>
            </div>
            <p className={styles.demo}>
              Le code affiché est une représentation. Un vrai code de paiement est
              signé par le serveur (équipe backend).
            </p>
          </>
        )}
      </div>
    </>
  );
}
