/**
 * `GET /api/v1/partner/payment-tokens/{reference}` — resolution d'un jeton,
 * sans le consommer.
 *
 * /** DEMANDÉE À L'ÉQUIPE BACK, non encore spécifiée. Forme provisoire. *​/
 *
 * Rien de tout cela n'existe dans le contrat : ni `docs/data-dictionary.md` §4.5,
 * ni `crates/api/src/routes/partner.rs:1-3` n'exposent une lecture de jeton.
 * Le chemin, le nom des champs et le statut sont donc de NOTRE fait, et
 * changeront quand le back tranchera. C'est la divergence D6 de
 * `front/docs/contrat-api.md`.
 *
 * Pourquoi nous la demandons : sans elle, un caissier qui saisit le code court
 * a la main regle a l'aveugle. Il ne voit ni le montant reserve, ni le
 * beneficiaire, ni l'echeance — il appuie sur « Encaisser » et decouvre apres
 * coup ce qu'il vient de prendre. Le modele du back rend cette lecture
 * indispensable, precisement parce que le montant ne vient plus de la caisse.
 *
 * Lire ne consomme pas : c'est le reglement qui consomme (`settle.rs:1-3`).
 */

import { erreur, euros, succes } from "@/mocks/enveloppe";
import {
  formaterShortCode,
  libererJetonsExpires,
  trouverJetonParReference,
  trouverSalarie,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

interface ParametresRoute {
  params: Promise<{ reference: string }>;
}

export async function GET(
  _requete: Request,
  { params }: ParametresRoute,
): Promise<Response> {
  const maintenant = Date.now();
  libererJetonsExpires(maintenant);

  const { reference } = await params;
  const jeton = trouverJetonParReference(decodeURIComponent(reference));
  if (!jeton) {
    return erreur(404, "TOKEN_NOT_FOUND", "Ce code est introuvable.");
  }

  /* L'ordre des refus suit celui de la table des erreurs : deja consomme
     (409) avant perime (410), parce qu'un jeton consomme puis expire reste
     avant tout un jeton deja encaisse. */
  if (jeton.statut === "consumed") {
    return erreur(409, "TOKEN_ALREADY_USED", "Ce code a deja ete encaisse.");
  }
  if (jeton.statut === "expired" || jeton.statut === "cancelled") {
    return erreur(410, "TOKEN_EXPIRED", "Ce code a expire.");
  }

  const salarie = trouverSalarie(jeton.employeeId);
  if (!salarie) {
    return erreur(404, "TOKEN_NOT_FOUND", "Ce code est introuvable.");
  }

  /*
   * Le champ `customer_label` suit la regle du contrat : « K. A. », jamais le
   * nom complet (data-dictionary.md:434). Le partenaire n'a pas a connaitre
   * l'identite du salarie, meme au comptoir.
   */
  const initiales = salarie.nom
    .split(/\s+/)
    .map((mot) => `${mot.charAt(0).toUpperCase()}.`)
    .join(" ");

  return succes({
    jti: jeton.jti,
    short_code: formaterShortCode(jeton.shortCode),
    amount: euros(jeton.montantCentimes),
    customer_label: initiales,
    expires_at: jeton.expiresAt,
  });
}
