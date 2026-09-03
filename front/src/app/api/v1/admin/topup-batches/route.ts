/**
 * `POST /api/v1/admin/topup-batches` — l'import CSV d'un lot de rechargements.
 *
 * ✅ ROUTE DU CONTRAT (`data-dictionary.md:545-554`), en `multipart/form-data`.
 * Rend un `BatchPreview` : `batch_id`, `file_name`, `line_count`,
 * `total_amount`, `status`, `errors[]`.
 *
 * ⚠ AMBIGUÏTÉ A11 DE L'AUDIT : le nom du champ fichier du multipart n'est écrit
 * nulle part. NOTRE CHOIX : `file`, le nom le plus courant pour un unique
 * fichier téléversé. Le formulaire envoie aussi `employer_id` — le lot est
 * scopé à UN employeur, `funding/batch.rs:2` le confirme :
 * `parse_and_stage(tx, admin, employer_id, file_name, bytes)`.
 *
 * ⚠ NOTRE AJOUT : `reason`, le motif du versement — appliqué à CHAQUE ligne du
 * lot au moment de la validation. Même raisonnement que sur le rechargement
 * individuel ; voir `crediterSalarie` (`mocks/magasin.ts`).
 *
 * ─── DEUX ÉTAGES, COMME LE BACK ───
 *
 * `csv.rs` ne valide que le FORMAT du fichier (colonnes `matricule`,
 * `montant`, `reference` facultative — un courriel accepté comme clé
 * alternative). `batch.rs` résout ensuite chaque ligne contre les salariés
 * réels de l'employeur. Les deux étages produisent la MÊME forme d'erreur,
 * `BatchLineError { line, employer_ref, reason }` — l'écran n'a pas à
 * distinguer une erreur de format d'une erreur de résolution.
 *
 * ─── LE LOT EST TOUJOURS CRÉÉ, MÊME AVEC DES ERREURS ───
 *
 * « si non vide, la validation sera refusée » (:554) — c'est `.../validate`
 * qui refuse, pas cette route. Un fichier lisible et inédit produit toujours
 * un aperçu, erreurs comprises : c'est justement l'aperçu qui permet de les
 * voir AVANT de rien écrire.
 *
 * ─── LE FICHIER, LUI, PEUT ÊTRE REFUSÉ D'EMBLÉE ───
 *
 * `409 DUPLICATE_BATCH` si son empreinte a déjà été importée pour ce même
 * employeur (`uq_batch_file`, `0001_schema.sql:216`) — même si ce premier
 * essai n'a jamais été validé. `422` si le fichier n'a pas la forme d'un CSV
 * exploitable (vide, ou sans les colonnes `matricule`/`montant`).
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import {
  mettreLotEnAttente,
  nomComplet,
  trouverAdministrateur,
  trouverSalarie,
  type EchecMiseEnAttenteLot,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const ECHECS: Record<EchecMiseEnAttenteLot, { statut: number; code: string; message: string }> = {
  employeur_introuvable: {
    statut: 404,
    code: "NOT_FOUND",
    message: "Cet employeur n'existe pas.",
  },
  fichier_vide: {
    statut: 422,
    code: "VALIDATION_FAILED",
    message: "Le fichier est vide.",
  },
  entete_invalide: {
    statut: 422,
    code: "VALIDATION_FAILED",
    message: "L'en-tête doit comporter au moins les colonnes matricule et montant.",
  },
  fichier_deja_importe: {
    statut: 409,
    code: "DUPLICATE_BATCH",
    message: "Ce fichier a déjà été importé pour cet employeur.",
  },
};

export async function POST(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  let formulaire: FormData;
  try {
    formulaire = await requete.formData();
  } catch {
    return erreur(422, "VALIDATION_FAILED", "Le corps de la requête n'est pas un multipart valide.");
  }

  const employeurId = formulaire.get("employer_id");
  if (typeof employeurId !== "string" || employeurId.trim() === "") {
    return erreur(422, "VALIDATION_FAILED", "employer_id est requis.");
  }

  const motif = formulaire.get("reason");
  if (typeof motif !== "string" || motif.trim() === "") {
    return erreur(422, "VALIDATION_FAILED", "Le motif est obligatoire : un versement doit pouvoir se justifier.");
  }

  const fichier = formulaire.get("file");
  if (!(fichier instanceof Blob)) {
    return erreur(422, "VALIDATION_FAILED", "Le fichier est requis, sous le champ « file ».");
  }
  const nomFichier = fichier instanceof File ? fichier.name : "import.csv";
  const contenu = await fichier.text();

  const issue = mettreLotEnAttente(
    employeurId,
    nomFichier,
    contenu,
    motif,
    administrateurId,
    Date.now(),
  );
  if ("echec" in issue) {
    const refus = ECHECS[issue.echec];
    return erreur(refus.statut, refus.code, refus.message);
  }

  const { lot } = issue;
  const totalCentimes = lot.lignes.reduce((somme, l) => somme + (l.montantCentimes ?? 0), 0);

  return succes({
    batch_id: lot.id,
    file_name: lot.nomFichier,
    line_count: lot.lignes.length,
    total_amount: euros(totalCentimes),
    status: lot.statut,
    errors: lot.lignes
      .filter((l) => l.erreur !== null)
      .map((l) => ({ line: l.ligne, employer_ref: l.matriculeOuCourriel, reason: l.erreur })),
    /* ⚠ Notre ajout : voir `types/api.ts`, `BatchPreview.lines`. */
    lines: lot.lignes.map((l) => {
      const salarie = l.salarieId === null ? undefined : trouverSalarie(l.salarieId);
      return {
        line: l.ligne,
        employer_ref: l.matriculeOuCourriel,
        resolved_name: salarie === undefined ? null : nomComplet(salarie),
        amount: l.montantCentimes === null ? null : euros(l.montantCentimes),
        error: l.erreur,
      };
    }),
  });
}
