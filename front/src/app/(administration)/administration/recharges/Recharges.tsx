"use client";

/**
 * Le crédit des comptes salariés.
 *
 * L'administration verse un droit — un par un ou par lot — sur les comptes
 * salariés. C'est un FINANCEMENT, pas une correction : à distinguer de la
 * régularisation (fiche d'un bénéficiaire), qui répare une erreur. Ici,
 * chaque rechargement s'écrit au registre comme tout le reste, et fait
 * bouger le solde RÉGLÉ ET le disponible ensemble — contrairement à
 * l'émission d'un jeton, qui ne réserve (donc ne bouge) que le disponible.
 *
 * Trois sections : le rechargement individuel, l'import CSV avec son aperçu
 * obligatoire, et le journal des mouvements récents — le même registre que
 * partout ailleurs dans le projet, filtré sur sa nature.
 */

import "@/styles/primitives.css";
import "@/styles/recharges.css";

import { useCallback, useEffect, useState } from "react";

import { DerniersMouvements } from "./DerniersMouvements";
import { FormulaireRechargement } from "./FormulaireRechargement";
import { ListeBeneficiaires } from "./ListeBeneficiaires";
import {
  crediterSalarie,
  listerEcritures,
  listerEmployeurs,
  televerserLot,
  validerLot,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { ApercuLot, EcritureRegistre, EmployeurRepertoire } from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  not_found: "Ce salarié, ou cet employeur, n'existe pas.",
  account_inactive: "Ce compte n'est pas actif : il ne peut pas être crédité.",
  validation_failed: "La demande a été refusée : vérifiez les champs saisis.",
  duplicate_batch: "Ce fichier a déjà été importé pour cet employeur.",
  batch_has_errors:
    "Ce lot contient des lignes en erreur. Corrigez le fichier et importez-le à nouveau.",
  batch_already_processed: "Ce lot a déjà été validé ou rejeté.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

type EtatJournal =
  | { phase: "chargement" }
  | { phase: "prete" }
  | { phase: "echec"; message: string };

export function Recharges() {
  const [employeurs, setEmployeurs] = useState<EmployeurRepertoire[]>([]);

  const [etatJournal, setEtatJournal] = useState<EtatJournal>({ phase: "chargement" });
  const [ecritures, setEcritures] = useState<EcritureRegistre[]>([]);
  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);
  const [derniereEcriture, setDerniereEcriture] = useState<string | null>(null);

  const [enCoursIndividuel, setEnCoursIndividuel] = useState(false);
  const [erreurIndividuelle, setErreurIndividuelle] = useState<string | null>(null);

  const [employeurLot, setEmployeurLot] = useState("");
  const [motifLot, setMotifLot] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<ApercuLot | null>(null);
  const [enCoursLot, setEnCoursLot] = useState(false);
  const [erreurLot, setErreurLot] = useState<string | null>(null);

  const chargerJournal = useCallback(async (): Promise<void> => {
    setEtatJournal({ phase: "chargement" });
    try {
      const page = await listerEcritures({ nature: "topup" });
      setEcritures(page.ecritures);
      setCurseurSuivant(page.curseurSuivant);
      setEtatJournal({ phase: "prete" });
    } catch (leve) {
      setEtatJournal({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void chargerJournal();
    void (async () => {
      try {
        setEmployeurs(await listerEmployeurs());
      } catch {
        setEmployeurs([]);
      }
    })();
  }, [chargerJournal]);

  const chargerLaSuiteDuJournal = useCallback(async (): Promise<void> => {
    if (curseurSuivant === null) return;
    try {
      const page = await listerEcritures({ nature: "topup" }, curseurSuivant);
      setEcritures((deja) => [...deja, ...page.ecritures]);
      setCurseurSuivant(page.curseurSuivant);
    } catch (leve) {
      setEtatJournal({ phase: "echec", message: messagePour(leve) });
    }
  }, [curseurSuivant]);

  const crediter = useCallback(
    async (
      employeurId: string,
      matricule: string,
      montantCentimes: number,
      motif: string,
      reference: string | null,
    ): Promise<void> => {
      setEnCoursIndividuel(true);
      setErreurIndividuelle(null);
      try {
        const recu = await crediterSalarie(employeurId, matricule, montantCentimes, motif, reference);
        setDerniereEcriture(recu.operationId);
        await chargerJournal();
      } catch (leve) {
        setErreurIndividuelle(messagePour(leve));
      } finally {
        setEnCoursIndividuel(false);
      }
    },
    [chargerJournal],
  );

  const importer = useCallback(async (): Promise<void> => {
    if (employeurLot === "" || fichier === null || motifLot.trim() === "") return;
    setEnCoursLot(true);
    setErreurLot(null);
    try {
      setApercu(await televerserLot(employeurLot, fichier, motifLot.trim()));
    } catch (leve) {
      setErreurLot(messagePour(leve));
    } finally {
      setEnCoursLot(false);
    }
  }, [employeurLot, fichier, motifLot]);

  const valider = useCallback(async (): Promise<void> => {
    if (apercu === null) return;
    setEnCoursLot(true);
    setErreurLot(null);
    try {
      await validerLot(apercu.id);
      setApercu(null);
      setFichier(null);
      setMotifLot("");
      await chargerJournal();
    } catch (leve) {
      setErreurLot(messagePour(leve));
    } finally {
      setEnCoursLot(false);
    }
  }, [apercu, chargerJournal]);

  return (
    <div className="recharges">
      <h1 className="recharges__titre">Rechargements</h1>
      <p className="recharges__intro">
        Créditez un salarié, un par un ou par lot. Chaque versement s&apos;écrit
        au registre, comme tout le reste.
      </p>

      <FormulaireRechargement
        employeurs={employeurs}
        enCours={enCoursIndividuel}
        erreur={erreurIndividuelle}
        onCrediter={(employeurId, matricule, montant, motif, reference) =>
          void crediter(employeurId, matricule, montant, motif, reference)
        }
      />

      <section className="import-lot" aria-labelledby="import-titre">
        <h2 className="recharges__soustitre" id="import-titre">
          Importer un fichier
        </h2>
        <p className="import-lot__aide">
          Colonnes attendues : <code>matricule</code>, <code>montant</code>, et
          <code>reference</code> facultative. Un courriel est accepté à la place
          du matricule.
        </p>

        <div className="filtres">
          <div className="filtres__champ">
            <label htmlFor="lot-employeur">Employeur</label>
            <select
              id="lot-employeur"
              value={employeurLot}
              disabled={enCoursLot}
              onChange={(e) => {
                setEmployeurLot(e.target.value);
                setApercu(null);
              }}
            >
              <option value="">Choisir un employeur</option>
              {employeurs.map((employeur) => (
                <option key={employeur.id} value={employeur.id}>
                  {employeur.raisonSociale}
                </option>
              ))}
            </select>
          </div>

          <div className="filtres__champ">
            <label htmlFor="lot-fichier">Fichier CSV</label>
            <input
              id="lot-fichier"
              type="file"
              accept=".csv,text/csv"
              disabled={enCoursLot}
              onChange={(e) => {
                setFichier(e.target.files?.[0] ?? null);
                setApercu(null);
              }}
            />
          </div>
        </div>

        <label htmlFor="lot-motif">Motif</label>
        <textarea
          id="lot-motif"
          value={motifLot}
          rows={2}
          disabled={enCoursLot}
          required
          aria-describedby="lot-motif-aide"
          onChange={(e) => {
            setMotifLot(e.target.value);
            setApercu(null);
          }}
        />
        <p className="dialogue__aide" id="lot-motif-aide">
          Obligatoire. S&apos;applique à toutes les lignes du fichier.
        </p>

        {erreurLot !== null && apercu === null && (
          <p className="etat etat--echec" role="alert">
            {erreurLot}
          </p>
        )}

        <div className="actions">
          <button
            type="button"
            className="bouton bouton--discret"
            disabled={
              enCoursLot || employeurLot === "" || fichier === null || motifLot.trim() === ""
            }
            onClick={() => void importer()}
          >
            {enCoursLot && apercu === null ? "Analyse…" : "Analyser le fichier"}
          </button>
        </div>

        {apercu !== null && (
          <ListeBeneficiaires
            apercu={apercu}
            enCours={enCoursLot}
            erreur={erreurLot}
            onValider={() => void valider()}
          />
        )}
      </section>

      <section aria-labelledby="journal-titre">
        <h2 className="recharges__soustitre" id="journal-titre">
          Derniers mouvements
        </h2>

        {etatJournal.phase === "chargement" && (
          <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
            <p>Lecture du journal…</p>
            <span className="silhouette silhouette--titre" />
            <span className="silhouette silhouette--ligne" />
          </div>
        )}

        {etatJournal.phase === "echec" && (
          <div className="etat etat--echec" role="alert">
            <p>{etatJournal.message}</p>
            <button
              type="button"
              className="bouton bouton--discret"
              onClick={() => void chargerJournal()}
            >
              Réessayer
            </button>
          </div>
        )}

        {etatJournal.phase === "prete" && ecritures.length === 0 && (
          <div className="etat etat--vide">
            <p>Aucun rechargement n&apos;a encore été versé.</p>
          </div>
        )}

        {etatJournal.phase === "prete" && ecritures.length > 0 && (
          <>
            <DerniersMouvements
              ecritures={ecritures}
              resteAVenir={curseurSuivant !== null}
              miseEnEvidence={derniereEcriture}
            />
            {curseurSuivant !== null && (
              <div className="actions">
                <button
                  type="button"
                  className="bouton bouton--discret"
                  onClick={() => void chargerLaSuiteDuJournal()}
                >
                  Charger les suivants
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
