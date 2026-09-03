"use client";

import type { EmployeurRepertoire, StatutBeneficiaire } from "@/types/domaine";

/**
 * Les trois filtres du répertoire : recherche, statut, employeur.
 *
 * ─── Le statut est une énumération, l'employeur vient des données ───
 *
 * `user_status` est une énumération FERMÉE du schéma (`0001_schema.sql:5`) :
 * trois valeurs, un changement cassant si elle bouge. La traduire est le
 * travail de l'interface, et la liste ci-dessous est légitime.
 *
 * Les employeurs, eux, ne sont écrits nulle part ici : ils viennent de
 * `GET /v1/admin/employers`. Ajouter un employeur ne doit toucher aucune ligne
 * d'interface (B. Sellami). L'effectif affiché à côté de chaque nom vient des
 * données lui aussi.
 *
 * ─── L'état du filtre est toujours affiché ───
 *
 * Même quand rien n'est filtré. Un répertoire filtré qui ne dit pas qu'il
 * l'est laisse croire qu'on voit tout le monde — et sur un répertoire de
 * bénéficiaires, croire qu'une personne n'existe pas parce qu'un filtre la
 * masque a des conséquences.
 */

/** Les trois valeurs de `user_status`, traduites. */
const STATUTS = [
  { valeur: "", libelle: "Tous les statuts" },
  { valeur: "actif", libelle: "Actifs" },
  { valeur: "suspendu", libelle: "Suspendus" },
  { valeur: "ferme", libelle: "Fermés" },
] as const;

export interface FiltresRecherche {
  recherche: string;
  statut: "" | StatutBeneficiaire;
  employeurId: string;
}

export function RechercheSalaries({
  filtres,
  employeurs,
  onChanger,
}: {
  filtres: FiltresRecherche;
  /** Référentiel venu de la route. Jamais une liste écrite ici. */
  employeurs: EmployeurRepertoire[];
  onChanger: (filtres: FiltresRecherche) => void;
}) {
  const poser = <C extends keyof FiltresRecherche>(
    champ: C,
    valeur: FiltresRecherche[C],
  ): void => onChanger({ ...filtres, [champ]: valeur });

  const filtre =
    filtres.recherche !== "" || filtres.statut !== "" || filtres.employeurId !== "";

  return (
    <div className="filtres">
      <div className="filtres__champ">
        <label htmlFor="recherche-beneficiaire">Rechercher</label>
        <input
          id="recherche-beneficiaire"
          type="search"
          value={filtres.recherche}
          placeholder="Nom, prénom ou matricule"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="recherche-aide"
          onChange={(e) => poser("recherche", e.target.value)}
        />
        <span className="filtres__aide" id="recherche-aide">
          Les accents et la casse sont indifférents.
        </span>
      </div>

      <div className="filtres__champ">
        <label htmlFor="filtre-statut">Statut</label>
        <select
          id="filtre-statut"
          value={filtres.statut}
          onChange={(e) => poser("statut", e.target.value as FiltresRecherche["statut"])}
        >
          {STATUTS.map((statut) => (
            <option key={statut.valeur} value={statut.valeur}>
              {statut.libelle}
            </option>
          ))}
        </select>
      </div>

      <div className="filtres__champ">
        <label htmlFor="filtre-employeur">Employeur</label>
        <select
          id="filtre-employeur"
          value={filtres.employeurId}
          onChange={(e) => poser("employeurId", e.target.value)}
        >
          <option value="">Tous les employeurs</option>
          {employeurs.map((employeur) => (
            <option key={employeur.id} value={employeur.id}>
              {employeur.raisonSociale} ({employeur.nombreDeBeneficiaires})
            </option>
          ))}
        </select>
      </div>

      <p className="filtres__etat" role="status">
        {filtre ? (
          <>
            Répertoire filtré.{" "}
            <button
              type="button"
              className="bouton bouton--discret"
              onClick={() =>
                onChanger({ recherche: "", statut: "", employeurId: "" })
              }
            >
              Tout afficher
            </button>
          </>
        ) : (
          <>Aucun filtre : tous les bénéficiaires sont affichés.</>
        )}
      </p>
    </div>
  );
}
