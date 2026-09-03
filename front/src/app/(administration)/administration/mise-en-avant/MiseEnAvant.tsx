"use client";

/**
 * La sélection du Ministre : deux vitrines, un même mécanisme.
 *
 * ═══ LE SENS DE L'ÉCRAN ═══
 *
 * Le ministre choisit certains partenaires agréés à mettre en avant. Un
 * administrateur bascule un partenaire dedans ou dehors, avec un mot du
 * ministre facultatif qui paraît sur la vitrine tel quel — arbitrage du §7 :
 * « Sélection du Ministre, badge officiel, ton positif : retenus ».
 *
 * ═══ DEUX EMPLACEMENTS, ET C'EST LE SCHÉMA QUI LE VEUT ═══
 *
 * `partner_highlights.placement` porte DEUX valeurs (`0001_schema.sql:16`),
 * pas une, et elles n'ont pas le même public :
 *
 *   - `minister_pick` paraît à un salarié CONNECTÉ, dans son espace
 *     (`GET /me/minister-picks`, data-dictionary.md:394-399) ;
 *   - `public_featured` paraît à N'IMPORTE QUI, sans connexion — c'est LA
 *     vitrine publique au sens strict (`GET /public/featured-partners`,
 *     seule route de tout le contrat sans authentification, amendement A3).
 *
 * Ne gérer que l'un des deux aurait fait disparaître purement et simplement
 * la moitié de ce que le schéma prévoit. L'écran gère donc les deux,
 * distingués par un commutateur en tête — sans jamais les mélanger : chaque
 * bascule, chaque carte, chaque appel de route précise l'emplacement qu'il
 * vise.
 *
 * ═══ CE QUI SE VÉRIFIE À L'EXÉCUTION ═══
 *
 * Basculer dedans (avec et sans mot), basculer dehors, et — c'est la partie
 * qui compte le plus — que `GET /public/featured-partners` reflète l'ordre
 * après un déplacement, pas seulement l'appartenance.
 */

import "@/styles/primitives.css";
import "@/styles/mise-en-avant.css";

import { useCallback, useEffect, useState } from "react";

import { CarteMiseEnAvant } from "./CarteMiseEnAvant";
import { DialogueMotMinistre } from "./DialogueMotMinistre";
import { TableauBascule } from "./TableauBascule";
import {
  ajouterMiseEnAvant,
  listerComptes,
  listerMisesEnAvant,
  reordonnerMisesEnAvant,
  retirerMiseEnAvant,
} from "@/lib/services/administration.service";
import { ErreurService } from "@/types/erreurs";
import type { ComptePartenaire, Emplacement, MiseEnAvant as MiseEnAvantDomaine } from "@/types/domaine";

const MESSAGES: Record<string, string> = {
  reseau: "Le service est injoignable. Vérifiez la connexion, puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous, puis reprenez.",
  not_found: "Ce partenaire n'existe plus. Rechargez la liste.",
  highlight_not_eligible: "Seul un partenaire agréé peut être mis en avant.",
  highlight_duplicate: "Ce partenaire est déjà mis en avant sur cet emplacement.",
  validation_failed: "La demande a été refusée : vérifiez les données envoyées.",
  reponse_illisible:
    "Le serveur a répondu quelque chose d'illisible. Signalez-le, en indiquant l'heure.",
};

function messagePour(leve: unknown): string {
  if (leve instanceof ErreurService) return MESSAGES[leve.code] ?? leve.message;
  return "Une erreur inattendue est survenue.";
}

const EMPLACEMENTS: { valeur: Emplacement; libelle: string; description: string }[] = [
  {
    valeur: "public_featured",
    libelle: "Vitrine publique",
    description: "Visible par tout le monde, sans connexion.",
  },
  {
    valeur: "minister_pick",
    libelle: "Sélection du Ministre",
    description: "Visible par les salariés connectés, dans leur espace.",
  },
];

type Etat =
  | { phase: "chargement" }
  | { phase: "prete" }
  | { phase: "echec"; message: string };

