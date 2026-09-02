/**
 * Le curseur de pagination, tel que le decrit `extractors/pagination.rs:1-3` :
 * curseur opaque base64 encapsulant (valeur_de_tri, id), limite plafonnee a
 * 100, keyset seulement, jamais d'OFFSET.
 *
 * Opaque veut dire opaque : le front ne le lit pas, il le renvoie tel quel.
 * Le format ci-dessous est donc un detail d'implementation des mocks, et le
 * back n'a aucune raison d'adopter le meme -- il n'est pas specifie.
 */

export const LIMITE_PAR_DEFAUT = 20;
export const LIMITE_MAXIMALE = 100;

export interface Curseur {
  valeurDeTri: string;
  id: string;
}

/**
 * Le separateur entre la valeur de tri et l'identifiant.
 *
 * ⚠ NE PAS remettre un espace. Une valeur de tri peut en contenir -- une
 * enseigne s'appelle « Chez Adjoa » -- et le decodage rendait alors
 * `valeurDeTri = "Chez"` et `id = "Adjoa"`. Le curseur pointait a cote, la
 * pagination repetait une ligne a chaque page et n'atteignait jamais la fin.
 *
 * U+0000 ne peut apparaitre ni dans un nom, ni dans un UUID, ni dans un
 * horodatage ISO 8601.
 */
const SEPARATEUR = "\u0000";

/**
 * Encode en base64url, en passant par UTF-8.
 *
 * `btoa` seul leve sur tout caractere au-dela de U+00FF : il attend des
 * octets, pas du texte. On encode donc d'abord en UTF-8, ce qui rend le
 * curseur sur pour n'importe quel nom d'etablissement.
 */
export function encoderCurseur(curseur: Curseur): string {
  const octets = new TextEncoder().encode(
    `${curseur.valeurDeTri}${SEPARATEUR}${curseur.id}`,
  );
  let binaire = "";
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Rend `null` sur un curseur qu'on ne sait pas lire : a l'appelant de refuser. */
export function decoderCurseur(brut: string): Curseur | null {
  try {
    const complete = brut.replace(/-/g, "+").replace(/_/g, "/");
    const binaire = atob(complete);
    const octets = Uint8Array.from(binaire, (c) => c.charCodeAt(0));
    const texte = new TextDecoder("utf-8", { fatal: true }).decode(octets);

    /* On coupe au PREMIER separateur : la valeur de tri peut tout contenir,
       l'identifiant non. */
    const coupure = texte.indexOf(SEPARATEUR);
    if (coupure === -1) return null;
    const valeurDeTri = texte.slice(0, coupure);
    const id = texte.slice(coupure + SEPARATEUR.length);
    if (id === "") return null;
    return { valeurDeTri, id };
  } catch {
    return null;
  }
}

/** Plafonne la limite demandee. `null` si la valeur n'est pas lisible. */
export function lireLimite(brut: string | null): number | null {
  if (brut === null) return LIMITE_PAR_DEFAUT;
  const valeur = Number(brut);
  if (!Number.isInteger(valeur) || valeur < 1) return null;
  return Math.min(valeur, LIMITE_MAXIMALE);
}
