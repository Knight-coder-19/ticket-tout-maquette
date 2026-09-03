"use client";

import { useId } from "react";
import { libelleMois } from "@/lib/utils/date";
import styles from "../salarie.module.css";

export function FiltreMois({
  valeur,
  options,
  onChange,
}: {
  valeur: string;
  options: string[];
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--espace-2)" }}>
      <label htmlFor={id} style={{ fontSize: "var(--taille-sm)" }}>
        Mois
      </label>
      <select
        id={id}
        className={styles.champ}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="tous">Tous les mois</option>
        {options.map((clef) => (
          <option key={clef} value={clef}>
            {libelleMois(clef)}
          </option>
        ))}
      </select>
    </div>
  );
}
