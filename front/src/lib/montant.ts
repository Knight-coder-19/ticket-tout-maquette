import type { MontantCentimes } from "@/types/encaissement";

/**
 * Lit une saisie de caisse et rend des centimes entiers, ou `null` si la
 * saisie n'est pas un montant.
 *
 * On travaille sur la chaîne, pas sur `parseFloat(x) * 100` : la
 * multiplication par cent d'un flottant introduit exactement l'erreur qu'on
 * cherche à éviter. Ici « 12,50 » devient 1250 par découpage, sans jamais
 * passer par une valeur décimale.
 */
export function centimesDepuisSaisie(saisie: string): MontantCentimes | null {
  const texte = saisie.trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(texte)) return null;

  const morceaux = texte.split(".");
  const entiers = morceaux[0] ?? "0";
  const decimales = (morceaux[1] ?? "").padEnd(2, "0");
  const centimes = Number(entiers) * 100 + Number(decimales);

  return centimes > 0 ? centimes : null;
}

const EUROS = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

/** Affiche des centimes en euros : 1250 → « 12,50 € ». */
export function formaterCentimes(centimes: MontantCentimes): string {
  return EUROS.format(centimes / 100);
}

/** Reste à courir avant une échéance, en secondes, jamais négatif. */
export function secondesRestantes(echeance: number, maintenant = Date.now()): number {
  return Math.max(0, Math.ceil((echeance - maintenant) / 1000));
}

/** 137 → « 2:17 ». */
export function formaterDuree(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
