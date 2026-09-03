/**
 * `GET /api/v1/me/transactions?cursor=&limit=` — le relevé du salarié.
 *
 * Contrat : `docs/data-dictionary.md:382-392`, enveloppe `Paginated<T>` (:392).
 *
 * Source des lignes : le registre (`mocks/registre.ts`), pas un tableau à
 * part — le même journal qui sert `/partner/transactions` et
 * `/admin/ledger-entries`. Tri sur `seq` décroissant, comme partout ailleurs
 * dans le registre : c'est l'ordre d'écriture, celui que la chaîne de
 * hachage fige, et le seul qui reste stable en présence d'une
 * resynchronisation hors ligne dont `occurred_at` retarderait sur `seq`.
 *
 * `direction` vient de l'écriture posée sur le compte du salarié lui-même
 * (`credit` = un rechargement, `direction: "in"` ; `debit` = un paiement,
 * `direction: "out"`) — jamais de son montant, dont le signe ne dit rien
 * côté registre (toutes les écritures sont positives, partie double oblige).
 *
 * `counterparty` relit la seconde écriture de l'opération pour nommer l'autre
 * compte : l'enseigne d'un partenaire pour un paiement, la raison sociale de
 * l'employeur pour un rechargement — exactement ce que
 * `data-dictionary.md:388` demande.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite } from "@/mocks/curseur";
import {
  libererJetonsExpires,
  trouverEmployeur,
  trouverPartenaire,
  trouverSalarie,
} from "@/mocks/magasin";
import { ecrituresDe, idCompte, lireEcritures, trouverOperation } from "@/mocks/registre";

export const dynamic = "force-dynamic";

function libelleContrepartie(operationId: string, comptePropre: string): string {
  const autre = ecrituresDe(operationId).find((e) => e.accountId !== comptePropre);
  if (!autre) return "Ticket Tout";

  const proprietaireId = autre.accountId.replace(/^ACC-/, "");
  return (
    trouverPartenaire(proprietaireId)?.tradeName ??
    trouverEmployeur(proprietaireId)?.legalName ??
    "Ticket Tout"
  );
}

export async function GET(requete: Request): Promise<Response> {
  const maintenant = Date.now();
  libererJetonsExpires(maintenant);

  const employeeId = identite(requete, "X-Mock-Employe", "SAL-001");
  if (!trouverSalarie(employeeId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;
  const limite = lireLimite(parametres.get("limit"));
  if (limite === null) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre limit doit être un entier positif.");
  }

  const comptePropre = idCompte(employeeId);
  const ecritures = lireEcritures({ titulaireId: employeeId });

  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    /* Curseur = le `seq` de la dernière ligne rendue. Tri décroissant, donc
       on reprend à la première écriture de rang STRICTEMENT inférieur. */
    const dernierSeq = Number(curseur.valeurDeTri);
    const position = ecritures.findIndex((e) => e.seq < dernierSeq);
    debut = position === -1 ? ecritures.length : position;
  }

  const page = ecritures.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < ecritures.length;

  const items = page.map((ecriture) => {
    const operation = trouverOperation(ecriture.operationId);
    /* `lireEcritures` filtre déjà les écritures orphelines : `operation` existe. */
    return {
      id: ecriture.operationId,
      kind: operation?.kind ?? "payment",
      amount: euros(ecriture.amountCentimes),
      direction: ecriture.direction === "credit" ? "in" : "out",
      counterparty: libelleContrepartie(ecriture.operationId, comptePropre),
      occurred_at: operation?.occurredAt ?? ecriture.recordedAt,
      reference: operation?.memo ?? null,
    };
  });

  return succes({
    items,
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({ valeurDeTri: String(dernier.seq), id: dernier.operationId })
        : null,
  });
}
