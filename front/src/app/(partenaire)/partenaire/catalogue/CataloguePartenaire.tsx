"use client";

/**
 * Le catalogue du réseau, vu par un commerçant.
 *
 * Il consulte qui d'autre est agréé, dans quelles catégories, dans quelles
 * villes — et il y voit sa propre fiche telle que le public la voit.
 *
 * La barre de filtres et les états viennent de `primitives.css`, partagés avec
 * les registres de l'administration et le journal du commerçant.
 */

import "@/styles/primitives.css";
import "@/styles/catalogue.css";

import { useCallback, useEffect, useState } from "react";

import { ListeCatalogue } from "./ListeCatalogue";
import { RechercheCatalogue, type FiltresEcran } from "./RechercheCatalogue";
import {
  lireMonCompte,
  listerCatalogue,
  listerCategories,
  listerVilles,
  type FiltresCatalogue,
} from "@/lib/services/partenaire.service";
import { ErreurService } from "@/types/erreurs";
import type {
  CategorieCatalogue,
  FicheCatalogue,
  VilleCatalogue,
} from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  validation_failed: "Ces critères ne sont pas valides.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

type Etat =
  | { phase: "chargement" }
  | { phase: "prete" }
  | { phase: "echec"; message: string };

const AUCUN_FILTRE: FiltresEcran = {
  recherche: "",
  categorie: "",
  ville: "",
  modeService: "",
};

function enFiltresService(filtres: FiltresEcran): FiltresCatalogue {
  return {
    ...(filtres.recherche.trim() !== "" ? { recherche: filtres.recherche } : {}),
    ...(filtres.categorie !== "" ? { categorie: filtres.categorie } : {}),
    ...(filtres.ville !== "" ? { ville: filtres.ville } : {}),
    ...(filtres.modeService !== "" ? { modeService: filtres.modeService } : {}),
  };
}

export function CataloguePartenaire() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [fiches, setFiches] = useState<FicheCatalogue[]>([]);
  const [filtres, setFiltres] = useState<FiltresEcran>(AUCUN_FILTRE);

  /* Les deux référentiels : chargés une fois, ils ne dépendent pas des filtres. */
  const [categories, setCategories] = useState<CategorieCatalogue[]>([]);
  const [villes, setVilles] = useState<VilleCatalogue[]>([]);

  /* L'identifiant du commerçant connecté, pour distinguer sa fiche. */
  const [monId, setMonId] = useState<string | null>(null);

  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);
  const [suiteEnCours, setSuiteEnCours] = useState(false);

  /*
   * Les référentiels et l'identité partent une seule fois, au montage : ils ne
   * changent pas quand on filtre, et les recharger à chaque frappe ferait
   * clignoter les menus sous le doigt.
   *
   * ⚠ Un référentiel qui échoue ne bloque PAS le catalogue. Les menus seraient
   * vides, la recherche texte fonctionnerait quand même — c'est une gêne, pas
   * une raison de refuser d'afficher le réseau.
   */
  useEffect(() => {
    void (async () => {
      const [cats, vls, compte] = await Promise.allSettled([
        listerCategories(),
        listerVilles(),
        lireMonCompte(),
      ]);
      if (cats.status === "fulfilled") setCategories(cats.value);
      if (vls.status === "fulfilled") setVilles(vls.value);
      if (compte.status === "fulfilled") setMonId(compte.value.id);
    })();
  }, []);

  const charger = useCallback(async (aAppliquer: FiltresEcran): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const page = await listerCatalogue(enFiltresService(aAppliquer));
      setFiches(page.fiches);
      setCurseurSuivant(page.curseurSuivant);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger(filtres);
    /* Les quatre valeurs suffisent : `filtres` est reconstruit à chaque rendu
       et le dépendre en entier relancerait la requête sans fin. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charger, filtres.recherche, filtres.categorie, filtres.ville, filtres.modeService]);

  /** La suite du réseau. La liste dit toujours si elle est complète. */
  const chargerLaSuite = useCallback(async (): Promise<void> => {
    if (curseurSuivant === null) return;
    setSuiteEnCours(true);
    try {
      const page = await listerCatalogue(enFiltresService(filtres), curseurSuivant);
      setFiches((deja) => [...deja, ...page.fiches]);
      setCurseurSuivant(page.curseurSuivant);
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    } finally {
      setSuiteEnCours(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curseurSuivant, filtres.recherche, filtres.categorie, filtres.ville, filtres.modeService]);

  const filtree =
    filtres.recherche.trim() !== "" ||
    filtres.categorie !== "" ||
    filtres.ville !== "" ||
    filtres.modeService !== "";

  return (
    <div className="catalogue">
      <h1 className="catalogue__titre">Le réseau CartePro</h1>
      <p className="catalogue__intro">
        Les établissements agréés du dispositif. Votre propre fiche y figure,
        telle que vos clients la voient.
      </p>

      <RechercheCatalogue
        filtres={filtres}
        categories={categories}
        villes={villes}
        onChanger={setFiltres}
      />

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Chargement du réseau…</p>
          <span className="silhouette silhouette--titre" />
          <span className="silhouette silhouette--ligne" />
          <span className="silhouette silhouette--courte" />
        </div>
      )}

      {etat.phase === "echec" && (
        <div className="etat etat--echec" role="alert">
          <h2>Le réseau n&apos;a pas pu être chargé</h2>
          <p>{etat.message}</p>
          <p>
            Votre propre fiche n&apos;est pas affectée : elle reste telle que
            l&apos;administration l&apos;a enregistrée.
          </p>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => void charger(filtres)}
          >
            Réessayer
          </button>
        </div>
      )}

      {etat.phase === "prete" && fiches.length === 0 && (
        <div className="etat">
          <h2>Aucun établissement ne correspond</h2>
          <p>
            {filtree
              ? "Aucun agréé ne répond à ces critères. Élargissez la recherche ou retirez un filtre."
              : "Le réseau ne compte encore aucun établissement agréé."}
          </p>
        </div>
      )}

      {etat.phase === "prete" && fiches.length > 0 && (
        <>
          <ListeCatalogue
            fiches={fiches}
            monId={monId}
            resteAVenir={curseurSuivant !== null}
          />

          {curseurSuivant !== null && (
            <p className="filtres__etat">
              <button
                type="button"
                className="bouton bouton--discret"
                onClick={() => void chargerLaSuite()}
                disabled={suiteEnCours}
              >
                {suiteEnCours ? "Chargement…" : "Charger d'autres établissements"}
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
