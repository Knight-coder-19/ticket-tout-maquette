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

/**
 * Ce que le serveur répond quand un jeton présenté est encore valable.
 *
 * ─── Le montant vient d'ICI, pas de la caisse ───
 *
 * C'est tout le modèle du back : le salarié a fixé le montant à l'émission, les
 * fonds sont réservés depuis (`core/src/payments/authorize.rs:1-3`), et le
 * partenaire ne fait que confirmer. `SettleRequest` ne porte d'ailleurs aucun
 * champ de montant (`data-dictionary.md:438-441`).
 *
 * Le caissier lit donc ce qu'il va encaisser avant de valider ; il ne le saisit
 * pas.
 */
export type JetonResolu = {
  /** UUID du jeton. C'est la référence qui part au règlement. */
  jti: string;
  /** Huit caractères, format `XXXX-XXXX` : ce qui est lu à voix haute. */
  codeCourt: string;
  /** Montant réservé, en centimes entiers. Fixé à l'émission. */
  montant: MontantCentimes;
  /**
   * Le bénéficiaire, abrégé.
   *
   * « K. A. », jamais le nom complet : le contrat l'impose
   * (`data-dictionary.md:434`), et un commerçant n'a pas à connaître l'identité
   * de ses clients pour encaisser.
   */
  beneficiaire: string;
  /** Horodatage d'expiration, en millisecondes. */
  expireA: number;
};

/** Une transaction écrite au registre. */
export type EncaissementAccepte = {
  /** Identifiant du paiement. C'est la référence que cite un caissier. */
  reference: string;
  /** Le jeton consommé. */
  jti: string;
  montant: MontantCentimes;
  /** Horodatage du règlement, en millisecondes. */
  regleA: number;
  /** Comment le jeton a été présenté. */
  modeSaisie: "qr_scan" | "short_code";
  /**
   * Le bénéficiaire, abrégé — repris du jeton résolu.
   *
   * ⚠ Le serveur ne le renvoie PAS au règlement : `PaymentResponse` ne porte ni
   * identité ni `customer_label` (`data-dictionary.md:443-451`). L'écran le
   * conserve de l'étape précédente pour l'afficher sur le reçu, faute de quoi
   * le caissier verrait un montant sans savoir de qui.
   */
  beneficiaire: string;
  /**
   * Vrai quand le serveur a reconnu un règlement déjà écrit et l'a renvoyé au
   * lieu d'en écrire un second.
   *
   * ⚠ Le serveur ne le dit PAS non plus : un rejeu rend `200` avec exactement
   * la même forme et `status: "settled"` (`data-dictionary.md:645`). C'est
   * l'écran qui le sait, parce qu'il sait s'il rejouait. Divergence D13.
   *
   * L'écran doit le dire au caissier : « déjà encaissé », pas « encaissé ».
   */
  rejoue: boolean;
};
