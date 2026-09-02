/**
 * Le vocabulaire de l'encaissement.
 *
 * Une seule règle traverse tout ce fichier : l'argent est un entier de
 * centimes. Jamais un flottant. En JavaScript 0.1 + 0.2 vaut
 * 0.30000000000000004, et un centime perdu dans un dispositif public est un
 * centime que personne ne sait expliquer.
 */
export type MontantCentimes = number;

/** Ce que le serveur répond quand un jeton présenté est encore valable. */
export type JetonResolu = {
  token: string;
  employee: { id: string; name: string };
  /** Horodatage d'expiration, en millisecondes. */
  expiresAt: number;
};

/** Une transaction écrite au registre. */
export type EncaissementAccepte = {
  ref: string;
  amount: MontantCentimes;
  createdAt: number;
  employee: { id: string; name: string };
  /**
   * Vrai quand le serveur a reconnu la clé d'idempotence et renvoyé la
   * transaction déjà écrite au lieu d'en écrire une seconde (règle R3).
   * L'écran doit le dire au caissier : « déjà encaissé », pas « encaissé ».
   */
  rejoue: boolean;
};

type CodeConnu =
  | "unknown_token" | "token_used" | "token_expired"
  | "insufficient_funds" | "account_inactive" | "partner_inactive"
  | "invalid_amount" | "reseau" | "inconnu";

/**
 * Les codes que le front sait traiter, plus tout code que le back inventerait
 * sans nous prévenir.
 *
 * Le `& {}` n'est pas décoratif : sans lui, TypeScript effondre
 * `CodeConnu | string` en `string`, et l'autocomplétion ne propose plus rien.
 * Avec lui, l'union survit — les neuf codes connus restent suggérés à la
 * frappe, et une chaîne inconnue passe sans assertion.
 *
 * C'est ce qui permet à `depuisErreur()` de conserver un code qu'il ne connaît
 * pas au lieu de l'écraser en « inconnu » : un code que le front ignore encore
 * est précisément celui qu'on veut lire dans un rapport de bug.
 */
export type CodeErreurEncaissement = CodeConnu | (string & {});

/**
 * On ne jette pas une `Error` nue : le code porte la décision que l'écran
 * doit prendre. Un jeton expiré se redemande au client ; un solde
 * insuffisant se règle avec un autre moyen de paiement. Ce ne sont pas les
 * mêmes gestes, ils ne méritent pas le même message.
 *
 * Noter la forme du constructeur : `code` est affecté dans le corps, pas
 * déclaré en paramètre. Les propriétés de paramètre TypeScript ne sont pas
 * effaçables, et `erasableSyntaxOnly` — actif dans les gabarits Next
 * récents — les refuse.
 */
export class ErreurEncaissement extends Error {
  code: CodeErreurEncaissement;

  constructor(code: CodeErreurEncaissement, message: string) {
    super(message);
    this.name = "ErreurEncaissement";
    this.code = code;
  }
}
