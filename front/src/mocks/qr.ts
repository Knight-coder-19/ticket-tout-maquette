/**
 * La charge utile du QR, telle que la decrit `docs/data-dictionary.md:601-619`.
 *
 * Format, repris tel quel :
 *
 *     CP1.<base64url(payload_json)>.<base64url(signature)>
 *
 * `payload_json` : `{ "jti": "…", "amt": 2500, "exp": "…", "iss": "cartepro" }`
 * (:612).
 */

import type { JetonMagasin } from "@/mocks/magasin";

function base64url(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  let binaire = "";
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * ⚠ SIGNATURE SIMULEE — ce n'est PAS de l'Ed25519.
 *
 * Le contrat impose une signature asymetrique : le serveur signe avec sa cle
 * privee, l'application partenaire embarque la cle publique et verifie hors
 * ligne (:615-617). Les mocks n'ont pas de cle privee, et en fabriquer une
 * donnerait l'illusion d'une verification qui n'existe pas.
 *
 * On produit donc un troisieme segment bien forme mais explicitement faux, de
 * sorte qu'un verificateur reel le rejette au lieu de l'accepter par accident.
 */
const SIGNATURE_SIMULEE = base64url("signature-simulee-sans-valeur");

/**
 * ⚠ UNITE DE `amt` INDETERMINEE — le point le plus douteux de ce fichier.
 *
 * L'exemple du contrat donne `"amt": 2500`, qui se lit spontanement « 2500
 * centimes = 25,00 € » (:612). Mais l'amendement A5 (`docs/decisions.md:62-71`)
 * impose les euros decimaux sur le fil, auquel cas `2500` vaut 2500 €. La
 * section 5 n'a pas ete relue apres A5, et rien dans le Rust ne tranche :
 * `crypto/token_sig.rs:1-3` ne decrit pas la charge utile.
 *
 * Retenu ici : **des centimes entiers**, parce que c'est la seule forme
 * ecrite de cette structure et que la valeur de l'exemple ne se lit
 * raisonnablement que comme des centimes. Un facteur cent separe les deux
 * lectures — a confirmer avec l'equipe back avant que quoi que ce soit decode
 * ce champ. Ambiguite A1 de `front/docs/contrat-api.md`.
 *
 * Noter que le reste de la reponse, lui, sert bien des euros decimaux : c'est
 * `amount` de l'`IssuedToken` qui fait foi pour le front.
 */
export function chargeUtileQr(jeton: JetonMagasin): string {
  const charge = {
    jti: jeton.jti,
    amt: jeton.montantCentimes,
    exp: jeton.expiresAt,
    iss: "cartepro",
  };
  return `CP1.${base64url(JSON.stringify(charge))}.${SIGNATURE_SIMULEE}`;
}
