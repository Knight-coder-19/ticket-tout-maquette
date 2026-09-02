/**
 * Le vocabulaire de l'encaissement.
 *
 * Une seule règle traverse tout ce fichier : l'argent est un entier de
 * centimes. Jamais un flottant. En JavaScript 0.1 + 0.2 vaut
 * 0.30000000000000004, et un centime perdu dans un dispositif public est un
 * centime que personne ne sait expliquer.
 *
 * Les erreurs ne vivent plus ici : `ErreurService` et son union de codes
 * sont dans `types/erreurs.ts`, parce qu'elles ne sont plus propres à la
 * caisse — chaque service les lève.
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
