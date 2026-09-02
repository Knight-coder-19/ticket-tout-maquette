/**
 * L'erreur unique de la frontière.
 *
 * Il y en avait trois : `ErreurReseau` portait le statut HTTP, `ErreurAdaptation`
 * le champ illisible, `ErreurEncaissement` le code métier. Trois classes pour
 * trois moments du même trajet, et un `catch` qui devait toutes les connaître
 * pour ne rien laisser passer.
 *
 * Il n'en reste qu'une. Ce que les deux autres portaient est devenu un code —
 * `"reseau"` pour l'échec de transport, `"reponse_illisible"` pour une réponse
 * qu'on ne sait pas lire — et les champs qu'elles avaient en propre sont
 * devenus facultatifs. Un écran attrape `ErreurService`, lit `code`, et sait
 * quoi faire.
 */

type CodeConnu =
  | "unknown_token" | "token_used" | "token_expired"
  | "insufficient_funds" | "account_inactive" | "partner_inactive"
  | "invalid_amount" | "reseau" | "reponse_illisible" | "inconnu";

/**
 * Les codes que le front sait traiter, plus tout code que le back inventerait
 * sans nous prévenir.
 *
 * Le `& {}` n'est pas décoratif : sans lui, TypeScript effondre
 * `CodeConnu | string` en `string`, et l'autocomplétion ne propose plus rien.
 * Avec lui, l'union survit — les dix codes connus restent suggérés à la frappe,
 * et une chaîne inconnue passe sans assertion.
 *
 * C'est ce qui permet à `depuisErreur()` de conserver un code qu'il ne connaît
 * pas au lieu de l'écraser en « inconnu » : un code que le front ignore encore
 * est précisément celui qu'on veut lire dans un rapport de bug.
 */
export type CodeErreur = CodeConnu | (string & {});

/**
 * Ce que lève tout ce qui touche au réseau.
 *
 * On ne jette pas une `Error` nue : le `code` porte la décision que l'écran
 * doit prendre. Un jeton expiré se redemande au client ; un solde insuffisant
 * se règle avec un autre moyen de paiement. Ce ne sont pas les mêmes gestes,
 * ils ne méritent pas le même message.
 *
 * Le nom ne dit plus « encaissement » parce que le client HTTP est générique :
 * chaque service à venir lèvera celle-ci, pas une par domaine.
 *
 * `statut` et `champ` sont facultatifs et ne servent qu'au diagnostic — le
 * statut HTTP pour les journaux, le nom du champ quand la cause est une
 * réponse illisible. Un écran ne réagit jamais dessus : il réagit sur `code`.
 *
 * Noter la forme du constructeur : les propriétés sont affectées dans le corps,
 * pas déclarées en paramètre. Les propriétés de paramètre TypeScript ne sont
 * pas effaçables, et `erasableSyntaxOnly` — actif dans les gabarits Next
 * récents — les refuse.
 */
export class ErreurService extends Error {
  code: CodeErreur;
  /** Statut HTTP, quand la réponse en avait un. Pour les journaux. */
  statut?: number;
  /** Champ fautif, quand la cause est une réponse illisible. */
  champ?: string;

  constructor(
    code: CodeErreur,
    message: string,
    diagnostic: { statut?: number; champ?: string } = {},
  ) {
    super(message);
    this.name = "ErreurService";
    this.code = code;
    this.statut = diagnostic.statut;
    this.champ = diagnostic.champ;
  }
}

/**
 * Forme d'erreur du front, jamais levée.
 *
 * Ne correspond ni à `ApiError` de `types/api.ts` — la forme plate du back,
 * `{ error, message, request_id }` — ni à `ErreurImbriquee`, celle que servent
 * les routes de simulation. Ce que le front lève est `ErreurService`, au-dessus.
 *
 * N'est importée nulle part à ce jour.
 */
export interface ErreurApi {
  code: string;
  message: string;
  details?: Record<string, string>;
}
