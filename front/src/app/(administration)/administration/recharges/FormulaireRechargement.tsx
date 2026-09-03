"use client";

import { useEffect, useState } from "react";

import { centimesDepuisSaisie, formaterCentimes } from "@/lib/montant";
import { listerBeneficiaires } from "@/lib/services/administration.service";
import type { EmployeurRepertoire, LigneRepertoire } from "@/types/domaine";

/**
 * Le rechargement individuel : un salarié, un montant, un motif.
 *
 * ═══ UN FINANCEMENT, PAS UNE CORRECTION ═══
 *
 * À distinguer de `DialogueRegularisation` (fiche d'un bénéficiaire), qui
 * répare une erreur de solde. Ici, l'administration verse un droit — c'est
 * pourquoi il n'y a ni plafond ni vérification de disponible : un
 * rechargement ne peut jamais rendre un solde négatif, il ne fait que
 * l'augmenter.
 *
 * ═══ ADRESSÉ PAR EMPLOYEUR ET MATRICULE, PAS PAR IDENTIFIANT ═══
 *
 * `TopupRequest` (`data-dictionary.md:538-543`) ne connaît ni `id` ni
 * `nom` : `employer_id` et `employer_ref` (le matricule). Le formulaire
 * respecte cette adresse — l'employeur d'abord, puis un salarié DE CET
 * employeur — plutôt que de chercher un salarié dans tout le répertoire et
 * d'en déduire l'employeur : la route ne saurait rien faire d'un identifiant
 * interne de toute façon.
 *
 * ═══ CENTIMES ENTIERS, JAMAIS DE FLOTTANT ═══
 *
 * `centimesDepuisSaisie` découpe la chaîne saisie plutôt que de multiplier un
 * flottant par cent — la même règle que partout ailleurs dans ce projet
 * (`lib/montant.ts:12`).
 *
 * ═══ LA RÉFÉRENCE N'EST PAS LE MOTIF ═══
 *
 * Deux champs, deux rôles bien distincts, et le formulaire le dit : la
 * référence est une clé de rejeu — la RÉUTILISER identifie un rechargement
 * déjà versé et empêche un doublon accidentel. Le motif, lui, explique le
 * versement à qui relira le registre. Les confondre ferait perdre l'un des
 * deux usages.
 */
export function FormulaireRechargement({
  employeurs,
  enCours,
  erreur,
  onCrediter,
}: {
  employeurs: EmployeurRepertoire[];
  enCours: boolean;
  erreur: string | null;
  onCrediter: (
    employeurId: string,
    matricule: string,
    montantCentimes: number,
    motif: string,
    reference: string | null,
  ) => void;
}) {
  const [employeurId, setEmployeurId] = useState("");
  const [beneficiaires, setBeneficiaires] = useState<LigneRepertoire[]>([]);
  const [chargementBeneficiaires, setChargementBeneficiaires] = useState(false);
  const [salarieId, setSalarieId] = useState("");
  const [saisieMontant, setSaisieMontant] = useState("");
  const [reference, setReference] = useState("");
  const [motif, setMotif] = useState("");

  useEffect(() => {
    if (employeurId === "") {
      setBeneficiaires([]);
      setSalarieId("");
      return;
    }
    let annule = false;
    setChargementBeneficiaires(true);
    void listerBeneficiaires({ employeurId, statut: "actif" })
      .then((page) => {
        if (!annule) setBeneficiaires(page.lignes);
      })
      .finally(() => {
        if (!annule) setChargementBeneficiaires(false);
      });
    setSalarieId("");
    return () => {
      annule = true;
    };
  }, [employeurId]);

  const montant = centimesDepuisSaisie(saisieMontant);
  const salarie = beneficiaires.find((b) => b.id === salarieId);
  const motifNettoye = motif.trim();
  const pretAEnvoyer =
    !enCours && salarie !== undefined && montant !== null && motifNettoye !== "";

  return (
    <section className="rechargement-individuel" aria-labelledby="rechargement-titre">
      <h2 className="recharges__soustitre" id="rechargement-titre">
        Créditer un salarié
      </h2>

      <form
        onSubmit={(evenement) => {
          evenement.preventDefault();
          if (pretAEnvoyer && salarie !== undefined && montant !== null) {
            onCrediter(
              employeurId,
              salarie.matricule,
              montant,
              motifNettoye,
              reference.trim() === "" ? null : reference.trim(),
            );
          }
        }}
      >
        <div className="filtres">
          <div className="filtres__champ">
            <label htmlFor="rechargement-employeur">Employeur</label>
            <select
              id="rechargement-employeur"
              value={employeurId}
              disabled={enCours}
              onChange={(e) => setEmployeurId(e.target.value)}
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
            <label htmlFor="rechargement-salarie">Salarié</label>
            <select
              id="rechargement-salarie"
              value={salarieId}
              disabled={enCours || employeurId === "" || chargementBeneficiaires}
              onChange={(e) => setSalarieId(e.target.value)}
              aria-describedby="rechargement-salarie-aide"
            >
              <option value="">
                {employeurId === ""
                  ? "Choisissez d'abord un employeur"
                  : chargementBeneficiaires
                    ? "Chargement…"
                    : "Choisir un salarié"}
              </option>
              {beneficiaires.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nomAffiche} ({b.matricule})
                </option>
              ))}
            </select>
            <span className="filtres__aide" id="rechargement-salarie-aide">
              Seuls les salariés actifs de cet employeur sont proposés.
            </span>
          </div>
        </div>

        {salarie !== undefined && (
          <p className="rechargement-individuel__solde">
            Disponible actuel : {formaterCentimes(salarie.disponible)}.
          </p>
        )}

        <label htmlFor="rechargement-montant">Montant</label>
        <input
          id="rechargement-montant"
          type="text"
          inputMode="decimal"
          value={saisieMontant}
          placeholder="50,00"
          autoComplete="off"
          spellCheck={false}
          disabled={enCours}
          aria-invalid={saisieMontant.trim() !== "" && montant === null}
          aria-describedby="rechargement-montant-aide"
          onChange={(e) => setSaisieMontant(e.target.value)}
        />
        <p className="dialogue__aide" id="rechargement-montant-aide">
          En euros. La virgule et le point sont acceptés, deux décimales au plus.
        </p>

        <label htmlFor="rechargement-reference">Référence (facultative)</label>
        <input
          id="rechargement-reference"
          type="text"
          value={reference}
          autoComplete="off"
          disabled={enCours}
          aria-describedby="rechargement-reference-aide"
          onChange={(e) => setReference(e.target.value)}
        />
        <p className="dialogue__aide" id="rechargement-reference-aide">
          Une clé de rejeu, pas un motif : la réutiliser pour ce même employeur
          identifie ce rechargement comme déjà versé plutôt que d&apos;en créer
          un second, même vers un autre salarié.
        </p>

        <label htmlFor="rechargement-motif">Motif</label>
        <textarea
          id="rechargement-motif"
          value={motif}
          rows={3}
          disabled={enCours}
          required
          aria-describedby="rechargement-motif-aide"
          onChange={(e) => setMotif(e.target.value)}
        />
        <p className="dialogue__aide" id="rechargement-motif-aide">
          Obligatoire. Il explique le versement dans le registre.
        </p>

        {erreur !== null && (
          <p className="etat etat--echec" role="alert">
            {erreur}
          </p>
        )}

        <div className="actions">
          <button type="submit" className="bouton bouton--action" disabled={!pretAEnvoyer}>
            {enCours ? "Versement…" : "Créditer"}
          </button>
        </div>
      </form>
    </section>
  );
}
