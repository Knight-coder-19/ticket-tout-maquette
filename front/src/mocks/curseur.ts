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

export function encoderCurseur(curseur: Curseur): string {
  return btoa(`${curseur.valeurDeTri} ${curseur.id}`)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Rend `null` sur un curseur qu'on ne sait pas lire : a l'appelant de refuser. */
export function decoderCurseur(brut: string): Curseur | null {
  try {
    const complete = brut.replace(/-/g, "+").replace(/_/g, "/");
    const [valeurDeTri, id] = atob(complete).split(" ");
    if (valeurDeTri === undefined || id === undefined) return null;
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
