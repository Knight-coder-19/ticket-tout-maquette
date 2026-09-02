"use client";

/**
 * Le registre : le journal comptable du dispositif.
 *
 * ─── Ce que cet écran doit rendre visible ───
 *
 * Qu'aucune capture d'écran ne prouve. Un tableau de montants, n'importe qui
 * peut le dessiner. Ce qui se démontre ici, c'est que le journal est intègre
 * ET qu'il le reste après une correction : on annule devant le jury, la chaîne
 * est revérifiée dans la foulée, et elle tient.
 *
 * D'où le geste central de l'écran : après une annulation réussie, la
 * vérification d'intégrité repart TOUTE SEULE. Ce n'est pas un raffinement —
 * c'est la démonstration. Demander à l'agent de recliquer laisserait planer
 * l'idée qu'il choisit le moment où l'on regarde.
 */

import "@/styles/comptes.css";
import "@/styles/registre.css";
import "@/styles/validations.css";

import { useCallback, useEffect, useRef, useState } from "react";

import { ControleIntegrite } from "./ControleIntegrite";
import { DialogueAnnulation } from "./DialogueAnnulation";
import { TableauEcritures } from "./TableauEcritures";
import {
  annulerOperation,
  listerEcritures,
  verifierIntegrite,
  type FiltresRegistre,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { EcritureRegistre, VerificationIntegrite } from "@/types/domaine";

/** Le front réagit sur le CODE, jamais sur le message du serveur (:626). */
const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  forbidden: "Votre compte n'a pas les droits d'administration.",
  operation_not_found: "Cette écriture n'existe plus au registre. Rechargez la page.",
  operation_already_compensated:
    "Cette écriture a déjà été annulée, peut-être par un collègue. Rechargez la page.",
  validation_failed: "Le serveur a refusé l'annulation : le motif ne peut pas être vide.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

/** Natures proposées au filtre. Énumération fermée du contrat, traduite. */
const NATURES = [
  { valeur: "", libelle: "Toutes natures" },
  { valeur: "topup", libelle: "Rechargements" },
  { valeur: "payment", libelle: "Paiements" },
  { valeur: "compensation", libelle: "Annulations" },
  { valeur: "closure_forfeit", libelle: "Déchéances" },
] as const;

type Etat =
  | { phase: "chargement" }
  | { phase: "prete" }
  | { phase: "echec"; message: string };

export function Registre() {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [ecritures, setEcritures] = useState<EcritureRegistre[]>([]);
  /* Le curseur de la page suivante. `null` = on tient tout le registre. */
  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);
  const [suiteEnCours, setSuiteEnCours] = useState(false);

  const [nature, setNature] = useState("");
  const [depuis, setDepuis] = useState("");
  const [jusqua, setJusqua] = useState("");

  const [integrite, setIntegrite] = useState<VerificationIntegrite | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState(false);

  const [enCours, setEnCours] = useState<string | null>(null);
  const [aAnnuler, setAAnnuler] = useState<EcritureRegistre | null>(null);
  const [erreurDialogue, setErreurDialogue] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [visee, setVisee] = useState<number | null>(null);

  const zoneAnnonce = useRef<HTMLParagraphElement | null>(null);

  const filtres: FiltresRegistre = {
    ...(nature !== "" ? { nature } : {}),
    ...(depuis !== "" ? { depuis: `${depuis}T00:00:00.000Z` } : {}),
    ...(jusqua !== "" ? { jusqua: `${jusqua}T23:59:59.999Z` } : {}),
  };

  const charger = useCallback(async (aAppliquer: FiltresRegistre): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const page = await listerEcritures(aAppliquer);
      setEcritures(page.ecritures);
      setCurseurSuivant(page.curseurSuivant);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  const verifier = useCallback(async (): Promise<void> => {
    setVerificationEnCours(true);
    try {
      setIntegrite(await verifierIntegrite());
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    } finally {
      setVerificationEnCours(false);
    }
  }, []);

  useEffect(() => {
    void charger({
      ...(nature !== "" ? { nature } : {}),
      ...(depuis !== "" ? { depuis: `${depuis}T00:00:00.000Z` } : {}),
      ...(jusqua !== "" ? { jusqua: `${jusqua}T23:59:59.999Z` } : {}),
    });
  }, [charger, nature, depuis, jusqua]);

  /* Un premier contrôle à l'ouverture : l'écran doit pouvoir dire l'état de la
     chaîne sans qu'on ait rien cliqué. */
  useEffect(() => {
    void verifier();
  }, [verifier]);

  async function annuler(ecriture: EcritureRegistre, motif: string): Promise<void> {
    setEnCours(ecriture.operationId);
    setErreurDialogue(null);
    try {
      await annulerOperation(ecriture.operationId, motif);

      /*
       * L'ordre compte pour la démonstration : on recharge le registre — les
       * deux nouvelles écritures y sont, et l'originale porte son lien — PUIS
       * on revérifie la chaîne. Le jury voit la correction, puis la preuve que
       * la correction n'a rien cassé.
       */
      const page = await listerEcritures(filtres);
      setEcritures(page.ecritures);
      setCurseurSuivant(page.curseurSuivant);
      setAAnnuler(null);
      setAnnonce(
        `Écriture n° ${ecriture.seq} annulée : une écriture inverse a été ajoutée au registre. Vérification de la chaîne en cours…`,
      );
      window.setTimeout(() => zoneAnnonce.current?.focus(), 0);

      await verifier();
    } catch (leve) {
      setErreurDialogue(messagePour(leve));
    } finally {
      setEnCours(null);
    }
  }

  /**
   * Charge la suite du registre.
   *
   * La route plafonne une page à 100 écritures et en sert 20 par défaut
   * (`extractors/pagination.rs:1-3`). Un registre comptable qui s'arrêterait
   * là sans le dire serait pire qu'inutile : l'agent croirait tout voir. Le
   * tableau annonce donc combien d'écritures sont affichées, et propose la
   * suite tant qu'il en reste.
   */
  const chargerLaSuite = useCallback(async (): Promise<void> => {
    if (curseurSuivant === null) return;
    setSuiteEnCours(true);
    try {
      const page = await listerEcritures(filtres, curseurSuivant);
      setEcritures((deja) => [...deja, ...page.ecritures]);
      setCurseurSuivant(page.curseurSuivant);
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    } finally {
      setSuiteEnCours(false);
    }
    /* `filtres` est reconstruit à chaque rendu ; le dépendre le ferait
       recréer sans fin. Les valeurs qui le composent suffisent. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curseurSuivant, nature, depuis, jusqua]);

  /** Amène le focus sur une écriture visée par un lien, et la met en évidence. */
  const viser = useCallback((seq: number): void => {
    setVisee(seq);
    window.setTimeout(() => {
      const ligne = document.getElementById(`ecriture-${seq}`);
      if (ligne instanceof HTMLElement) {
        ligne.scrollIntoView({ block: "center", behavior: "smooth" });
        ligne.querySelector("button")?.focus();
      }
    }, 0);
  }, []);

  return (
    <>
      <h1 className="registre-ecran__titre">Registre des transactions</h1>
      <p className="registre-ecran__intro">
        Le journal comptable du dispositif, en écriture seule. Chaque écriture
        porte l&apos;empreinte de celle qui la précède : aucune ne peut être
        modifiée ni retirée sans que le contrôle d&apos;intégrité le voie. Une
        erreur ne s&apos;efface pas, elle se corrige par une écriture inverse.
      </p>

      <p className="journal__horodatage" role="status" tabIndex={-1} ref={zoneAnnonce}>
        {annonce ?? ""}
      </p>

      <div className="registre-ecran">
        <ControleIntegrite
          resultat={integrite}
          enCours={verificationEnCours}
          onVerifier={() => void verifier()}
        />

        <div className="filtres">
          <div className="filtres__champ">
            <label htmlFor="filtre-nature">Nature</label>
            <select
              id="filtre-nature"
              value={nature}
              onChange={(e) => setNature(e.target.value)}
            >
              {NATURES.map((n) => (
                <option key={n.valeur} value={n.valeur}>
                  {n.libelle}
                </option>
              ))}
            </select>
          </div>

          <div className="filtres__champ">
            <label htmlFor="filtre-depuis">Du</label>
            <input
              id="filtre-depuis"
              type="date"
              value={depuis}
              onChange={(e) => setDepuis(e.target.value)}
            />
          </div>

          <div className="filtres__champ">
            <label htmlFor="filtre-jusqua">Au</label>
            <input
              id="filtre-jusqua"
              type="date"
              value={jusqua}
              onChange={(e) => setJusqua(e.target.value)}
            />
          </div>

          <p className="filtres__etat" role="status">
            {nature === "" && depuis === "" && jusqua === "" ? (
              <>Aucun filtre : le registre entier est affiché.</>
            ) : (
              <>
                Filtré sur{" "}
                <span className="filtres__actif">
                  {[
                    nature !== ""
                      ? (NATURES.find((n) => n.valeur === nature)?.libelle ?? nature)
                      : null,
                    depuis !== "" ? `à partir du ${depuis}` : null,
                    jusqua !== "" ? `jusqu'au ${jusqua}` : null,
                  ]
                    .filter((f): f is string => f !== null)
                    .join(", ")}
                </span>
                .{" "}
                <button
                  type="button"
                  className="bouton bouton--discret"
                  onClick={() => {
                    setNature("");
                    setDepuis("");
                    setJusqua("");
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
            <p>
              Aucune écriture n&apos;a été touchée : le journal est en écriture
              seule, une lecture qui échoue ne peut rien y changer.
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

        {etat.phase === "prete" && ecritures.length === 0 && (
          <div className="etat">
            <h2>Aucune écriture ne correspond</h2>
            <p>
              {nature === "" && depuis === "" && jusqua === ""
                ? "Le registre est vide : aucune opération n'a encore été enregistrée."
                : "Aucune écriture ne répond à ces critères. Élargissez la période ou changez de nature."}
            </p>
          </div>
        )}

        {etat.phase === "prete" && ecritures.length > 0 && (
          <>
            <TableauEcritures
              ecritures={ecritures}
              enCours={enCours}
              visee={visee}
              onViser={viser}
              resteAVenir={curseurSuivant !== null}
              onAnnuler={(ecriture) => {
                setErreurDialogue(null);
                setAAnnuler(ecriture);
              }}
            />
            {curseurSuivant !== null && (
              <p className="filtres__etat">
                <button
                  type="button"
                  className="bouton bouton--discret"
                  onClick={() => void chargerLaSuite()}
                  disabled={suiteEnCours}
                >
                  {suiteEnCours
                    ? "Chargement…"
                    : "Charger les écritures plus anciennes"}
                </button>
              </p>
            )}
          </>
        )}
      </div>

      {aAnnuler !== null && (
        <DialogueAnnulation
          ecriture={aAnnuler}
          enCours={enCours === aAnnuler.operationId}
          erreur={erreurDialogue}
          onAnnuler={() => {
            const seq = aAnnuler.seq;
            setAAnnuler(null);
            setErreurDialogue(null);
            window.setTimeout(() => {
              document.getElementById(`annuler-${seq}`)?.focus();
            }, 0);
          }}
          onConfirmer={(motif) => void annuler(aAnnuler, motif)}
        />
      )}
    </>
  );
}
