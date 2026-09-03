/**
 * Client HTTP unique.
 *
 * C'est le SEUL endroit du front qui appelle `fetch`. Un composant appelle un
 * service, le service appelle ce client, le client appelle le réseau
 * (`front/docs/ARCHITECTURE.md`, règle 1). Conséquence pratique : brancher le
 * backend, changer d'URL ou ajouter un en-tête d'authentification se fait à un
 * seul endroit — celui-ci.
 *
 * Trois garanties, dans cet ordre :
 *
 *   1. un échec de transport devient `ErreurService` de code `"reseau"` ;
 *   2. une réponse non-ok devient l'erreur que `depuisErreur()` sait lire, dans
 *      l'une OU l'autre des deux formes que le back n'a pas tranchées ;
 *   3. un échec ne rend JAMAIS un objet vide que l'appelant confondrait avec
 *      une réponse — il lève, toujours. C'est exactement le trou qu'un test de
 *      la maquette avait attrapé.
 */

import { env } from "@/lib/config/env";
import { depuisErreur } from "@/lib/api/adaptateurs";
import { ErreurService } from "@/types/erreurs";

/**
 * Appelle l'API et rend le corps décodé.
 *
 * `chemin` est relatif à la base : `/payment-tokens/ABC`, pas une URL entière.
 * La base vient d'`env.baseApi` — les routes locales sous `/api` en mode mocks,
 * le backend sinon — et `env.ts` reste le seul lecteur de `process.env`.
 *
 * ⚠ Une réponse sans corps JSON est traitée comme illisible, y compris quand
 * elle est `ok`. C'est volontaire tant qu'aucune route appelée ne répond `204` :
 * le contrat du back en prévoit plusieurs (`/auth/logout`, les `DELETE`), et
 * elles auront besoin d'une variante explicite le jour où le front les
 * appellera. Rendre `undefined` en silence serait précisément le « objet vide
 * sur un échec » qu'on refuse.
 */
/**
 * Le seul `fetch` du front. Tout échec de transport devient `"reseau"`.
 *
 * ⚠ `credentials: "include"` est fixé ici, pas laissé au choix de l'appelant.
 * Le jeton de session est un cookie httpOnly (`data-dictionary.md:364`), et le
 * back annonce une politique CORS « one origin with credentials »
 * (`security_headers.rs:2-3`) : sans ce réglage, le navigateur retiendrait le
 * cookie hors du même-origine, et toute route authentifiée verrait une
 * session absente dès que `NEXT_PUBLIC_API_URL` pointera un backend sur un
 * port ou un domaine distinct de celui du front. En mode mocks, l'appel est
 * déjà même-origine (`env.baseApi = "/api"`) : ce réglage n'y change rien.
 */
async function joindre(chemin: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(`${env.baseApi}${chemin}`, { ...options, credentials: "include" });
  } catch {
    /* Le réseau a lâché. On ne sait pas si le serveur a écrit ou non : c'est
       précisément pourquoi la clé d'idempotence existe, et pourquoi elle ne
       doit pas changer si le caissier réessaie. */
    throw new ErreurService("reseau", "Le service est injoignable.");
  }
}

/**
 * Construit l'erreur d'une réponse non-ok.
 *
 * La lecture des deux formes d'erreur du back vit dans les adaptateurs, et
 * n'est pas réécrite ici. `depuisErreur` accepte `undefined` : un corps
 * illisible donne alors le code « inconnu » et le message par défaut.
 */
async function erreurDe(reponse: Response): Promise<ErreurService> {
  try {
    return depuisErreur(await reponse.json(), reponse.status);
  } catch {
    return depuisErreur(undefined, reponse.status);
  }
}

export async function appelApi<T>(
  chemin: string,
  options: RequestInit = {},
): Promise<T> {
  const reponse = await joindre(chemin, options);

  let corps: unknown;
  let corpsLisible = true;
  try {
    corps = await reponse.json();
  } catch {
    /* Corps absent, tronqué, ou du HTML servi par un proxy. On ne perd pas la
       réponse pour autant : le statut suffit à construire une erreur utile. */
    corpsLisible = false;
  }

  if (!reponse.ok) {
    throw corpsLisible
      ? depuisErreur(corps, reponse.status)
      : depuisErreur(undefined, reponse.status);
  }

  if (!corpsLisible) {
    throw new ErreurService(
      "reponse_illisible",
      `Réponse du serveur illisible : le corps de la réponse ${reponse.status} n'est pas du JSON.`,
      { statut: reponse.status },
    );
  }

  /*
   * L'unique assertion du fichier, et elle est inhérente à la signature : `T`
   * est ce que l'APPELANT déclare attendre, pas ce que le serveur a promis.
   * Rien n'est vérifié ici, et rien ne doit l'être — la vérification a lieu
   * juste après, dans les adaptateurs, qui lèvent sur un champ illisible.
   *
   * À ne pas confondre avec une assertion qui masquerait une union fermée :
   * celle-ci ne cache aucune vérification, elle en délègue une.
   */
  return corps as T;
}

/**
 * Appelle une route qui ne rend PAS de corps, et ne rend rien.
 *
 * C'est la variante que le commentaire d'`appelApi` annonçait. Le contrat en
 * prévoit plusieurs : `POST /auth/logout` (`data-dictionary.md:368`),
 * `DELETE /me/payment-tokens/{jti}` (:412),
 * `POST /admin/partners/{id}/approve` (:507), et toutes les routes annotées
 * `→ 204`.
 *
 * `appelApi` traite un corps vide comme illisible — délibérément, pour ne
 * jamais rendre un objet vide qu'on confondrait avec une réponse. Ici c'est
 * l'inverse : l'absence de corps est le succès attendu, et il n'y a rien à
 * désérialiser, donc rien à faire traverser. Le type de retour est `void` :
 * aucun `as`, aucune valeur inventée.
 *
 * Le corps d'une réponse en ÉCHEC reste lu : c'est là que le code d'erreur se
 * trouve.
 */
export async function appelApiSansContenu(
  chemin: string,
  options: RequestInit = {},
): Promise<void> {
  const reponse = await joindre(chemin, options);
  if (!reponse.ok) {
    throw await erreurDe(reponse);
  }
  /* Succès : on ne lit pas le corps. Un serveur qui en renverrait un malgré
     tout ne serait pas en faute — c'est l'appelant qui a dit n'en attendre
     aucun. */
}
