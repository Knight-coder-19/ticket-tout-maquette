/**
 * `POST /api/v1/admin/employees/{id}/adjustments` — la régularisation.
 *
 * ⚠ DE NOTRE FAIT. Le contrat n'a rien de tel, et ce n'est pas un oubli
 * évident : les deux routes voisines existent et ne conviennent ni l'une ni
 * l'autre.
 *
 *   - `POST /admin/topups` (:537) est un FINANCEMENT. Il s'adresse par
 *     `(employer_id, employer_ref)`, porte une `reference` qui sert de clé
 *     d'idempotence, et `funding/topup.rs:1` l'inscrit dans la table `topups`.
 *     Une régularisation ne vient d'aucun employeur et ne finance rien.
 *   - `POST /admin/compensations` (:558) REVERSE UNE OPÉRATION CONNUE :
 *     `CompensationRequest` exige un `original_operation_id`, et
 *     `corrections/mod.rs:1` lit l'opération d'origine avant d'en poster
 *     l'inverse. Une régularisation ne corrige pas une opération, elle corrige
 *     un solde — souvent parce qu'aucune opération n'a été passée.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RÈGLE R1 — CETTE ROUTE N'ÉCRIT AUCUN SOLDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Elle ajoute UNE ÉCRITURE au registre, avec un motif obligatoire, exactement
 * comme l'annulation. Le solde en est la conséquence : il est relu depuis le
 * journal après l'écriture, jamais calculé à partir du montant envoyé.
 *
 * On peut le vérifier en lisant : il n'y a pas une seule affectation de solde
 * ici, ni dans `regulariser`. `posterOperation` reste le seul point d'écriture
 * du journal, et les écritures sont gelées une fois posées.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RÈGLE R2 — ET LA BORNE N'EST PAS CELLE QU'ON CROIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une régularisation qui rendrait le solde négatif est refusée. Ce n'est pas
 * une politesse d'interface : `settled_never_negative` (`0001_schema.sql:57`)
 * l'interdit en base.
 *
 * Mais la borne du débit est le DISPONIBLE, pas le réglé. `held_within_settled`
 * (`:59`) impose `balance_held <= balance_settled` : débiter un salarié qui
 * possède 30 EUR dont 25 sont réservés par un jeton en cours ferait passer
 * `settled` sous `held`, et la base refuserait. Le refus est donc prononcé à
 * partir de 5 EUR + 1 centime, pas à partir de 30 EUR + 1 centime.
 *
 * Le montant part en euros décimaux, comme tout montant du contrat
 * (`money.rs:145`, amendement A5), et redevient un entier de centimes ici.
 */

import { centimesDepuisEuros, erreur, euros, identite, succes } from "@/mocks/enveloppe";
import {
  regulariser,
  trouverAdministrateur,
  type EchecRegularisation,
  type SensRegularisation,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

/** Chaque refus, son statut et son code. */
const REFUS: Record<EchecRegularisation, { statut: number; code: string; message: string }> = {
  introuvable: { statut: 404, code: "NOT_FOUND", message: "Ce bénéficiaire n'existe pas." },
  motif_manquant: {
    statut: 422,
    code: "VALIDATION_FAILED",
    message: "Le motif est obligatoire : une régularisation doit pouvoir se justifier.",
  },
  montant_invalide: {
    statut: 422,
    code: "VALIDATION_FAILED",
    message: "Le montant doit être strictement positif.",
  },
  compte_ferme: {
    statut: 409,
    code: "ACCOUNT_CLOSED",
    message: "Ce compte est fermé : il ne peut plus recevoir d'écriture.",
  },
  solde_insuffisant: {
    statut: 409,
    code: "INSUFFICIENT_FUNDS",
    message:
      "Le montant dépasse le solde disponible. Un débit ne peut pas entamer les fonds réservés par un paiement en cours.",
  },
};

export async function POST(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const { id } = await contexte.params;

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return erreur(422, "VALIDATION_FAILED", "Le corps de la requête n'est pas du JSON.");
  }
  const donnees = (corps ?? {}) as Record<string, unknown>;

  const sensBrut = donnees["direction"];
  if (sensBrut !== "credit" && sensBrut !== "debit") {
    return erreur(422, "VALIDATION_FAILED", "Le sens doit valoir « credit » ou « debit ».");
  }
  const sens: SensRegularisation = sensBrut;

  const centimes = centimesDepuisEuros(donnees["amount"]);
  if (centimes === null) {
    return erreur(422, "VALIDATION_FAILED", "Le montant est illisible.");
  }

  const motif = typeof donnees["reason"] === "string" ? donnees["reason"] : null;

  const issue = regulariser(id, sens, centimes, motif, administrateurId, Date.now());
  if ("echec" in issue) {
    const refus = REFUS[issue.echec];
    return erreur(refus.statut, refus.code, refus.message);
  }

  /*
    La réponse porte LES DEUX : le nouveau solde et l'écriture qui l'explique.

    Rendre le seul solde obligerait l'écran à recharger le journal pour montrer
    d'où il vient, et laisserait un instant où le nombre a changé sans que rien
    ne dise pourquoi. C'est précisément ce que R1 cherche à rendre impossible.
  */
  return succes(
    {
      balance: {
        settled: euros(issue.solde.settledCentimes),
        held: euros(issue.solde.heldCentimes),
        available: euros(issue.solde.disponibleCentimes),
      },
      entry: {
        operation_id: issue.operation.id,
        kind: issue.operation.kind,
        direction: sens,
        amount: euros(issue.operation.amountCentimes),
        memo: issue.operation.memo,
        occurred_at: issue.operation.occurredAt,
        created_by: issue.operation.createdBy,
      },
    },
    201,
  );
}
