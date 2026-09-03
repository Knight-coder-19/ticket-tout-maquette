"use client";

import { useState } from "react";
import { Icone } from "@/components/ui/Icone";
import styles from "../salarie.module.css";

/** Le jeton en clair, avec copie : utile si le partenaire saisit manuellement. */
export function NumeroJeton({ valeur }: { valeur: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    } catch {
      /* le presse-papier peut etre indisponible : on n'insiste pas */
    }
  }

  return (
    <p className={styles.jeton}>
      <span aria-label={`Code ${valeur}`}>{valeur}</span>
      <button
        type="button"
        onClick={copier}
        style={{ display: "inline-flex", alignItems: "center", gap: "var(--espace-1)" }}
        aria-label="Copier le code"
      >
        <Icone nom={copie ? "coche" : "copier"} taille={14} />
        {copie ? "Copié" : "Copier"}
      </button>
    </p>
  );
}
