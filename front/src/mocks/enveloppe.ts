/**
 * L'enveloppe des réponses de simulation, telle que le back la décrit.
 *
 * Les routes sous `src/app/api/v1/` servent la forme du contrat publié, pas
 * celle que nos anciennes routes servaient. Concrètement :
 *
 *   - erreur plate `{ error, message, request_id }` — data-dictionary.md:324-328
 *     et `crates/api/src/error.rs:1` — et non `{ error: { code, message } }` ;
 *   - code d'erreur en SCREAMING_SNAKE, « stable à vie » — :21, :626 ;
 *   - `X-Request-Id` généré et renvoyé — `middleware/request_id.rs:1-3` ;
 *   - montants en **euros décimaux**, jamais en centimes.
 */

import { NextResponse } from "next/server";

/**
 * Convertit des centimes entiers en euros décimaux, pour la sérialisation.
 *
 * C'est ce que fait le back : `money.rs:145` sérialise
 * `serialize_f64(self.0 as f64 / SUBUNIT as f64)` avec `SUBUNIT = 100`
 * (`money.rs:13`). Le magasin, lui, ne connaît que des entiers de centimes —
 * la conversion n'a lieu qu'ici, au moment de répondre, exactement comme le
 * back ne convertit que dans `Money`.
 */
export function euros(centimes: number): number {
  return centimes / 100;
}

/**
 * Lit un montant en euros décimaux et rend des centimes entiers, ou `null`.
 *
 * Reproduit `Money::parse_euros` (`money.rs:50-88`) plutôt que de faire
 * `Math.round(x * 100)` : on passe par la chaîne, ce qui permet de **refuser**
 * plus de deux décimales — `InvalidMoneyError::TooManyDecimals`, `money.rs:71-73`
 * — au lieu de deviner ce que l'utilisateur voulait.
 *
 * `String(valeur)` en JavaScript, comme `f64::to_string()` en Rust, imprime la
 * plus courte chaîne décimale qui redonne le même flottant : le bruit binaire
 * est éliminé une fois, au bord, et le découpage donne ensuite des entiers
 * exacts.
 *
 * La désérialisation du back accepte un nombre **ou une chaîne**
 * (`money.rs:159-185`) : on fait pareil.
 */
export function centimesDepuisEuros(valeur: unknown): number | null {
  const texte =
    typeof valeur === "number" && Number.isFinite(valeur)
      ? String(valeur)
      : typeof valeur === "string"
        ? valeur.trim().replace(",", ".")
        : null;
  if (texte === null) return null;

  /* Refuse le négatif, l'exposant (`1e3`) et la troisième décimale. */
  if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null;

  const morceaux = texte.split(".");
  const entiers = morceaux[0] ?? "0";
  const decimales = (morceaux[1] ?? "").padEnd(2, "0");
  return Number(entiers) * 100 + Number(decimales);
}

/** Identifiant de requête, renvoyé dans l'en-tête et dans tout corps d'erreur. */
function nouvelIdentifiantRequete(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Réponse de succès, avec l'en-tête `X-Request-Id` du back. */
export function succes(corps: unknown, statut = 200): NextResponse {
  return NextResponse.json(corps, {
    status: statut,
    headers: { "X-Request-Id": nouvelIdentifiantRequete() },
  });
}

/** Réponse vide `204`, pour les routes que le contrat annote ainsi. */
export function sansContenu(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { "X-Request-Id": nouvelIdentifiantRequete() },
  });
}

/**
 * Erreur au format du back : `{ error, message, request_id }`.
 *
 * `error` porte le code SCREAMING_SNAKE de la table `data-dictionary.md:629-643`.
 * « Le front réagit sur `error`, jamais sur `message` » (:626).
 */
export function erreur(statut: number, code: string, message: string): NextResponse {
  const requestId = nouvelIdentifiantRequete();
  return NextResponse.json(
    { error: code, message, request_id: requestId },
    { status: statut, headers: { "X-Request-Id": requestId } },
  );
}

/**
 * Qui appelle, en l'absence de session.
 *
 * Le back déduit l'identité du cookie `session` (`extractors/auth.rs:1-3`,
 * `TASK-DISTRIBUTION-BACKEND.md:456`). Les mocks n'ont ni session ni cookie :
 * un en-tête tient lieu de substitut, avec un compte de démonstration par
 * défaut pour que les routes répondent sans configuration.
 *
 * ⚠ Substitut de simulation uniquement. Rien de tel n'existe dans le contrat.
 */
export function identite(requete: Request, entete: string, defaut: string): string {
  const valeur = requete.headers.get(entete);
  return valeur !== null && valeur.trim() !== "" ? valeur.trim() : defaut;
}
