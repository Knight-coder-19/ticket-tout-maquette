"use client";

import { QRCodeSVG } from "qrcode.react";
import styles from "../salarie.module.css";

/**
 * Rendu du code de paiement sous forme de vrai QR code (bibliotheque
 * `qrcode.react`, embarquee au build : pas de service tiers, contrainte de
 * souverainete respectee).
 *
 * Le contenu encode ici est le jeton local de demonstration. En production, le
 * jeton est signe par le serveur (T. Vignal) ; c'est ce jeton-la qui sera
 * encode, sans changer ce composant.
 *
 * Les couleurs sont litterales : un QR doit garder un fort contraste pour
 * rester scannable. C'est la seule exception a la regle "aucune couleur en dur"
 * et elle reprend les valeurs de tokens.css (#1B3A6B / blanc).
 */
export function CodeAffiche({ valeur, expire }: { valeur: string; expire: boolean }) {
  return (
    <QRCodeSVG
      value={`TICKETTOUT:${valeur}`}
      size={196}
      level="M"
      marginSize={2}
      bgColor="#ffffff"
      fgColor={expire ? "#c3c9d6" : "#1b3a6b"}
      title={`Code de paiement ${valeur}${expire ? " (expiré)" : ""}`}
      role="img"
      className={styles.codeQr}
    />
  );
}
