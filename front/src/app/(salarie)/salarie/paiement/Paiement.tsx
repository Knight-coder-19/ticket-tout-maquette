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
import { salariePrincipal } from "@/mocks/fixtures/salaries";
import styles from "../salarie.module.css";
import { CodeAffiche } from "./CodeAffiche";
import { MinuteurValidite } from "./MinuteurValidite";
import { NumeroJeton } from "./NumeroJeton";
import { PaiementAccepte } from "./PaiementAccepte";

const TTL = Math.min(env.qrTtlSecondes, 300);

export function Paiement() {
  const { code, restant, expire, chargement, erreur, generer } = useCodePaiement(
    salariePrincipal.id,
  );
  const [accepte, setAccepte] = useState(false);

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

        {erreur ? <EtatErreur message={erreur} onReessayer={generer} /> : null}

        {!code ? (
          <Carte>
            <p>
              Un code à usage unique est généré à la demande. Il expire
              automatiquement au bout de {TTL / 60} minutes, conformément aux
              règles de sécurité.
            </p>
            <div style={{ marginTop: "var(--espace-4)" }}>
              <Bouton onClick={generer} disabled={chargement} pleine>
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
                <MinuteurValidite restant={restant} total={TTL} />
                {expire ? (
                  <p role="status" style={{ color: "var(--couleur-accent-ambre)", fontWeight: 700 }}>
                    Code expiré. Générez-en un nouveau.
                  </p>
                ) : null}
              </div>
            </CarteVisuelle>

            <div className={styles.actions}>
              <Bouton onClick={generer} variante="secondaire" disabled={chargement}>
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
