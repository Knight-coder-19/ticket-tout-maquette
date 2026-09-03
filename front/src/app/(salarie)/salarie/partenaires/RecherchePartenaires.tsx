"use client";

import { useId } from "react";
import { Icone } from "@/components/ui/Icone";
import styles from "../salarie.module.css";

export function RecherchePartenaires({
  valeur,
  onChange,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--espace-2)", flex: 1 }}>
      <label htmlFor={id} className="sr-only">
        Rechercher un partenaire
      </label>
      <Icone nom="recherche" taille={18} style={{ color: "var(--couleur-texte-secondaire)" }} />
      <input
        id={id}
        type="search"
        className={styles.champ}
        style={{ flex: 1 }}
        placeholder="Nom du commerce ou ville"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
