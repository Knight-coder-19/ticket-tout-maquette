"use client";

import { useState } from "react";
import { Carte } from "@/components/ui/Carte";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import styles from "../salarie.module.css";
import { FormulaireDemande } from "./FormulaireDemande";
import { ListeDemandes } from "./ListeDemandes";

export function Demandes() {
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);

  return (
    <>
      <header className={styles.enTete}>
        <h1>Mes demandes</h1>
        <p>Signaler un problème sur une opération ou poser une question au support.</p>
      </header>

      <div className={styles.pile}>
        <Carte
          titre="Demandes en cours"
          action={
            !formulaireOuvert ? (
              <Bouton variante="secondaire" onClick={() => setFormulaireOuvert(true)}>
                Nouvelle demande
              </Bouton>
            ) : undefined
          }
        >
          {formulaireOuvert ? (
            <FormulaireDemande
              onEnvoye={() => {
                setFormulaireOuvert(false);
                setEnvoyee(true);
              }}
              onAnnuler={() => setFormulaireOuvert(false)}
            />
          ) : envoyee ? (
            <p role="status" style={{ color: "var(--couleur-succes)" }}>
              Votre demande a été transmise au support. Vous serez recontacté·e.
            </p>
          ) : (
            <EtatVide icone="demandes" titre="Aucune demande en cours" />
          )}
        </Carte>

        <ListeDemandes />
      </div>
    </>
  );
}
