"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [categorieIds, setCategorieIds] = useState<string[]>([]);
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
    // Repasse en etat "chargement" a chaque changement de recherche (volontaire).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResultats(null);
    servicePartenaire
      .listerPartenaires({ page: 1, recherche: recherche || undefined })
      .then((page) => {
        if (vivant) setResultats(page.elements);
      })
      .catch(() => {
        if (vivant) setErreur("La recherche a échoué.");
      });
    return () => {
      vivant = false;
    };
  }, [recherche]);

  // Le filtre categorie est multi-selection : on l'applique cote client sur la
  // liste rendue, aucune categorie cochee = toutes.
  const affiches = useMemo(() => {
    if (resultats === null) return null;
    if (categorieIds.length === 0) return resultats;
    return resultats.filter((p) => categorieIds.includes(p.categorieId));
  }, [resultats, categorieIds]);

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
              <FiltreCategories
                categories={categories}
                selection={categorieIds}
                onChange={setCategorieIds}
              />
            </div>
            {affiches === null ? (
              <Chargement libelle="Recherche…" />
            ) : (
              <ListeResultats partenaires={affiches} categories={categories} />
            )}
          </Carte>
        )}
      </div>
    </>
  );
}
