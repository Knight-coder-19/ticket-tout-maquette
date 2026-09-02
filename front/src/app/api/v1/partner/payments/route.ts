/**
 * `POST /api/v1/partner/payments` — reglement par le partenaire.
 *
 * Contrat : `docs/data-dictionary.md:437-451`. Logique : `settle.rs:1-3`, dans
 * l'ordre impose — idempotence, verrous, controles, ecriture.
 *
 * Le corps ne porte AUCUN montant, et c'est le coeur du modele : le montant a
 * ete fixe a l'emission par le salarie, et les fonds sont deja reserves. Le
 * partenaire ne fait que presenter une reference.
 *
 * ─── L'idempotence n'est pas celle que le front envoie aujourd'hui ───
 *
 * Le back ne connait aucune cle d'idempotence fournie par le client : ni
 * `SettleRequest` (:438-441), ni `settle.rs`, ni la table `payments`
 * (`migrations/0001_schema.sql:190-197`) n'en portent une. Sa regle est
 * ailleurs, et elle est plus forte : `payments.token_jti` est UNIQUE
 * (invariant I6, `data-model.md:114-121`), donc
 *
 *   - le MEME partenaire qui rejoue le MEME `jti` recoit `200` avec la
 *     transaction deja ecrite — un succes, pas un conflit (:645) ;
 *   - un AUTRE partenaire sur un jeton deja consomme recoit
 *     `409 TOKEN_ALREADY_USED`.
 *
 * Le jeton EST la cle. C'est ce qui est implemente ici. Le champ
 * `idempotencyKey` que `encaissement.service.ts` envoie n'a pas de
 * destinataire dans ce contrat — divergence D12 de `front/docs/contrat-api.md`.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import {
  libererJetonsExpires,
  reglerJeton,
  trouverJetonParCode,
  trouverJetonParJti,
  trouverPaiementParJti,
  trouverPartenaire,
  type ModeSaisie,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

type CorpsReglement = {
  jti: string | null;
  shortCode: string | null;
  scannedAt: string;
};

/** Rien de ce qui arrive par le reseau n'est suppose bien forme. */
function lireCorps(donnees: unknown): CorpsReglement | null {
  if (typeof donnees !== "object" || donnees === null) return null;
  const brut = donnees as { jti?: unknown; short_code?: unknown; scanned_at?: unknown };

  const chaine = (valeur: unknown): string | null =>
    typeof valeur === "string" && valeur.trim() !== "" ? valeur.trim() : null;

  const jti = chaine(brut.jti);
  const shortCode = chaine(brut.short_code);
  const scannedAt = chaine(brut.scanned_at);

  /* « Exactement un des deux » (:440). Ni zero, ni les deux. */
  if ((jti === null) === (shortCode === null)) return null;
  if (scannedAt === null || !Number.isFinite(Date.parse(scannedAt))) return null;

  return { jti, shortCode, scannedAt };
}

export async function POST(requete: Request): Promise<Response> {
  const maintenant = Date.now();
  libererJetonsExpires(maintenant);

  const partenaireId = identite(requete, "X-Mock-Partenaire", "PRT-001");
  const partenaire = trouverPartenaire(partenaireId);
  if (!partenaire) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expiree.");
  }
  if (partenaire.statut !== "valide") {
    return erreur(403, "PARTNER_NOT_APPROVED", "Cet etablissement n'est pas agree.");
  }

  const corps = lireCorps(await requete.json().catch(() => null));
  if (!corps) {
    return erreur(
      422,
      "VALIDATION_FAILED",
      "Renseigner exactement un de jti ou short_code, plus scanned_at au format ISO 8601.",
    );
  }

  const modeSaisie: ModeSaisie = corps.jti !== null ? "qr_scan" : "short_code";

  /*
   * 1. IDEMPOTENCE — avant tout le reste (`settle.rs:1`,
   *    `TASK-DISTRIBUTION-BACKEND.md:302`). Le rejeu se reconnait sur le `jti`,
   *    donc il ne peut se detecter que pour un scan : une reference par code
   *    court ne retrouve que les jetons actifs, et un jeton deja consomme n'en
   *    est plus un. C'est coherent — apres un premier reglement, le code court
   *    n'identifie plus rien.
   */
  if (corps.jti !== null) {
    const dejaEcrit = trouverPaiementParJti(corps.jti);
    if (dejaEcrit) {
      if (dejaEcrit.partenaireId !== partenaireId) {
        return erreur(409, "TOKEN_ALREADY_USED", "Ce code a ete encaisse par un autre etablissement.");
      }
      /* Meme partenaire, meme jeton : on rend la transaction deja ecrite.
         Un succes, pas un conflit (:645). Aucun second debit. */
      return succes({
        id: dejaEcrit.id,
        jti: dejaEcrit.jti,
        amount: euros(dejaEcrit.montantCentimes),
        entry_mode: dejaEcrit.modeSaisie,
        occurred_at: dejaEcrit.occurredAt,
        synced_at: dejaEcrit.syncedAt,
        status: "settled",
      });
    }
  }

  /* 2. VERROUS et 3. CONTROLES. */
  const jeton =
    corps.jti !== null
      ? trouverJetonParJti(corps.jti)
      : trouverJetonParCode(corps.shortCode ?? "");

  if (!jeton) {
    return erreur(404, "TOKEN_NOT_FOUND", "Ce code est introuvable.");
  }
  if (jeton.statut === "consumed") {
    return erreur(409, "TOKEN_ALREADY_USED", "Ce code a deja ete encaisse.");
  }
  if (jeton.statut !== "active") {
    /* `expired` et `cancelled` : dans les deux cas le jeton ne vaut plus rien
       et les fonds sont deja retournes au disponible. */
    return erreur(410, "TOKEN_EXPIRED", "Ce code a expire.");
  }

  /* 4. ECRITURE. `libererJetonsExpires` a deja fait passer a `expired` tout
     jeton dont l'echeance etait atteinte : un jeton encore `active` ici est
     valide contre l'horloge du serveur, la seule qui fasse foi (decision 2,
     invariant I7). */
  const paiement = reglerJeton(jeton, partenaireId, modeSaisie, corps.scannedAt, maintenant);

  return succes({
    id: paiement.id,
    jti: paiement.jti,
    amount: euros(paiement.montantCentimes),
    entry_mode: paiement.modeSaisie,
    occurred_at: paiement.occurredAt,
    synced_at: paiement.syncedAt,
    status: "settled",
  });
}
