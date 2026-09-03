"use client";

import { useEffect, useState } from "react";
import type { Categorie, Partenaire } from "@/types/domaine";
import { Carte } from "@/components/ui/Carte";
import { Chargement } from "@/components/ui/Chargement";
import { EtatErreur } from "@/components/ui/EtatErreur";
import { servicePartenaire } from "@/lib/services";
import styles from "../salarie.module.css";
import { RecherchePartenaires } from "./RecherchePartenaires";
import { FiltreCategories } from "./FiltreCategories";
import { ListeResultats } from "./ListeResultats";

export function PartenairesSalarie() {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [categorieId, setCategorieId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Partenaire[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    servicePartenaire
      .listerCategories()
      .then(setCategories)
      .catch(() => setErreur("Le réseau de partenaires n'a pas pu être chargé."));
  }, []);

  useEffect(() => {
    let vivant = true;
    // Repasse en etat "chargement" a chaque changement de filtre (volontaire).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResultats(null);
    servicePartenaire
      .listerPartenaires({
        page: 1,
        categorieId: categorieId ?? undefined,
        recherche: recherche || undefined,
      })
      .then((page) => {
        if (vivant) setResultats(page.elements);
      })
      .catch(() => {
        if (vivant) setErreur("La recherche a échoué.");
      });
    return () => {
      vivant = false;
    };
  }, [categorieId, recherche]);

  return (
    <>
      <header className={styles.enTete}>
        <h1>Partenaires près de chez vous</h1>
        <p>Le réseau de commerces où dépenser votre budget Ticket Tout.</p>
      </header>

      <div className={styles.pile}>
        {erreur ? (
          <EtatErreur message={erreur} />
        ) : (
          <Carte>
            <div className={styles.barreFiltres}>
              <RecherchePartenaires valeur={recherche} onChange={setRecherche} />
            </div>
            <FiltreCategories
              categories={categories}
              selection={categorieId}
              onChange={setCategorieId}
            />
            {resultats === null ? (
              <Chargement libelle="Recherche…" />
            ) : (
              <ListeResultats partenaires={resultats} categories={categories} />
            )}
          </Carte>
        )}
      </div>
    </>
  );
}
