/**
 * `POST /api/v1/admin/topups` — le rechargement individuel.
 *
 * ✅ ROUTE DU CONTRAT (`data-dictionary.md:537-543`). `TopupRequest` :
 * `employer_id`, `employer_ref` (le matricule, décision 12), `amount`,
 * `reference`. Adressé par matricule, PAS par identifiant de salarié — voir
 * `crediterSalarie` (`mocks/magasin.ts`) pour tout le raisonnement, y compris
 * le comportement RÉEL et un peu surprenant de l'idempotence par `reference`.
 *
 * NOTRE CHOIX DE STATUT : `201`. Le contrat ne l'écrit pas (ambiguïté A3),
 * mais la route crée une ressource — un rechargement — comme les autres
 * créations de ce projet (`AdjustmentResult`, `CreateHighlightResponse`).
 *
 * ⚠ Le corps envoie aussi `reason` (NOTRE AJOUT) : voir l'en-tête de
 * `crediterSalarie` pour pourquoi un motif est exigé alors que `TopupRequest`
 * n'en porte pas, et pourquoi `topup.rs:59` poste avec `memo: None`.
 */

import { centimesDepuisEuros, erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { crediterSalarie, trouverAdministrateur, type EchecTopup } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const ECHECS: Record<EchecTopup, { statut: number; code: string; message: string }> = {
  salarie_introuvable: {
    statut: 404,
    code: "NOT_FOUND",
    message: "Aucun salarié ne correspond à ce matricule pour cet employeur.",
  },
  compte_inactif: {
    statut: 422,
    code: "ACCOUNT_INACTIVE",
    message: "Ce compte n'est pas actif : il ne peut pas être crédité.",
  },
  motif_manquant: {
    statut: 422,
    code: "VALIDATION_FAILED",
    message: "Le motif est obligatoire : un versement doit pouvoir se justifier.",
  },
  montant_invalide: {
    statut: 422,
    code: "VALIDATION_FAILED",
    message: "Le montant doit être strictement positif.",
  },
};

export async function POST(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return erreur(422, "VALIDATION_FAILED", "Le corps de la requête n'est pas du JSON.");
  }
  const donnees = (corps ?? {}) as Record<string, unknown>;

  const employeurId = donnees["employer_id"];
  if (typeof employeurId !== "string" || employeurId.trim() === "") {
    return erreur(422, "VALIDATION_FAILED", "employer_id est requis.");
  }

  const matricule = donnees["employer_ref"];
  if (typeof matricule !== "string" || matricule.trim() === "") {
    return erreur(422, "VALIDATION_FAILED", "employer_ref est requis.");
  }

  const centimes = centimesDepuisEuros(donnees["amount"]);
  if (centimes === null) {
    return erreur(422, "VALIDATION_FAILED", "Le montant est illisible.");
  }

  const reference = donnees["reference"];
  if (reference !== null && reference !== undefined && typeof reference !== "string") {
    return erreur(422, "VALIDATION_FAILED", "La référence doit être une chaîne, ou null.");
  }

  const motif = donnees["reason"];
  if (motif !== null && motif !== undefined && typeof motif !== "string") {
    return erreur(422, "VALIDATION_FAILED", "reason doit être une chaîne, ou null.");
  }

  const issue = crediterSalarie(
    employeurId,
    matricule,
    centimes,
    typeof motif === "string" ? motif : null,
    typeof reference === "string" ? reference : null,
    administrateurId,
    Date.now(),
  );
  if ("echec" in issue) {
    const refus = ECHECS[issue.echec];
    return erreur(refus.statut, refus.code, refus.message);
  }

  return succes(
    {
      id: issue.operation.id,
      amount: euros(issue.operation.amountCentimes),
      employer_id: employeurId,
      employer_ref: matricule,
      reference: typeof reference === "string" ? reference : null,
      occurred_at: issue.operation.occurredAt,
      /* ⚠ Notre ajout, absent de `Topup` (:264-268). */
      reason: issue.operation.memo,
      /* ⚠ Notre ajout : distingue un rechargement qui vient d'avoir lieu d'un
         rejeu qui a simplement retrouvé le premier — voir l'en-tête. */
      replayed: issue.rejoue,
    },
    201,
  );
}
