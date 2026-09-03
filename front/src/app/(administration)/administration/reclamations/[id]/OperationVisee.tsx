"use client";

import { useEffect, useState } from "react";

import { JournalEcritures } from "@/components/tableaux/JournalEcritures";
import { listerEcritures } from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { EcritureRegistre } from "@/types/domaine";

/**
 * L'opération que le dossier vise, relue EN DIRECT au registre.
 *
 * ═══ JAMAIS UNE COPIE QUI POURRAIT DIVERGER ═══
 *
 * C'est la décision qui donne son sens à ce composant. `Reclamation.operationId`
 * (`types/domaine.ts`) ne porte qu'un IDENTIFIANT — ni montant, ni sens, ni
 * date. Si le dossier gardait ces détails recopiés au moment où il a été
 * ouvert, une annulation ultérieure de l'opération laisserait le dossier
 * afficher une écriture qui n'existe plus telle quelle. Ce composant appelle
 * donc `listerEcritures({ operationId, titulaireId })` à chaque affichage, et
 * rend le résultat avec `JournalEcritures` — le MÊME composant que le
 * registre général et la fiche d'un bénéficiaire, pour que l'écriture
 * apparaisse ici EXACTEMENT comme partout ailleurs, jamais une seconde forme
 * qui pourrait un jour diverger de la première.
 *
 * ═══ FILTRÉE SUR LE SALARIÉ DU DOSSIER ═══
 *
 * Une opération porte deux écritures — un débit, un crédit. `titulaireId`
 * retient celle qui touche LE COMPTE DU SALARIÉ concerné : c'est celle-là que
 * la réclamation vise, pas le mouvement symétrique côté système.
 */
export function OperationVisee({
  operationId,
  salarieId,
}: {
  operationId: string | null;
  salarieId: string;
}) {
  const [etat, setEtat] = useState<
    | { phase: "chargement" }
    | { phase: "prete"; ecritures: EcritureRegistre[] }
    | { phase: "echec"; message: string }
  >({ phase: "chargement" });

  useEffect(() => {
    if (operationId === null) return;
    let annule = false;
    setEtat({ phase: "chargement" });
    void listerEcritures({ operationId, titulaireId: salarieId })
      .then((page) => {
        if (!annule) setEtat({ phase: "prete", ecritures: page.ecritures });
      })
      .catch((leve: unknown) => {
        if (annule) return;
        const message =
          leve instanceof ErreurService
            ? leve.message
            : "Cette écriture n'a pas pu être relue.";
        setEtat({ phase: "echec", message });
      });
    return () => {
      annule = true;
    };
  }, [operationId, salarieId]);

  if (operationId === null) {
    return (
      <section className="operation-visee" aria-labelledby="operation-titre">
        <h2 className="fil-reclamation__soustitre" id="operation-titre">
          Opération visée
        </h2>
        <p className="operation-visee__absente">
          Ce dossier ne cite aucune opération du registre.
        </p>
      </section>
    );
  }

  return (
    <section className="operation-visee" aria-labelledby="operation-titre">
      <h2 className="fil-reclamation__soustitre" id="operation-titre">
        Opération visée
      </h2>

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <span className="silhouette silhouette--ligne" />
        </div>
      )}

      {etat.phase === "echec" && (
        <p className="etat etat--echec" role="alert">
          {etat.message}
        </p>
      )}

      {etat.phase === "prete" && etat.ecritures.length === 0 && (
        <p className="operation-visee__absente">
          L&apos;opération citée par ce dossier n&apos;a pas été retrouvée au
          registre.
        </p>
      )}

      {etat.phase === "prete" && etat.ecritures.length > 0 && (
        <JournalEcritures
          ecritures={etat.ecritures}
          resteAVenir={false}
          miseEnEvidence={null}
          suite="telle qu'elle apparaît au registre, relue à l'instant."
        />
      )}
    </section>
  );
}
