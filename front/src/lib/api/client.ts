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
export async function appelApi<T>(
  chemin: string,
  options: RequestInit = {},
): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`${env.baseApi}${chemin}`, options);
  } catch {
    /* Le réseau a lâché. On ne sait pas si le serveur a écrit ou non : c'est
       précisément pourquoi la clé d'idempotence existe, et pourquoi elle ne
       doit pas changer si le caissier réessaie. */
    throw new ErreurService("reseau", "Le service est injoignable.");
  }

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
    /* La lecture des deux formes d'erreur du back vit dans les adaptateurs, et
       n'est pas réécrite ici. `depuisErreur` accepte `undefined` : un corps
       illisible donne alors le code « inconnu » et le message par défaut. */
    throw depuisErreur(corpsLisible ? corps : undefined, reponse.status);
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
