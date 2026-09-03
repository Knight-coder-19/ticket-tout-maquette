"use client";

/**
 * La vue nationale des transactions.
 *
 * Le même objet que le registre, vu autrement : le registre montre la chaîne
 * et son intégrité, celui-ci montre l'activité — qui a encaissé, où, combien,
 * dans quelle catégorie.
 *
 * ─── Le total en tête porte sur le FILTRE, pas sur la page ───
 *
 * C'est la seule façon qu'il ne mente pas, et c'est pour cela qu'il vient du
 * serveur avec les lignes plutôt que d'être calculé ici. Additionner les
 * `transactions` affichées donnerait le total d'une page de vingt lignes,
 * présenté sous le titre « activité nationale ».
 *
 * Le corollaire est que `totaux` NE CHANGE PAS quand on charge une page
 * supplémentaire : le filtre est le même, donc l'ensemble résumé est le même.
 * Seule la légende du tableau évolue, parce qu'elle décrit ce qu'on voit.
 *
 * ─── Quatre états ───
 *
 * Chargement, vide, échec, action en cours. Le vide est distinct de l'échec :
 * « aucune transaction sur ce filtre » n'est pas « le service est
 * injoignable », et les confondre enverrait un agent chercher une panne là où
 * il n'y a qu'un filtre trop étroit.
 */

import "@/styles/primitives.css";
import "@/styles/transactions-nationales.css";

import { useCallback, useEffect, useState } from "react";

import { FiltresTransactions, type FiltresNationaux } from "./FiltresTransactions";
import { TableauNational } from "./TableauNational";
import { formaterCentimes } from "@/lib/montant";
import {
  listerTransactionsNationales,
  type FiltresTransactionsNationales,
} from "@/lib/services/administration.service";
import { listerCategories, listerVilles } from "@/lib/services/partenaire.service";
import { ErreurService } from "@/types/erreurs";
import type {
  CategorieCatalogue,
  TotauxTransactions,
  TransactionNationale,
  VilleCatalogue,
} from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  validation_failed: "Un des filtres n'est pas valide. Vérifiez les dates saisies.",
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

const AUCUN: FiltresNationaux = {
  periode: { depuis: "", jusqua: "" },
  partenaireId: "",
  villeId: "",
  categorie: "",
};

/** Les filtres de l'écran, en paramètres pour le serveur. */
function enRequete(filtres: FiltresNationaux): FiltresTransactionsNationales {
  return {
    ...(filtres.periode.depuis !== ""
      ? { depuis: `${filtres.periode.depuis}T00:00:00.000Z` }
      : {}),
    ...(filtres.periode.jusqua !== ""
      ? { jusqua: `${filtres.periode.jusqua}T23:59:59.999Z` }
      : {}),
    ...(filtres.partenaireId !== "" ? { partenaireId: filtres.partenaireId.trim() } : {}),
    ...(filtres.villeId !== "" ? { villeId: filtres.villeId } : {}),
    ...(filtres.categorie !== "" ? { categorie: filtres.categorie } : {}),
  };
}

