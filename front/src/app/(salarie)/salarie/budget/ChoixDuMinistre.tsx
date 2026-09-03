"use client";

import { useEffect, useState } from "react";
import type { Partenaire } from "@/types/domaine";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { Chargement } from "@/components/ui/Chargement";
import { EtatVide } from "@/components/ui/EtatVide";
import { lireChoixDuMinistre } from "@/lib/services/salarie.service";
import styles from "../salarie.module.css";

/**
 * ✅ Branché sur `GET /me/minister-picks` (amendement A2, data-dictionary.md:
 * 394-399) depuis que la route est câblée côté back — plus le filtre
 * `estMisEnAvant` sur le catalogue entier, qui interrogeait la mauvaise
 * route pour la mauvaise question (une liste de partenaires n'est pas une
 * liste de mises en avant).
 */
export function ChoixDuMinistre() {
  const [partenaires, setPartenaires] = useState<Partenaire[] | null>(null);

  useEffect(() => {
    let vivant = true;
    lireChoixDuMinistre()
      .then((liste) => {
        if (vivant) setPartenaires(liste);
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
