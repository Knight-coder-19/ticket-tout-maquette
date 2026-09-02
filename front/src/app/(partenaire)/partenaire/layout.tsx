"use client";

import "@/styles/espace.css";
import "@/styles/primitives.css";
import "@/styles/partenaire.css";

import { useCallback, useEffect, useState } from "react";

import { AdhesionRefusee } from "./AdhesionRefusee";
import { RailPartenaire } from "./RailPartenaire";
import { BandeauSimulation } from "@/components/simulation/BandeauSimulation";
import { lireMonCompte } from "@/lib/services/partenaire.service";
import { ErreurService } from "@/types/erreurs";
import type { MonCompte } from "@/types/domaine";

/**
 * La coquille de l'espace partenaire.
 *
 * Trois pièces, les mêmes que l'administration : la mention de simulation, le
 * rail, le contenu. Le bandeau est LE composant partagé, pas une copie ; la
 * coquille et le rail viennent de `styles/espace.css` et
 * `components/layout/Rail`.
 *
 * ─── Pourquoi ce layout est un composant client ───
 *
 * Il décide quoi montrer selon l'état du compte, et cet état vient du serveur.
 * Un partenaire refusé, suspendu ou fermé reçoit `AdhesionRefusee` À LA PLACE de
 * l'espace — pas une redirection : il a tapé l'adresse de son espace, il doit
 * recevoir une réponse à cette adresse.
 *
 * ─── En cas d'échec, on n'ouvre pas ───
 *
 * Si l'état du compte ne peut pas être lu, l'espace ne s'affiche pas. C'est un
 * portail : ne pas savoir si un compte est suspendu n'est pas une raison de le
 * laisser encaisser. Le message dit ce qui a échoué et propose de réessayer —
 * il ne laisse pas croire à une décision de l'administration.
 */
const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous pour accéder à votre espace.",
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

export default function Layout({ children }: { children: React.ReactNode }) {
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

  const ouvert = etat.phase === "prete" && etat.compte.statut === "agree";

  return (
    <div className="espace">
      <BandeauSimulation />

      {etat.phase === "chargement" && (
        <main className="espace__contenu">
          <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
            <p>Ouverture de votre espace…</p>
            <span className="silhouette silhouette--titre" />
            <span className="silhouette silhouette--ligne" />
            <span className="silhouette silhouette--courte" />
          </div>
        </main>
      )}

      {etat.phase === "echec" && (
        <main className="espace__contenu">
          <div className="etat etat--echec" role="alert">
            <h1>Votre espace n&apos;a pas pu être ouvert</h1>
            <p>{etat.message}</p>
            <p>
              Ce n&apos;est pas une décision sur votre dossier : l&apos;état de
              votre compte n&apos;a simplement pas pu être lu.
            </p>
            <button
              type="button"
              className="bouton bouton--discret"
              onClick={() => void charger()}
            >
              Réessayer
            </button>
          </div>
        </main>
      )}

      {etat.phase === "prete" && !ouvert && (
        <main className="espace__contenu">
          <AdhesionRefusee compte={etat.compte} />
        </main>
      )}

      {ouvert && (
        <div className="espace__grille">
          <RailPartenaire />
          <main className="espace__contenu">{children}</main>
        </div>
      )}
    </div>
  );
}
