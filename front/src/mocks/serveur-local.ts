/**
 * Serveur local de la maquette statique.
 *
 * La maquette (GitHub Pages) n'a aucun backend et, en export statique, aucun
 * route handler Next : les fichiers de `src/mocks/api/` ne sont plus servis par
 * le serveur. Ce module rejoue exactement ces mêmes handlers **dans le
 * navigateur**. Ils sont purs (une `Request` entre, une `Response` sort, tout
 * l'état vit en mémoire dans `@/mocks/magasin`) : les appeler ici donne le même
 * comportement que `next dev`, y compris les `POST` du flux de paiement.
 *
 * Branché à un seul endroit : `lib/api/client.ts`, quand `env.modeMaquette`.
 */

import { routesLocales } from "@/mocks/serveur-local.routes";

const ORIGINE = "http://maquette.local";

/**
 * Résout un appel `${env.baseApi}${chemin}` (ex. `/api/v1/me/balance?limit=20`)
 * contre la table des routes et rend la `Response` du handler correspondant.
 */
export async function repondreLocalement(
  chemin: string,
  options: RequestInit,
): Promise<Response> {
  const url = new URL(chemin.startsWith("/") ? chemin : `/${chemin}`, ORIGINE);
  const methode = (options.method ?? "GET").toUpperCase();

  for (const route of routesLocales) {
    const m = route.motif.exec(url.pathname);
    if (!m) continue;

    const handler = route.handlers[methode];
    if (!handler) {
      return reponseErreur(405, "METHOD_NOT_ALLOWED", `Méthode ${methode} non gérée par la maquette.`);
    }

    const params: Record<string, string> = {};
    route.params.forEach((nom, i) => {
      params[nom] = decodeURIComponent(m[i + 1] ?? "");
    });

    const requete = new Request(url.toString(), {
      method: methode,
      headers: options.headers,
      body: options.body ?? null,
    });

    try {
      return await handler(requete, { params: Promise.resolve(params) });
    } catch (cause) {
      console.error("[maquette] handler en échec", url.pathname, cause);
      return reponseErreur(500, "INTERNAL", "La maquette a rencontré une erreur interne.");
    }
  }

  return reponseErreur(404, "NOT_FOUND", `Route inconnue de la maquette : ${methode} ${url.pathname}`);
}

function reponseErreur(statut: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message, request_id: "maquette" }), {
    status: statut,
    headers: { "content-type": "application/json" },
  });
}
