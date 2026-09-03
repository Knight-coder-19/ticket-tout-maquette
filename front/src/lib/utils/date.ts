const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

const moisAnnee = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

export function formaterDate(iso: string): string {
  return dateLongue.format(new Date(iso));
}

export function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${dateLongue.format(d)} à ${heure.format(d)}`;
}

/** Clef "AAAA-MM" utilisee pour filtrer l'historique par mois. */
export function clefMois(iso: string): string {
  return iso.slice(0, 7);
}

/** Libelle affichable d'une clef "AAAA-MM" : "mars 2026". */
export function libelleMois(clef: string): string {
  return moisAnnee.format(new Date(`${clef}-01T00:00:00`));
}

/** Secondes restantes avant expiration d'un code de paiement (jamais negatif). */
export function secondesRestantes(expireLe: string): number {
  const delta = new Date(expireLe).getTime() - Date.now();
  return Math.max(0, Math.round(delta / 1000));
}

/** "4:03" a partir d'un nombre de secondes. */
export function formaterMinutage(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
