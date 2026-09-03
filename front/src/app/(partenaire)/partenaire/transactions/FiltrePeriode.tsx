"use client";

/**
 * Le filtre de période.
 *
 * Deux dates, et trois raccourcis pour les périodes qu'un commerçant demande
 * vraiment : ce mois, le mois dernier, les trente derniers jours. Taper deux
 * dates pour voir « ce mois-ci » est un travail qu'on peut lui épargner.
 *
 * L'état du filtre est TOUJOURS affiché, même quand rien n'est filtré : un
 * journal filtré qui ne dit pas qu'il l'est laisse croire qu'on voit tout.
 */

export interface Periode {
  /** `YYYY-MM-DD`, ou chaîne vide si la borne est ouverte. */
  depuis: string;
  jusqua: string;
}

/** Le premier jour du mois de `quand`, en `YYYY-MM-DD`. */
function premierDuMois(quand: number): string {
  return `${new Date(quand).toISOString().slice(0, 7)}-01`;
}

/** Le dernier jour du mois précédant `quand`. */
function finDuMoisPrecedent(quand: number): string {
  const premier = Date.parse(`${premierDuMois(quand)}T00:00:00.000Z`);
  return new Date(premier - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function FiltrePeriode({
  periode,
  onChanger,
}: {
  periode: Periode;
  onChanger: (periode: Periode) => void;
}) {
  const maintenant = Date.now();
  const aujourdhui = new Date(maintenant).toISOString().slice(0, 10);

  const raccourcis: { libelle: string; periode: Periode }[] = [
    {
      libelle: "Ce mois-ci",
      periode: { depuis: premierDuMois(maintenant), jusqua: aujourdhui },
    },
    {
      libelle: "Le mois dernier",
      periode: {
        depuis: premierDuMois(Date.parse(`${finDuMoisPrecedent(maintenant)}T00:00:00.000Z`)),
        jusqua: finDuMoisPrecedent(maintenant),
      },
    },
    {
      libelle: "30 derniers jours",
      periode: {
        depuis: new Date(maintenant - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        jusqua: aujourdhui,
      },
    },
  ];

  const filtree = periode.depuis !== "" || periode.jusqua !== "";

  return (
    <div className="filtres">
      <div className="filtres__champ">
        <label htmlFor="periode-depuis">Du</label>
        <input
          id="periode-depuis"
          type="date"
          value={periode.depuis}
          max={periode.jusqua === "" ? undefined : periode.jusqua}
          onChange={(e) => onChanger({ ...periode, depuis: e.target.value })}
        />
      </div>

      <div className="filtres__champ">
        <label htmlFor="periode-jusqua">Au</label>
        <input
          id="periode-jusqua"
          type="date"
          value={periode.jusqua}
          min={periode.depuis === "" ? undefined : periode.depuis}
          onChange={(e) => onChanger({ ...periode, jusqua: e.target.value })}
        />
      </div>

      <div className="filtres__champ">
        <span className="filtres__intitule" id="raccourcis-titre">
          Périodes courantes
        </span>
        <div className="filtres__raccourcis" role="group" aria-labelledby="raccourcis-titre">
          {raccourcis.map(({ libelle, periode: cible }) => (
            <button
              key={libelle}
              type="button"
              className="bouton bouton--discret"
              onClick={() => onChanger(cible)}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      <p className="filtres__etat" role="status">
        {filtree ? (
          <>
            Filtré{" "}
            <span className="filtres__actif">
              {periode.depuis !== "" && `à partir du ${periode.depuis}`}
              {periode.depuis !== "" && periode.jusqua !== "" && " "}
              {periode.jusqua !== "" && `jusqu'au ${periode.jusqua}`}
            </span>
            .{" "}
            <button
              type="button"
              className="bouton bouton--discret"
              onClick={() => onChanger({ depuis: "", jusqua: "" })}
            >
              Tout afficher
            </button>
          </>
        ) : (
          <>Aucun filtre : tous vos encaissements sont affichés.</>
        )}
      </p>
    </div>
  );
}
