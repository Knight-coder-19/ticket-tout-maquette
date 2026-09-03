/**
 * Lecture unique des variables d'environnement.
 * Aucun process.env ailleurs dans le projet : une variable manquante
 * doit echouer ici, au demarrage, et pas au milieu d'un ecran.
 */

function requis(nom: string, valeur: string | undefined): string {
  if (!valeur) {
    throw new Error(`Variable d'environnement manquante : ${nom}`);
  }
  return valeur;
}

export const env = {
  apiUrl: requis("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL),
  utiliserMocks: process.env.NEXT_PUBLIC_USE_MOCKS === "true",
  qrTtlSecondes: Number(process.env.NEXT_PUBLIC_QR_TTL_SECONDS ?? 300),
  nomApplication: process.env.NEXT_PUBLIC_APP_NAME ?? "Ticket Tout",
} as const;
