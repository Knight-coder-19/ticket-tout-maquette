/**
 * `GET /api/v1/partner/transactions?from=&to=&cursor=` — le journal du
 * commerçant.
 *
 * ✅ CELLE-CI EST LEUR ROUTE. Le DTO `PartnerTransaction` est servi champ pour
 * champ (`docs/data-dictionary.md:427-435`) : `id`, `amount`, `entry_mode`,
 * `occurred_at`, `synced_at`, `customer_label`.
 *
 * `customer_label` vaut « K. A. », jamais le nom complet (:434) : un commerçant
 * n'a pas à connaître l'identité de ses clients.
 *
 * `occurred_at` est `scanned_at`, « ce que le commerçant reconnaît » (:432) —
 * pas `synced_at`, qui est l'arrivée au serveur. Les deux diffèrent dès qu'une
 * caisse resynchronise hors ligne, et le tri porte sur le premier.
 *
 * ⚠ DEUX POINTS OÙ NOUS AVONS CHOISI
 *
 * 1. L'ENVELOPPE. La route accepte un `cursor` (:427) mais sa réponse n'est pas
 *    annotée `Paginated<T>`, contrairement à `/me/transactions` (:392). NOTRE
 *    CHOIX : `Paginated<T>` — un curseur en entrée sans curseur en sortie ne se
 *    poursuit pas. Ambiguïté A7 de `front/docs/contrat-api.md`.
 *
 * 2. `status`, NOTRE AJOUT. `PartnerTransaction` ne porte aucun état, alors
 *    qu'un encaissement peut avoir été annulé par l'administration — une
 *    compensation (`corrections/mod.rs:1-3`). Un journal qui présenterait une
 *    ligne annulée comme un encaissement ordinaire mentirait au commerçant sur
 *    ce qu'il a réellement encaissé. Le champ est dérivé de `compensations`,
 *    comme `compensated_by` sur la route du registre d'administration.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite } from "@/mocks/curseur";
import { initialesDe, trouverPartenaire, trouverSalarie } from "@/mocks/magasin";
import { compensationDe, ecrituresDe, idCompte, registre, trouverOperation } from "@/mocks/registre";

export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const partenaireId = identite(requete, "X-Mock-Partenaire", "PRT-001");
  if (!trouverPartenaire(partenaireId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;
  const limite = lireLimite(parametres.get("limit"));
  if (limite === null) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre limit doit être un entier positif.");
  }

  const borne = (nom: string): string | undefined => {
    const valeur = parametres.get(nom);
    return valeur !== null && valeur.trim() !== "" ? valeur.trim() : undefined;
  };
  for (const nom of ["from", "to"]) {
    const valeur = borne(nom);
    if (valeur !== undefined && !Number.isFinite(Date.parse(valeur))) {
      return erreur(422, "VALIDATION_FAILED", `Le paramètre ${nom} doit être une date ISO 8601.`);
    }
  }
  const depuis = borne("from");
  const jusqua = borne("to");

  const compte = idCompte(partenaireId);

  /* Les CRÉDITS de nature `payment` sur son compte : un débit serait une
     annulation, et une annulation n'est pas un encaissement de plus. */
  const lignes = registre.ecritures
    .filter((e) => e.accountId === compte && e.direction === "credit")
    .map((ecriture) => ({ ecriture, operation: trouverOperation(ecriture.operationId) }))
    .filter(({ operation }) => operation?.kind === "payment")
    .filter(({ operation }) => {
      const quand = operation?.occurredAt ?? "";
      if (depuis !== undefined && quand < depuis) return false;
      if (jusqua !== undefined && quand > jusqua) return false;
      return true;
    })
    /* Le plus récent d'abord, sur `seq` : c'est l'ordre du journal, celui que
       la chaîne de hachage fige. Trier par date divergerait dès qu'une caisse
       resynchronise hors ligne. */
    .sort((a, b) => b.ecriture.seq - a.ecriture.seq);

  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    const repere = Number(curseur.valeurDeTri);
    const position = lignes.findIndex((l) => l.ecriture.seq < repere);
    debut = position === -1 ? lignes.length : position;
  }

  const page = lignes.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < lignes.length;

  return succes({
    items: page.map(({ ecriture, operation }) => {
      const compensation = operation === undefined ? undefined : compensationDe(operation.id);
      /* Le bénéficiaire, abrégé. On remonte au salarié par le débit jumeau de
         l'opération : la partie double garantit qu'il existe. */
      const debit = ecrituresDe(ecriture.operationId).find((e) => e.direction === "debit");
      const salarie =
        debit === undefined ? undefined : trouverSalarie(debit.accountId.replace(/^ACC-/, ""));
      const initiales =
        salarie === undefined
          ? "—"
          : initialesDe(salarie);

      return {
        id: ecriture.operationId,
        amount: euros(ecriture.amountCentimes),
        /* ⚠ Le mode d'entrée n'est pas porté par le journal : il vit dans
           `payments.entry_mode` (`0001_schema.sql:195`), que le magasin tient
           à part. On le lit là où il est, et `qr_scan` par défaut n'existe
           pas — un mode inconnu se dit. */
        entry_mode: modeDe(ecriture.operationId),
        occurred_at: operation?.occurredAt ?? ecriture.recordedAt,
        synced_at: ecriture.recordedAt,
        customer_label: initiales,
        /* NOTRE AJOUT. Voir l'en-tête. */
        status: compensation === undefined ? "settled" : "compensated",
        compensation_reason: compensation?.reason ?? null,
      };
    }),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({
            valeurDeTri: String(dernier.ecriture.seq),
            id: dernier.ecriture.operationId,
          })
        : null,
  });
}

/** Le mode d'entrée d'un règlement, lu dans `payments`. */
function modeDe(operationId: string): "qr_scan" | "short_code" {
  const paiement = paiementsDuMagasin().find((p) => p.id === operationId);
  return paiement?.modeSaisie ?? "short_code";
}

/* Importé paresseusement pour éviter un cycle : `magasin` importe `registre`. */
function paiementsDuMagasin(): { id: string; modeSaisie: "qr_scan" | "short_code" }[] {
  const portee = globalThis as typeof globalThis & {
    __carteproMagasin__?: { paiements?: { id: string; modeSaisie: "qr_scan" | "short_code" }[] };
  };
  return portee.__carteproMagasin__?.paiements ?? [];
}
