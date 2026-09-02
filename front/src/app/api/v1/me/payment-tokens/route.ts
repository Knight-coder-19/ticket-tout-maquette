/**
 * `POST /api/v1/me/payment-tokens` — emission d'un jeton par le salarie.
 *
 * Contrat : `docs/data-dictionary.md:401-410`. Logique : `authorize.rs:1-3` —
 * verrouiller le compte, verifier le statut et le **disponible**, poser la
 * reservation, tirer `jti` et `short_code`, inserer, signer, rendre
 * l'`IssuedToken` avec sa charge utile de QR.
 *
 * Le montant est fixe ICI, par le salarie. Le partenaire ne le saisira jamais.
 *
 * ⚠ STATUT HTTP NON SPECIFIE. `data-dictionary.md:401` n'annote pas cette
 * route, alors que ses voisines a `204` le sont explicitement (:412, :507).
 * `201 Created` est retenu — creation d'une ressource adressable par `jti` —
 * mais c'est un choix de notre part, pas une lecture du contrat. Ambiguite A3
 * de `front/docs/contrat-api.md`.
 */

import { centimesDepuisEuros, erreur, euros, identite, succes } from "@/mocks/enveloppe";
import {
  emettreJeton,
  formaterShortCode,
  libererJetonsExpires,
  trouverSalarie,
} from "@/mocks/magasin";
import { chargeUtileQr } from "@/mocks/qr";

/* L'etat vit en memoire : aucune reponse ne doit etre mise en cache. */
export const dynamic = "force-dynamic";

export async function POST(requete: Request): Promise<Response> {
  const maintenant = Date.now();
  libererJetonsExpires(maintenant);

  const employeeId = identite(requete, "X-Mock-Employe", "SAL-001");
  const salarie = trouverSalarie(employeeId);
  if (!salarie) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expiree.");
  }

  const donnees: unknown = await requete.json().catch(() => null);
  const montantBrut =
    typeof donnees === "object" && donnees !== null
      ? (donnees as { amount?: unknown }).amount
      : undefined;

  /* Le back refuse le negatif et la troisieme decimale avec un 422
     (`money.rs:44-47`, :71-73 ; data-dictionary.md:312). */
  const montantCentimes = centimesDepuisEuros(montantBrut);
  if (montantCentimes === null || montantCentimes <= 0) {
    return erreur(
      422,
      "VALIDATION_FAILED",
      "Le champ amount doit etre un montant en euros, strictement positif, a deux decimales au plus.",
    );
  }

  const resultat = emettreJeton(employeeId, montantCentimes, maintenant);
  if ("echec" in resultat) {
    switch (resultat.echec) {
      case "compte_inactif":
        return erreur(403, "ACCOUNT_INACTIVE", "Ce compte n'est pas actif.");
      case "solde_insuffisant":
        return erreur(422, "INSUFFICIENT_FUNDS", "Le solde disponible ne couvre pas ce montant.");
      case "montant_invalide":
        return erreur(422, "VALIDATION_FAILED", "Montant invalide.");
    }
  }

  const { jeton } = resultat;
  return succes(
    {
      jti: jeton.jti,
      short_code: formaterShortCode(jeton.shortCode),
      amount: euros(jeton.montantCentimes),
      issued_at: jeton.issuedAt,
      expires_at: jeton.expiresAt,
      qr_payload: chargeUtileQr(jeton),
    },
    201,
  );
}