export function TransactionsNationales() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [transactions, setTransactions] = useState<TransactionNationale[]>([]);
  const [totaux, setTotaux] = useState<TotauxTransactions | null>(null);
  const [filtres, setFiltres] = useState<FiltresNationaux>(AUCUN);

  /* Les deux référentiels, chargés une fois : ils ne dépendent pas du filtre. */
  const [villes, setVilles] = useState<VilleCatalogue[]>([]);
  const [categories, setCategories] = useState<CategorieCatalogue[]>([]);

  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);
  const [suiteEnCours, setSuiteEnCours] = useState(false);

  const charger = useCallback(async (aAppliquer: FiltresNationaux): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const page = await listerTransactionsNationales(enRequete(aAppliquer));
      setTransactions(page.transactions);
      setTotaux(page.totaux);
      setCurseurSuivant(page.curseurSuivant);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger(filtres);
    /* Les filtres sont un objet reconstruit à chaque rendu ; le dépendre en
       entier relancerait la requête sans fin. Ses valeurs suffisent. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    charger,
    filtres.periode.depuis,
    filtres.periode.jusqua,
    filtres.partenaireId,
    filtres.villeId,
    filtres.categorie,
  ]);

  /* Les référentiels : un échec ici ne ferme pas l'écran. Un menu de villes
     vide gêne le filtrage ; il n'empêche pas de lire les transactions. */
  useEffect(() => {
    void (async () => {
      try {
        const [v, c] = await Promise.all([listerVilles(), listerCategories()]);
        setVilles(v);
        setCategories(c);
      } catch {
        setVilles([]);
        setCategories([]);
      }
    })();
  }, []);

  /**
   * Charge la suite.
   *
   * ⚠ La pagination ne tronque jamais en silence : le tableau annonce s'il est
   * complet, et ce bouton n'apparaît que s'il reste quelque chose. `totaux`
   * n'est pas retouché — l'ensemble filtré n'a pas changé.
   */
  const chargerLaSuite = useCallback(async (): Promise<void> => {
    if (curseurSuivant === null) return;
    setSuiteEnCours(true);
    try {
      const page = await listerTransactionsNationales(enRequete(filtres), curseurSuivant);
      setTransactions((deja) => [...deja, ...page.transactions]);
      setCurseurSuivant(page.curseurSuivant);
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    } finally {
      setSuiteEnCours(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    curseurSuivant,
    filtres.periode.depuis,
    filtres.periode.jusqua,
    filtres.partenaireId,
    filtres.villeId,
    filtres.categorie,
  ]);

  return (
    <div className="national">
      <h1 className="ecran__titre">Transactions nationales</h1>
      <p className="ecran__intro">
        L&apos;activité du dispositif : qui a encaissé, où, et dans quelle
        catégorie. Le registre, lui, montre les écritures et l&apos;intégrité de
        la chaîne — c&apos;est le même fait, vu sous l&apos;angle comptable.
      </p>

      <FiltresTransactions
        filtres={filtres}
        villes={villes}
        categories={categories}
        onChanger={setFiltres}
      />

      {/*
        Le total, en tête et non en pied. Il porte sur l'ensemble du filtre :
        c'est écrit sous les chiffres, parce qu'un total placé au-dessus d'un
        tableau paginé se lit spontanément comme le total du tableau.
      */}
      {totaux !== null && etat.phase !== "echec" && (
        <section className="totaux" aria-labelledby="totaux-titre">
          <h2 className="totaux__titre" id="totaux-titre">
            Sur le filtre courant
          </h2>
          <dl className="totaux__liste">
            <div className="totaux__bloc">
              <dt>Opérations</dt>
              <dd className="totaux__valeur">{totaux.nombre}</dd>
            </div>
            <div className="totaux__bloc">
              <dt>Montant cumulé</dt>
              <dd className="totaux__valeur">{formaterCentimes(totaux.volume)}</dd>
            </div>
            <div className="totaux__bloc">
              <dt>Dont annulées</dt>
              <dd className="totaux__valeur">{totaux.nombreAnnulees}</dd>
            </div>
          </dl>
          <p className="totaux__note">
            Ces trois chiffres portent sur toutes les transactions retenues par
            les filtres, et non sur les seules lignes affichées. Le montant
            cumulé est net : une opération annulée n&apos;y est pas comptée,
            mais elle reste dénombrée.
          </p>
        </section>
      )}

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Lecture des transactions…</p>
          <span className="silhouette silhouette--titre" />
          <span className="silhouette silhouette--ligne" />
          <span className="silhouette silhouette--courte" />
        </div>
      )}

      {etat.phase === "echec" && (
        <div className="etat etat--echec" role="alert">
          <p>{etat.message}</p>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => void charger(filtres)}
          >
            Réessayer
          </button>
        </div>
      )}

      {etat.phase === "prete" && transactions.length === 0 && (
        <div className="etat etat--vide">
          <p>Aucune transaction ne répond à ces filtres.</p>
          <p>
            Ce n&apos;est pas une erreur : le dispositif n&apos;a rien enregistré
            qui corresponde. Élargissez la période, ou retirez un filtre.
          </p>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => setFiltres(AUCUN)}
          >
            Retirer tous les filtres
          </button>
        </div>
      )}

      {etat.phase === "prete" && transactions.length > 0 && (
        <>
          <TableauNational
            transactions={transactions}
            resteAVenir={curseurSuivant !== null}
          />

          {curseurSuivant !== null && (
            <div className="actions">
              <button
                type="button"
                className="bouton bouton--discret"
                onClick={() => void chargerLaSuite()}
                disabled={suiteEnCours}
              >
                {suiteEnCours ? "Chargement…" : "Charger les suivantes"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
