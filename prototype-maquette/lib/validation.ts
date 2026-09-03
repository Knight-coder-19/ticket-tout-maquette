// Contrôles de forme côté client. Le mail Pontaillac demande que le SIREN et
// l'e-mail soient « contrôlés au moins dans leur forme » à l'inscription.

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** SIREN = 9 chiffres, clé de Luhn valide. */
export function isValidSiren(value: string): boolean {
  const digits = value.replace(/\s/g, "");
  if (!/^\d{9}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(digits[i]);
    // Position paire en partant de la droite → on double.
    if ((9 - i) % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function isValidFrPhone(value: string): boolean {
  const digits = value.replace(/[\s.\-]/g, "");
  return /^(?:\+33|0)\d{9}$/.test(digits);
}
