"use client";

import type { Categorie } from "@/types/domaine";
import styles from "../salarie.module.css";

/**
 * Les categories viennent des donnees : ce composant n'en connait aucune
 * par son nom (B. Sellami).
 */
export function FiltreCategories({
  categories,
  selection,
  onChange,
}: {
  categories: Categorie[];
  selection: string | null;
  onChange: (categorieId: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filtrer par catégorie"
      style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap", marginBottom: "var(--espace-4)" }}
    >
      <button
        type="button"
        className={styles.champ}
        aria-pressed={selection === null}
        style={selection === null ? { borderColor: "var(--couleur-primaire)", fontWeight: 700 } : undefined}
        onClick={() => onChange(null)}
      >
        Toutes
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={styles.champ}
          aria-pressed={selection === cat.id}
          style={selection === cat.id ? { borderColor: "var(--couleur-primaire)", fontWeight: 700 } : undefined}
          onClick={() => onChange(cat.id)}
        >
          {cat.libelle}
        </button>
      ))}
    </div>
  );
}
