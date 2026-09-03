const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const moisAnnee = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/**
 * Formate une date ISO 8601 pour l'affichage. Fuseau force a UTC : le back sert
 * de l'ISO 8601 UTC, laisser le fuseau local decider ferait diverger serveur et
 * navigateur (hydratation).
 */
export function formaterDate(iso: string): string {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) throw new Error(`Date illisible : ${iso}`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(instant);
}

/** Date + heure : "3 septembre 2026 à 14:05". */
export function formaterDateHeure(iso: string): string {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) throw new Error(`Date illisible : ${iso}`);
  return `${formaterDate(iso)} à ${heure.format(instant)}`;
}

/** Nombre de jours entiers ecoules depuis `iso`. Jamais negatif. */
export function joursEcoules(iso: string, maintenant = Date.now()): number {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) throw new Error(`Date illisible : ${iso}`);
  return Math.max(0, Math.floor((maintenant - instant) / MILLISECONDES_PAR_JOUR));
}

export function formaterAnciennete(jours: number): string {
  if (jours <= 0) return "deposee aujourd'hui";
  if (jours === 1) return "en attente depuis 1 jour";
  return `en attente depuis ${jours} jours`;
}

/** Clef "AAAA-MM" pour filtrer l'historique par mois. */
export function clefMois(iso: string): string { return iso.slice(0, 7); }

/** Libelle d'une clef "AAAA-MM" : "mars 2026". */
export function libelleMois(clef: string): string {
  return moisAnnee.format(new Date(`${clef}-01T00:00:00`));
}

/** Secondes restantes avant expiration d'un code de paiement (jamais negatif). */
export function secondesRestantes(expireLe: string): number {
  return Math.max(0, Math.round((new Date(expireLe).getTime() - Date.now()) / 1000));
}

/** "4:03" a partir d'un nombre de secondes. */
export function formaterMinutage(secondes: number): string {
  const m = Math.floor(secondes / 60);
  return `${m}:${String(secondes % 60).padStart(2, "0")}`;
}
