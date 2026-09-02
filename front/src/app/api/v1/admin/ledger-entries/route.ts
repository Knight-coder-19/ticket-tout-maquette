/**
 * `GET /api/v1/admin/ledger-entries?from=&to=&partner=&kind=&cursor=&limit=`
 *
 * Les écritures du registre, la plus récente en premier.
 *
 * ⚠ CETTE ROUTE EST DE NOTRE FAIT. Le contrat n'expose AUCUNE lecture du
 * journal : la section 4.7 (:487-580) n'en contient pas, et la seule route
 * d'audit qui existe, `GET /admin/audit/verify` (:575-580), rend un booléen et
 * deux compteurs — pas des lignes. C'est le même manque que pour
 * `GET /admin/audit`, signalé dans `front/docs/contrat-api.md`.
 *
 * Les noms de champs viennent des colonnes de `ledger_entries` et
 * `ledger_operations` (`0001_schema.sql:160-185`), en `snake_case` comme le
 * reste du contrat. L'enveloppe est leur `Paginated<T>` (:319-322).
 *
 * ─── L'ordre, et pourquoi il n'est pas négociable ───
 *
 * `seq` décroissant. `seq` est l'ordre d'écriture au journal, celui que la
 * chaîne de hachage fige. Trier par date donnerait un ordre différent dès
 * qu'une opération porte un `occurred_at` antérieur à son enregistrement — ce
 * qui est le cas de toute resynchronisation hors ligne (`POST
 * /partner/payments/batch`). Un registre qui s'affiche dans un autre ordre que
 * celui de sa chaîne est un registre qu'on ne peut pas relire.
 *
 * ─── Chaque ligne porte son empreinte ───
 *
 * `hash` et `prev_hash` sont servis. Ils ne servent pas à l'affichage : ils
 * permettent à qui lit le registre de refaire la vérification lui-même, sans
 * croire la route sur parole. C'est tout l'intérêt d'une chaîne.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite } from "@/mocks/curseur";
import { trouverAdministrateur } from "@/mocks/magasin";
import {
  compensationDe,
  lireEcritures,
  trouverCompte,
  trouverOperation,
  type EcritureRegistre,
  type FiltreRegistre,
  type NatureOperation,
} from "@/mocks/registre";

export const dynamic = "force-dynamic";

const NATURES: readonly NatureOperation[] = ["topup", "payment", "compensation", "closure_forfeit"];

function estNature(valeur: string): valeur is NatureOperation {
  return NATURES.some((n) => n === valeur);
}

function enLigne(ecriture: EcritureRegistre): Record<string, unknown> {
  const operation = trouverOperation(ecriture.operationId);
  const compte = trouverCompte(ecriture.accountId);
  const compensation = operation === undefined ? undefined : compensationDe(operation.id);

  return {
    seq: ecriture.seq,
    operation_id: ecriture.operationId,
    account_id: ecriture.accountId,
    /* Le propriétaire du compte, pour que l'écran n'ait pas à faire la
       jointure : un identifiant de compte ne dit rien à un agent. */
    account_owner_type: compte?.ownerType ?? null,
    account_owner_id: compte?.ownerId ?? null,
    account_system_code: compte?.systemCode ?? null,
    direction: ecriture.direction,
    amount: euros(ecriture.amountCentimes),
    recorded_at: ecriture.recordedAt,
    prev_hash: ecriture.prevHash,
    hash: ecriture.hash,

    kind: operation?.kind ?? null,
    memo: operation?.memo ?? null,
    occurred_at: operation?.occurredAt ?? null,
    created_by: operation?.createdBy ?? null,

    /* Une opération déjà annulée le dit : c'est ce qui empêche l'agent de
       tenter une seconde annulation, et ce qui lui montre la trace des deux. */
    compensated_by: compensation?.operationId ?? null,
    compensation_reason: compensation?.reason ?? null,
  };
}

export async function GET(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;
  const limite = lireLimite(parametres.get("limit"));
  if (limite === null) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre limit doit être un entier positif.");
  }

  const kind = parametres.get("kind");
  if (kind !== null && kind !== "" && !estNature(kind)) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre kind n'est pas une nature d'opération connue.");
  }

  const texte = (nom: string): string | undefined => {
    const valeur = parametres.get(nom);
    return valeur !== null && valeur.trim() !== "" ? valeur.trim() : undefined;
  };

  for (const borne of ["from", "to"]) {
    const valeur = texte(borne);
    if (valeur !== undefined && !Number.isFinite(Date.parse(valeur))) {
      return erreur(422, "VALIDATION_FAILED", `Le paramètre ${borne} doit être une date ISO 8601.`);
    }
  }

  const filtre: FiltreRegistre = {
    ...(texte("from") !== undefined ? { depuis: texte("from") as string } : {}),
    ...(texte("to") !== undefined ? { jusqua: texte("to") as string } : {}),
    ...(texte("partner") !== undefined ? { partenaireId: texte("partner") as string } : {}),
    ...(kind !== null && kind !== "" && estNature(kind) ? { kind } : {}),
  };

  const liste = lireEcritures(filtre);

  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    /* La liste descend : on avance vers les `seq` STRICTEMENT INFERIEURS. */
    const repere = Number(curseur.valeurDeTri);
    const position = liste.findIndex((e) => e.seq < repere);
    debut = position === -1 ? liste.length : position;
  }

  const page = liste.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < liste.length;

  return succes({
    items: page.map(enLigne),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({ valeurDeTri: String(dernier.seq), id: dernier.operationId })
        : null,
  });
}
