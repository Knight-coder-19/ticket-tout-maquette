"use client";

import { useEffect, useState } from "react";
import type { Partenaire } from "@/types/domaine";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { Chargement } from "@/components/ui/Chargement";
import { EtatVide } from "@/components/ui/EtatVide";
import { servicePartenaire } from "@/lib/services";
import styles from "../salarie.module.css";

export function ChoixDuMinistre() {
  const [partenaires, setPartenaires] = useState<Partenaire[] | null>(null);

  useEffect(() => {
    let vivant = true;
    servicePartenaire
      .listerPartenaires({ page: 1 })
      .then((page) => {
        if (vivant) setPartenaires(page.elements.filter((p) => p.estMisEnAvant));
      })
      .catch(() => {
        if (vivant) setPartenaires([]);
      });
    return () => {
      vivant = false;
    };
  }, []);

  return (
    <Carte titre="Coup de cœur du Ministre">
      {partenaires === null ? (
        <Chargement />
      ) : partenaires.length === 0 ? (
        <EtatVide icone="partenaires" titre="Aucun partenaire mis en avant" />
      ) : (
        <div className={styles.grillePartenaires}>
          {partenaires.map((p) => (
            <article key={p.id} className={styles.partenaire}>
              <p className={styles.partenaireNom}>{p.nom}</p>
              {p.ville ? <p className={styles.partenaireMeta}>{p.ville}</p> : null}
              <div className={styles.partenaireTags}>
                {p.estOfficiel ? <Pastille ton="succes">Partenaire officiel</Pastille> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </Carte>
  );
}
