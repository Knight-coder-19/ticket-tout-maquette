"use client";

/**
 * Le registre des comptes partenaires.
 *
 * À distinguer de Validations, qui traite les demandes en attente. Ici on ne
 * tranche pas : on gère des établissements déjà agréés — on balaye, on cherche,
 * on suspend, on réactive, on ferme.
 */

import "@/styles/validations.css";
import "@/styles/comptes.css";

import { useCallback, useEffect, useRef, useState } from "react";

import { DialogueMotif } from "../DialogueMotif";
import { TableauPartenaires } from "./TableauPartenaires";
import {
  fermerCompte,
  listerComptes,
  reactiverCompte,
  suspendreCompte,
  type FiltresComptes,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { ComptePartenaire } from "@/types/domaine";

/** Le front réagit sur le CODE, jamais sur le message du serveur (:626). */
const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  forbidden: "Votre compte n'a pas les droits d'administration.",
  partner_not_found: "Ce compte n'existe plus. Rechargez le registre.",
  partner_status_conflict:
    "Le statut de ce compte a changé, peut-être par un collègue. Rechargez le registre.",
  validation_failed: "Le serveur a refusé la décision : le motif ne peut pas être vide.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * Les statuts proposés au filtre.
 *
 * Énumération fermée du contrat, traduite pour l'écran — à ne pas confondre
 * avec les catégories, qui viennent des données et ne sont jamais écrites dans
 * un composant.
 */
const STATUTS = [
  { valeur: "", libelle: "Tous les statuts" },
  { valeur: "approved", libelle: "Agréés" },
  { valeur: "suspended", libelle: "Suspendus" },
  { valeur: "pending", libelle: "En attente" },
  { valeur: "rejected", libelle: "Refusés" },
  { valeur: "closed", libelle: "Fermés" },
] as const;

type Etat =
  | { phase: "chargement" }
  | { phase: "prete" }
  | { phase: "echec"; message: string };

/** Le geste qu'un dialogue est en train de préparer. */
type Demande =
  | { sorte: "suspension"; compte: ComptePartenaire }
  | { sorte: "fermeture"; compte: ComptePartenaire };

export function Comptes() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [comptes, setComptes] = useState<ComptePartenaire[]>([]);

  const [statut, setStatut] = useState("");
  const [categorie, setCategorie] = useState("");
  const [ville, setVille] = useState("");
  const [recherche, setRecherche] = useState("");

  const [enCours, setEnCours] = useState<string | null>(null);
  const [demande, setDemande] = useState<Demande | null>(null);
  const [erreurDialogue, setErreurDialogue] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState<string | null>(null);

  const zoneAnnonce = useRef<HTMLParagraphElement | null>(null);

  const filtres: FiltresComptes = {
    ...(statut !== "" ? { statut } : {}),
    ...(categorie !== "" ? { categorie } : {}),
    ...(ville !== "" ? { ville } : {}),
    ...(recherche.trim() !== "" ? { recherche } : {}),
  };

  const charger = useCallback(async (aAppliquer: FiltresComptes): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const page = await listerComptes(aAppliquer);
      setComptes(page.comptes);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  /* Les filtres partent au serveur : c'est lui qui filtre, pas la page reçue.
     Filtrer localement ne filtrerait que la première page. */
  useEffect(() => {
    void charger({
      ...(statut !== "" ? { statut } : {}),
      ...(categorie !== "" ? { categorie } : {}),
      ...(ville !== "" ? { ville } : {}),
      ...(recherche.trim() !== "" ? { recherche } : {}),
    });
  }, [charger, statut, categorie, ville, recherche]);

  const rendreLeFocus = useCallback((selecteur: string): void => {
    const bouton = document.getElementById(selecteur);
    if (bouton instanceof HTMLElement) bouton.focus();
  }, []);

  async function agir(
    compte: ComptePartenaire,
    action: () => Promise<void>,
    resume: string,
    depuisDialogue: boolean,
  ): Promise<void> {
    setEnCours(compte.id);
    setErreurDialogue(null);
    try {
      await action();
      const page = await listerComptes(filtres);
      setComptes(page.comptes);
      setDemande(null);
      setAnnonce(resume);
      window.setTimeout(() => zoneAnnonce.current?.focus(), 0);
    } catch (leve) {
      const message = messagePour(leve);
      if (depuisDialogue) setErreurDialogue(message);
      else setEtat({ phase: "echec", message });
    } finally {
      setEnCours(null);
    }
  }

  const filtresActifs = [
    statut !== "" ? (STATUTS.find((s) => s.valeur === statut)?.libelle ?? statut) : null,
    categorie !== "" ? `catégorie « ${categorie} »` : null,
    ville !== "" ? `ville « ${ville} »` : null,
    recherche.trim() !== "" ? `recherche « ${recherche.trim()} »` : null,
  ].filter((f): f is string => f !== null);

  return (
    <>
      <h1 className="comptes__titre">Comptes partenaires</h1>
      <p className="comptes__intro">
        Les établissements déjà agréés, et ceux dont le compte a été suspendu,
        refusé ou fermé. Les demandes qui attendent une décision se traitent
        dans Validations.
      </p>

      <p className="journal__horodatage" role="status" tabIndex={-1} ref={zoneAnnonce}>
        {annonce ?? ""}
      </p>

      <div className="comptes">
        <div className="filtres">
          <div className="filtres__champ">
            <label htmlFor="recherche">Rechercher</label>
            <input
              id="recherche"
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Enseigne, raison sociale ou ville"
              autoComplete="off"
            />
          </div>

          <div className="filtres__champ">
            <label htmlFor="filtre-statut">Statut</label>
            <select id="filtre-statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
              {STATUTS.map((s) => (
                <option key={s.valeur} value={s.valeur}>
                  {s.libelle}
                </option>
              ))}
            </select>
          </div>

          {/*
            La catégorie et la ville sont des champs libres, pas des listes.
            Les catégories viennent des données : en écrire la liste ici serait
            exactement ce que la règle interdit (B. Sellami). Le jour où le back
            servira un référentiel, ce champ deviendra un menu — sans qu'aucune
            catégorie n'ait jamais été écrite dans un composant.
          */}
          <div className="filtres__champ">
            <label htmlFor="filtre-categorie">Catégorie</label>
            <input
              id="filtre-categorie"
              type="text"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Toutes"
              autoComplete="off"
            />
          </div>

          <div className="filtres__champ">
            <label htmlFor="filtre-ville">Ville</label>
            <input
              id="filtre-ville"
              type="text"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              placeholder="Toutes"
              autoComplete="off"
            />
          </div>

          {/* L'état de la recherche, toujours affiché : un tableau filtré qui
              ne dit pas qu'il est filtré laisse croire qu'on voit tout. */}
          <p className="filtres__etat" role="status">
            {filtresActifs.length === 0 ? (
              <>Aucun filtre : le registre entier est affiché.</>
            ) : (
              <>
                Filtré sur <span className="filtres__actif">{filtresActifs.join(", ")}</span>.{" "}
                <button
                  type="button"
                  className="bouton bouton--discret"
                  onClick={() => {
                    setStatut("");
                    setCategorie("");
                    setVille("");
                    setRecherche("");
                  }}
                >
                  Tout afficher
                </button>
              </>
            )}
          </p>
        </div>

        {etat.phase === "chargement" && (
          <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
            <p className="journal__vide">Chargement du registre…</p>
            <span className="silhouette silhouette--titre" />
            <span className="silhouette silhouette--ligne" />
            <span className="silhouette silhouette--courte" />
          </div>
        )}

        {etat.phase === "echec" && (
          <div className="etat etat--echec" role="alert">
            <h2>Le registre n&apos;a pas pu être chargé</h2>
            <p>{etat.message}</p>
            <p>Aucun compte n&apos;a été modifié : rien n&apos;est parti au serveur.</p>
            <button
              type="button"
              className="bouton bouton--discret"
              onClick={() => void charger(filtres)}
            >
              Réessayer
            </button>
          </div>
        )}

        {etat.phase === "prete" && comptes.length === 0 && (
          <div className="etat">
            <h2>Aucun compte ne correspond</h2>
            <p>
              {filtresActifs.length === 0
                ? "Le registre est vide : aucun établissement n'a encore été enregistré."
                : "Aucun établissement ne répond à ces critères. Élargissez la recherche ou retirez un filtre."}
            </p>
          </div>
        )}

        {etat.phase === "prete" && comptes.length > 0 && (
          <TableauPartenaires
            comptes={comptes}
            enCours={enCours}
            onSuspendre={(compte) => {
              setErreurDialogue(null);
              setDemande({ sorte: "suspension", compte });
            }}
            onFermer={(compte) => {
              setErreurDialogue(null);
              setDemande({ sorte: "fermeture", compte });
            }}
            onReactiver={(compte) =>
              void agir(
                compte,
                () => reactiverCompte(compte.id),
                `Le compte de ${compte.enseigne} est réactivé.`,
                false,
              )
            }
          />
        )}
      </div>

      {demande !== null && demande.sorte === "suspension" && (
        <DialogueMotif
          titre={`Suspendre le compte de ${demande.compte.enseigne}`}
          rappel="La suspension coupe les encaissements de cet établissement. Le motif est obligatoire et lui est communiqué : écrivez ce qu'il doit corriger."
          libelleConfirmation="Suspendre le compte"
          libelleEnCours="Suspension…"
          enCours={enCours === demande.compte.id}
          erreur={erreurDialogue}
          onAnnuler={() => {
            const id = demande.compte.id;
            setDemande(null);
            setErreurDialogue(null);
            window.setTimeout(() => rendreLeFocus(`suspendre-${id}`), 0);
          }}
          onConfirmer={(motif) =>
            void agir(
              demande.compte,
              () => suspendreCompte(demande.compte.id, motif),
              `Le compte de ${demande.compte.enseigne} est suspendu.`,
              true,
            )
          }
        />
      )}

      {demande !== null && demande.sorte === "fermeture" && (
        <DialogueMotif
          titre={`Fermer le compte de ${demande.compte.enseigne}`}
          rappel="La fermeture retire définitivement cet établissement du dispositif. Le motif est obligatoire et reste au journal."
          /*
            L'irréversibilité est annoncée AVANT la confirmation, dans le
            dialogue, pas dans un message qui arriverait après le geste.
            Le fondement : `partners.status` n'a aucune contrainte de
            transition, mais un compte fermé depuis plus de trente jours voit
            son solde déchu par le worker (`CLOSURE_GRACE_DAYS`,
            `worker/src/main.rs:1`), et une déchéance ne s'annule pas — elle se
            compense. Voir l'en-tête de `admin/partners/[id]/close/route.ts`.
          */
          avertissement="Un compte fermé ne peut pas être rouvert depuis cet écran. Passé trente jours, le solde résiduel est définitivement déchu et ne peut être rétabli que par une opération de compensation."
          libelleConfirmation="Fermer définitivement"
          libelleEnCours="Fermeture…"
          enCours={enCours === demande.compte.id}
          erreur={erreurDialogue}
          onAnnuler={() => {
            const id = demande.compte.id;
            setDemande(null);
            setErreurDialogue(null);
            window.setTimeout(() => rendreLeFocus(`fermer-${id}`), 0);
          }}
          onConfirmer={(motif) =>
            void agir(
              demande.compte,
              () => fermerCompte(demande.compte.id, motif),
              `Le compte de ${demande.compte.enseigne} est fermé.`,
              true,
            )
          }
        />
      )}
    </>
  );
}
