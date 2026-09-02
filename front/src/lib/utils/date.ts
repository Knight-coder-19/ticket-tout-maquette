const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

/**
 * Formate une date ISO 8601 pour l'affichage.
 *
 * Le fuseau est force a UTC, et ce n'est pas un detail : le back sert de
 * l'ISO 8601 UTC (`data-dictionary.md:18`), et laisser le fuseau local decider
 * ferait rendre au serveur et au navigateur deux chaines differentes pour la
 * meme donnee -- une divergence d'hydratation, qui casse en silence.
 */
export function formaterDate(iso: string): string {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) {
    throw new Error(`Date illisible : ${iso}`);
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(instant);
}

/** Nombre de jours entiers ecoules depuis `iso`. Jamais negatif. */
export function joursEcoules(iso: string, maintenant = Date.now()): number {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) {
    throw new Error(`Date illisible : ${iso}`);
  }
  return Math.max(0, Math.floor((maintenant - instant) / MILLISECONDES_PAR_JOUR));
}

/**
 * Dit depuis combien de temps une demande attend.
 *
 * La formule est au singulier ou au pluriel selon le compte, et « aujourd'hui »
 * plutot que « 0 jour » : l'agent lit une phrase, pas un compteur.
 */
export function formaterAnciennete(jours: number): string {
  if (jours <= 0) return "deposee aujourd'hui";
  if (jours === 1) return "en attente depuis 1 jour";
  return `en attente depuis ${jours} jours`;
}

/** Secondes restantes avant expiration d'un code de paiement. */
export function secondesRestantes(expireLe: string): number {
  throw new Error("Non implemente");
}
