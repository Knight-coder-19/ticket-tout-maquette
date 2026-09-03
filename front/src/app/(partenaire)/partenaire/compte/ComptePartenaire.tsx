"use client";

/**
 * L'espace du commerçant sur son propre compte.
 *
 * Trois blocs, dans l'ordre où ils servent : ce que le dispositif sait de lui,
 * ce qu'il peut afficher en devanture, ce qu'il attend d'être payé.
 *
 * ─── Pourquoi cet écran relit le compte que le layout a déjà lu ───
 *
 * Le layout de l'espace lit `lireMonCompte` pour décider s'il ouvre l'espace ;
 * cet écran le relit pour l'afficher. Ce sont deux usages distincts d'une même
 * donnée — un contrôle d'accès et un contenu — et les confondre coûterait plus
 * que la requête qu'on économiserait : il faudrait un contexte React posé dans
 * le layout, donc traversé par les cinq écrans de l'espace, pour un seul
 * d'entre eux, et le moins visité.
 *
 * La requête part avec `cache: "no-store"` : un statut qui vient de changer
 * s'affiche, il ne se lit pas dans une copie tiède.
 *
 * ─── Quatre états, comme partout ───
 *
 * Chargement, échec, prêt — et pas d'état vide : un compte existe toujours,
 * sinon la route répond 401 et le layout n'aurait pas ouvert l'espace.
 */

import "@/styles/primitives.css";
import "@/styles/compte.css";

import { useCallback, useEffect, useState } from "react";

import { CarteSceau } from "./CarteSceau";
import { FicheEtablissement } from "./FicheEtablissement";
import { Reversements } from "./Reversements";
import { lireMonCompte } from "@/lib/services/partenaire.service";
import { ErreurService } from "@/types/erreurs";
import type { MonCompte } from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous pour consulter votre compte.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

type Etat =
  | { phase: "chargement" }
  | { phase: "prete"; compte: MonCompte }
  | { phase: "echec"; message: string };

export function ComptePartenaire() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });

  const charger = useCallback(async (): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      setEtat({ phase: "prete", compte: await lireMonCompte() });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <div className="compte">
      <h1 className="fiche__titre">Mon compte</h1>

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Lecture de votre fiche…</p>
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
            onClick={() => void charger()}
          >
            Réessayer
          </button>
        </div>
      )}

      {etat.phase === "prete" && (
        <>
          <FicheEtablissement compte={etat.compte} />
          <CarteSceau compte={etat.compte} />
          <Reversements />
        </>
      )}
    </div>
  );
}