export function MiseEnAvant() {
  const [emplacement, setEmplacement] = useState<Emplacement>("public_featured");
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [comptes, setComptes] = useState<ComptePartenaire[]>([]);
  const [misesEnAvant, setMisesEnAvant] = useState<MiseEnAvantDomaine[]>([]);
  const [curseurSuivant, setCurseurSuivant] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurGeste, setErreurGeste] = useState<string | null>(null);

  /** Le partenaire pour lequel le dialogue du mot du ministre est ouvert. */
  const [aBasculer, setABasculer] = useState<ComptePartenaire | null>(null);

  const charger = useCallback(async (cible: Emplacement): Promise<void> => {
    setEtat({ phase: "chargement" });
    try {
      const [page, actives] = await Promise.all([
        listerComptes({ statut: "approved" }),
        listerMisesEnAvant(cible),
      ]);
      setComptes(page.comptes);
      setCurseurSuivant(page.curseurSuivant);
      setMisesEnAvant(actives);
      setEtat({ phase: "prete" });
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, []);

  useEffect(() => {
    void charger(emplacement);
  }, [charger, emplacement]);

  const chargerLaSuite = useCallback(async (): Promise<void> => {
    if (curseurSuivant === null) return;
    try {
      const page = await listerComptes({ statut: "approved" }, curseurSuivant);
      setComptes((deja) => [...deja, ...page.comptes]);
      setCurseurSuivant(page.curseurSuivant);
    } catch (leve) {
      setEtat({ phase: "echec", message: messagePour(leve) });
    }
  }, [curseurSuivant]);

  /** Retire, sans dialogue : voir la route DELETE, aucune raison n'est demandée. */
  const retirer = useCallback(
    async (id: string): Promise<void> => {
      setEnCours(id);
      setErreurGeste(null);
      try {
        await retirerMiseEnAvant(id);
        setMisesEnAvant(await listerMisesEnAvant(emplacement));
      } catch (leve) {
        setErreurGeste(messagePour(leve));
      } finally {
        setEnCours(null);
      }
    },
    [emplacement],
  );

  const ajouter = useCallback(
    async (mot: string | null): Promise<void> => {
      if (aBasculer === null) return;
      setEnCours(aBasculer.id);
      setErreurGeste(null);
      try {
        await ajouterMiseEnAvant(aBasculer.id, emplacement, null, mot);
        setMisesEnAvant(await listerMisesEnAvant(emplacement));
        setABasculer(null);
      } catch (leve) {
        setErreurGeste(messagePour(leve));
      } finally {
        setEnCours(null);
      }
    },
    [aBasculer, emplacement],
  );

  /**
   * Échange la position de deux mises en avant voisines, et envoie la liste
   * COMPLÈTE au serveur : `ordered_ids` n'accepte rien de moins
   * (`data-dictionary.md:534`).
   */
  const deplacer = useCallback(
    async (index: number, versIndex: number): Promise<void> => {
      const ordre = [...misesEnAvant];
      const item = ordre[index];
      const voisin = ordre[versIndex];
      if (item === undefined || voisin === undefined) return;
      ordre[index] = voisin;
      ordre[versIndex] = item;

      setEnCours(item.id);
      setErreurGeste(null);
      try {
        setMisesEnAvant(
          await reordonnerMisesEnAvant(emplacement, ordre.map((m) => m.id)),
        );
      } catch (leve) {
        setErreurGeste(messagePour(leve));
      } finally {
        setEnCours(null);
      }
    },
    [emplacement, misesEnAvant],
  );

  const idsEnAvant = new Set(misesEnAvant.map((m) => m.partenaireId));
  const emplacementActuel = EMPLACEMENTS.find((e) => e.valeur === emplacement);

  return (
    <div className="selection-ministre">
      <h1 className="ecran__titre">Sélection du Ministre</h1>
      <p className="ecran__intro">
        Choisissez les partenaires agréés à mettre en avant. Un mot du ministre
        est facultatif ; s&apos;il existe, il paraît tel quel là où la mise en
        avant est visible.
      </p>

      <div
        className="selection-ministre__emplacements"
        role="group"
        aria-label="Emplacement à gérer"
      >
        {EMPLACEMENTS.map((e) => (
          <button
            key={e.valeur}
            type="button"
            className="bouton bouton--discret"
            aria-pressed={emplacement === e.valeur}
            onClick={() => setEmplacement(e.valeur)}
          >
            {e.libelle}
          </button>
        ))}
      </div>
      {emplacementActuel !== undefined && (
        <p className="selection-ministre__description">{emplacementActuel.description}</p>
      )}

      {etat.phase === "chargement" && (
        <div className="etat etat--chargement" aria-busy="true" aria-live="polite">
          <p>Lecture de la sélection…</p>
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
            onClick={() => void charger(emplacement)}
          >
            Réessayer
          </button>
        </div>
      )}

      {etat.phase === "prete" && (
        <>
          <section aria-labelledby="vitrine-titre">
            <h2 className="selection-ministre__soustitre" id="vitrine-titre">
              Ce qui est mis en avant
            </h2>

            {misesEnAvant.length === 0 ? (
              <div className="etat etat--vide">
                <p>Aucun partenaire n&apos;est mis en avant sur cet emplacement.</p>
              </div>
            ) : (
              <div className="vitrine-apercu">
                {misesEnAvant.map((m, index) => (
                  <CarteMiseEnAvant
                    key={m.id}
                    miseEnAvant={m}
                    rang={index + 1}
                    total={misesEnAvant.length}
                    enCours={enCours === m.id}
                    onMonter={() => void deplacer(index, index - 1)}
                    onDescendre={() => void deplacer(index, index + 1)}
                    onRetirer={() => void retirer(m.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {erreurGeste !== null && aBasculer === null && (
            <p className="etat etat--echec" role="alert">
              {erreurGeste}
            </p>
          )}

          <section aria-labelledby="bascule-titre">
            <h2 className="selection-ministre__soustitre" id="bascule-titre">
              Tous les partenaires agréés
            </h2>
            <TableauBascule
              comptes={comptes}
              enAvant={idsEnAvant}
              resteAVenir={curseurSuivant !== null}
              enCours={enCours}
              onBasculer={(compte, vers) => {
                if (vers) {
                  setErreurGeste(null);
                  setABasculer(compte);
                } else {
                  const mise = misesEnAvant.find((m) => m.partenaireId === compte.id);
                  if (mise) void retirer(mise.id);
                }
              }}
            />
            {curseurSuivant !== null && (
              <div className="actions">
                <button
                  type="button"
                  className="bouton bouton--discret"
                  onClick={() => void chargerLaSuite()}
                >
                  Charger les suivants
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {aBasculer !== null && (
        <DialogueMotMinistre
          nomPartenaire={aBasculer.enseigne}
          enCours={enCours === aBasculer.id}
          erreur={erreurGeste}
          onAnnuler={() => setABasculer(null)}
          onConfirmer={(mot) => void ajouter(mot)}
        />
      )}
    </div>
  );
}
