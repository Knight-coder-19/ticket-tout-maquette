"use client";

import type { StatutReclamation } from "@/types/domaine";

/**
 * Le filtre de statut de la file.
 *
 * ⚠ Domaine entièrement de notre fait — voir `types/domaine.ts`.
 *
 * ─── Trois valeurs, une énumération FERMÉE ───
 *
 * `ouverte | en_cours | close` : ce n'est pas une liste de catégories qui
 * viendrait des données (B. Sellami ne s'applique pas ici), c'est un statut
 * au sens strict, au même titre que `StatutPartenaire` ou `StatutBeneficiaire`
 * — une énumération que ce projet a lui-même posée dans `types/domaine.ts`.
 *
 * ─── « Tous » ne veut PAS dire tous les statuts ───
 *
 * Par défaut, la file ne montre QUE les dossiers ouverts ou en cours — un
 * espace de travail, pas un historique. Le premier bouton représente donc ce
 * périmètre de travail, pas une absence de filtre : demander explicitement
 * `close` est la seule façon de relire un dossier tranché.
 */

const OPTIONS: { valeur: StatutReclamation | undefined; libelle: string }[] = [
  { valeur: undefined, libelle: "À traiter" },
  { valeur: "ouverte", libelle: "Ouvertes" },
  { valeur: "en_cours", libelle: "En cours" },
  { valeur: "close", libelle: "Closes" },
];

export function FiltreStatut({
  statut,
  onChanger,
}: {
  statut: StatutReclamation | undefined;
  onChanger: (statut: StatutReclamation | undefined) => void;
}) {
  return (
    <div
      className="reclamations__filtre-statut"
      role="group"
      aria-label="Filtrer par statut"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.libelle}
          type="button"
          className="bouton bouton--discret"
          aria-pressed={statut === option.valeur}
          onClick={() => onChanger(option.valeur)}
        >
          {option.libelle}
        </button>
      ))}
    </div>
  );
}
