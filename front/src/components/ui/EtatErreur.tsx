/**
 * Une erreur dit ce qui s'est passe et comment le corriger.
 * Cas a couvrir explicitement : solde insuffisant, code expire,
 * backend injoignable.
 */
export function EtatErreur({ message }: { message: string }) {
  throw new Error("Non implemente");
}
