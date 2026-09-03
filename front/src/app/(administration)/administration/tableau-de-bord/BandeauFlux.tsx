"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  listerDemandesEnAttente,
  listerReclamationsAdmin,
  verifierIntegrite,
} from "@/lib/services/administration.service";

/**
 * Ce qui attend une action, en un coup d'œil.
 *
 * ⚠ NOTRE AJOUT au tableau de bord national : `Dashboard` (le contrat) ne
 * porte que des agrégats sur une période — aucun d'eux ne répond à
 * « qu'est-ce qui attend, là, maintenant ». Ce bandeau assemble trois
 * comptes déjà servis PAR AILLEURS dans ce projet (aucune route de plus) :
 * les demandes d'adhésion en attente (`Validations`), les dossiers de
 * réclamation ouverts ou en cours (`Reclamations`), l'intégrité de la
 * chaîne (`Registre`). Trois écrans, un seul rappel de ce qu'ils contiennent.
 *
 * ─── Les décomptes sont des MINORANTS, pas des totaux exacts ───
 *
 * Chaque route rend une PAGE, pas un compte. Sur ce jeu de démonstration, une
 * page suffit toujours ; si elle ne suffisait pas, `N+` le dit plutôt que
 * d'afficher un nombre faux avec la même assurance qu'un nombre vrai.
 *
 * ─── Un lien, jamais une action directe ───
 *
 * Le bandeau ne clôt rien, n'accepte rien : il RENVOIE vers l'écran qui sait
 * le faire, avec son motif obligatoire et ses règles propres. Dupliquer ces
 * gestes ici referait, en pire, ce que ces écrans font déjà.
 */

interface Compte {
  nombre: number;
  auMoins: boolean;
}

type Etat =
  | { phase: "chargement" }
  | { phase: "prete"; demandes: Compte; reclamations: Compte; chaineIntacte: boolean | null }
  | { phase: "echec" };

export function BandeauFlux() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });

  useEffect(() => {
    let annule = false;
    void Promise.allSettled([
      listerDemandesEnAttente(),
      listerReclamationsAdmin(),
      verifierIntegrite(),
    ]).then(([demandesR, reclamationsR, chaineR]) => {
      if (annule) return;
      if (demandesR.status === "rejected" && reclamationsR.status === "rejected") {
        setEtat({ phase: "echec" });
        return;
      }
      setEtat({
        phase: "prete",
        demandes:
          demandesR.status === "fulfilled"
            ? { nombre: demandesR.value.demandes.length, auMoins: demandesR.value.curseurSuivant !== null }
            : { nombre: 0, auMoins: false },
        reclamations:
          reclamationsR.status === "fulfilled"
            ? {
                nombre: reclamationsR.value.reclamations.length,
                auMoins: reclamationsR.value.curseurSuivant !== null,
              }
            : { nombre: 0, auMoins: false },
        chaineIntacte: chaineR.status === "fulfilled" ? chaineR.value.intacte : null,
      });
    });
    return () => {
      annule = true;
    };
  }, []);

  if (etat.phase === "chargement") {
    return (
      <div className="bandeau-flux etat--chargement" aria-busy="true" aria-live="polite">
        <span className="silhouette silhouette--ligne" />
      </div>
    );
  }

  if (etat.phase === "echec") {
    return null;
  }

  const { demandes, reclamations, chaineIntacte } = etat;
  const rienNAttend = demandes.nombre === 0 && reclamations.nombre === 0 && chaineIntacte !== false;

  if (rienNAttend) {
    return (
      <p className="bandeau-flux bandeau-flux--calme" role="status">
        Rien n&apos;attend : aucune demande, aucun dossier ouvert, la chaîne
        est intègre.
      </p>
    );
  }

  return (
    <ul className="bandeau-flux" aria-label="Ce qui attend une action">
      {demandes.nombre > 0 && (
        <li>
          <Link href="/administration/validations">
            {demandes.auMoins ? `${demandes.nombre}+` : demandes.nombre}{" "}
            {demandes.nombre === 1 ? "demande en attente" : "demandes en attente"}
          </Link>
        </li>
      )}
      {reclamations.nombre > 0 && (
        <li>
          <Link href="/administration/reclamations">
            {reclamations.auMoins ? `${reclamations.nombre}+` : reclamations.nombre}{" "}
            {reclamations.nombre === 1 ? "dossier ouvert" : "dossiers ouverts"}
          </Link>
        </li>
      )}
      {chaineIntacte === false && (
        <li>
          <Link href="/administration/registre" className="bandeau-flux__alerte">
            La chaîne du registre n&apos;est plus intègre
          </Link>
        </li>
      )}
    </ul>
  );
}
