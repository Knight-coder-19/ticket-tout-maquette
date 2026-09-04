"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Categorie } from "@/types/domaine";
import { Icone } from "@/components/ui/Icone";
import styles from "../salarie.module.css";

/**
 * Filtre par categorie, en menu deroulant a cote de la recherche.
 *
 * Un bouton a icone ouvre une liste de cases a cocher — une par categorie —
 * que le salarie coche ou decoche librement (plusieurs a la fois). Aucune
 * categorie n'est ecrite en dur : elles viennent des donnees (B. Sellami).
 * Selection vide = toutes les categories.
 */
export function FiltreCategories({
  categories,
  selection,
  onChange,
}: {
  categories: Categorie[];
  selection: string[];
  onChange: (categorieIds: string[]) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  useEffect(() => {
    if (!ouvert) return;
    function surClicExterieur(e: MouseEvent) {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surEchap);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surEchap);
    };
  }, [ouvert]);

  function basculer(id: string) {
    onChange(
      selection.includes(id)
        ? selection.filter((x) => x !== id)
        : [...selection, id],
    );
  }

  const nombre = selection.length;

  return (
    <div ref={conteneur} className={styles.filtreCat}>
      <button
        type="button"
        className={styles.filtreCatBouton}
        aria-haspopup="true"
        aria-expanded={ouvert}
        aria-controls={idMenu}
        onClick={() => setOuvert((v) => !v)}
      >
        <Icone nom="filtre" taille={18} />
        Catégories
        {nombre > 0 ? <span className={styles.filtreCatPuce}>{nombre}</span> : null}
      </button>

      {ouvert ? (
        <div
          id={idMenu}
          role="group"
          aria-label="Filtrer par catégorie"
          className={styles.filtreCatMenu}
        >
          {categories.map((cat) => (
            <label key={cat.id} className={styles.filtreCatOption}>
              <input
                type="checkbox"
                checked={selection.includes(cat.id)}
                onChange={() => basculer(cat.id)}
              />
              {cat.libelle}
            </label>
          ))}
          {nombre > 0 ? (
            <button
              type="button"
              className={styles.filtreCatReset}
              onClick={() => onChange([])}
            >
              Tout décocher
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
