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

/*
 * Mocks actifs par defaut. Le depot seul, sans aucun fichier .env, doit
 * demarrer et tourner : c'est une exigence du cahier des charges. Seul un
 * NEXT_PUBLIC_USE_MOCKS=false explicite branche le front sur le backend.
 */
const utiliserMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/*
 * L'URL du backend n'est exigee que si on s'y branche vraiment. La rendre
 * obligatoire en mode mocks empecherait justement le demarrage sans
 * configuration.
 */
const apiUrl = utiliserMocks
  ? (process.env.NEXT_PUBLIC_API_URL ?? "")
  : requis("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL);

/*
 * Cible des appels HTTP. En mode mocks, c'est le serveur Next lui-meme :
 * les routes de src/app/api tiennent lieu de backend. Sinon, le backend.
 */
const baseApi = utiliserMocks ? "/api" : apiUrl;

export const env = {
  apiUrl,
  utiliserMocks,
  baseApi,
  qrTtlSecondes: Number(process.env.NEXT_PUBLIC_QR_TTL_SECONDS ?? 300),
  nomApplication: process.env.NEXT_PUBLIC_APP_NAME ?? "Ticket Tout",
} as const;
