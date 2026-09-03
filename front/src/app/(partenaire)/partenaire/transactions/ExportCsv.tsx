"use client";

import { MENTION_SIMULATION } from "@/lib/config/constantes";
import type { LigneEncaissement } from "@/types/encaissement";

/**
 * L'export CSV du journal.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * UN FICHIER QUI SORT DE L'APPLICATION EMPORTE SA MENTION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * La mention de simulation apparaît « partout où un montant s'affiche, titre
 * d'onglet et exports compris ». Un CSV est le cas le plus exposé : il est
 * ouvert dans un tableur, imprimé, transmis en pièce jointe, archivé — toujours
 * détaché de l'écran qui l'a produit. Sans mention, il se lit comme un relevé.
 *
 * Elle est donc portée DEUX FOIS, et les deux comptent :
 *
 *   - EN PREMIÈRE LIGNE DU FICHIER, avant même les en-têtes de colonnes. Un
 *     tableur l'affiche en A1, elle est la première chose lue et elle survit à
 *     l'impression.
 *   - DANS LE NOM DU FICHIER, qui est ce qu'on voit dans une liste de
 *     téléchargements, dans une pièce jointe, dans un dossier — souvent sans
 *     jamais ouvrir le contenu.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * LES MONTANTS SONT DES CENTIMES ENTIERS, ET L'EN-TÊTE LE DIT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `montant_centimes`, pas `montant`. Le domaine est en centimes entiers de bout
 * en bout, et un CSV est relu par un tableur qui n'a aucun moyen de deviner
 * l'unité : « 1250 » se lirait 1 250 € au lieu de 12,50 €, une erreur d'un
 * facteur cent, silencieuse. Le nom de la colonne porte l'unité pour que
 * personne n'ait à la deviner.
 *
 * Aucune conversion en euros décimaux ici : ce serait réintroduire le flottant
 * à la sortie après l'avoir évité partout ailleurs.
 */

/** Les colonnes, dans l'ordre. L'unité est dans le nom. */
const COLONNES = [
  "reference",
  "date_encaissement",
  "date_enregistrement",
  "beneficiaire",
  "montant_centimes",
  "mode_entree",
  "etat",
  "motif_annulation",
] as const;

/**
 * Échappe un champ pour le CSV.
 *
 * Un motif d'annulation est du texte libre : il peut contenir un point-virgule,
 * un guillemet ou un saut de ligne, et chacun casserait le fichier. La règle
 * RFC 4180 : on entoure de guillemets, et on double les guillemets internes.
 */
function echapper(valeur: string): string {
  if (!/[";\n\r]/.test(valeur)) return valeur;
  return `"${valeur.replace(/"/g, '""')}"`;
}

/**
 * Le contenu du fichier.
 *
 * Séparateur POINT-VIRGULE et non virgule : c'est ce qu'attend un tableur en
 * locale française, où la virgule est le séparateur décimal. Un CSV à la
 * virgule s'ouvre en une seule colonne chez le destinataire.
 */
export function construireCsv(lignes: LigneEncaissement[], genereLe: number): string {
  const mention = [
    MENTION_SIMULATION,
    "Ce fichier est un export de demonstration. Il ne vaut pas justificatif comptable.",
    `Genere le ${new Date(genereLe).toISOString()}`,
  ].join(" - ");

  const modes: Record<LigneEncaissement["modeSaisie"], string> = {
    qr_scan: "scan du QR",
    short_code: "code court",
  };
  const etats: Record<LigneEncaissement["etat"], string> = {
    regle: "regle",
    annule: "annule",
  };

  const corps = lignes.map((ligne) =>
    [
      ligne.reference,
      ligne.survenueLe,
      ligne.synchroniseeLe,
      ligne.beneficiaire,
      String(ligne.montant),
      modes[ligne.modeSaisie],
      etats[ligne.etat],
      ligne.motifAnnulation ?? "",
    ]
      .map(echapper)
      .join(";"),
  );

  /* La mention EN PREMIÈRE LIGNE, avant les en-têtes. Elle occupe A1. */
  return [echapper(mention), COLONNES.join(";"), ...corps].join("\r\n");
}

/** Le nom du fichier. Il porte la mention, lui aussi. */
export function nomDuFichier(genereLe: number): string {
  const jour = new Date(genereLe).toISOString().slice(0, 10);
  return `encaissements-${jour}-SIMULATION.csv`;
}

export function ExportCsv({
  lignes,
  complet,
}: {
  lignes: LigneEncaissement[];
  /** Faux s'il reste des lignes à charger : l'export ne porte que le visible. */
  complet: boolean;
}) {
  function exporter(): void {
    const genereLe = Date.now();
    /*
     * Le BOM UTF-8 en tête : sans lui, un tableur en locale française ouvre le
     * fichier en Latin-1 et « réglé » devient « rÃ©glÃ© ». Trois octets qui
     * évitent que chaque accent du fichier soit cassé — et nous venons de
     * passer un tour entier à les mettre.
     */
    const contenu = `\ufeff${construireCsv(lignes, genereLe)}`;
    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomDuFichier(genereLe);
    lien.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="export">
      <button
        type="button"
        className="bouton bouton--discret"
        onClick={exporter}
        disabled={lignes.length === 0}
      >
        Exporter en CSV
      </button>
      <p className="export__portee">
        {lignes.length === 0
          ? "Aucune ligne à exporter."
          : complet
            ? `Le fichier contiendra les ${lignes.length} lignes affichées.`
            : `Le fichier ne contiendra que les ${lignes.length} lignes déjà chargées. Chargez la suite pour les exporter toutes.`}
      </p>
    </div>
  );
}
