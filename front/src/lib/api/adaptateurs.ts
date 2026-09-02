/**
 * Les conversions réseau → domaine.
 *
 * Une seule direction : ce que le back sert entre, ce que le domaine du front
 * manipule sort. Rien ne repart dans l'autre sens ici.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * C'est la seule frontière. Au-delà, un montant est un entier de centimes, un
 * horodatage comparable est un nombre, un statut est un mot français. En deçà,
 * c'est du snake_case anglais, des euros décimaux et de l'ISO 8601.
 *
 * Rien n'est branché : aucun service ne l'importe encore, aucun composant ne
 * le connaît. C'est délibéré — le back n'expose aucune route (voir
 * front/docs/contrat-api.md, divergence D1), il n'y a donc rien à brancher.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES COMPLÉMENTS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Plusieurs types du domaine portent des champs que le back ne sert pas.
 * Trois façons de traiter le cas ; une seule est honnête :
 *
 *   - inventer une valeur par défaut → non, c'est une donnée fausse qui se
 *     propage en silence ;
 *   - retirer le champ du domaine → non, ce fichier n'a pas à réécrire le
 *     domaine pour arranger le back ;
 *   - exiger la valeur de l'appelant, dans un paramètre nommé `complement` →
 *     c'est ce qui est fait.
 *
 * Le paramètre est obligatoire partout où il apparaît. Il n'a pas de valeur
 * par défaut, précisément pour que personne ne puisse l'oublier. La signature
 * dit alors la vérité : « ce que le back n'envoie pas, dis-le moi ».
 */

import type {
  BalanceResponse,
  CatalogItem,
  EmployeeTransaction,
  IssuedTokenResponse,
  PartnerReviewItem,
  PaymentResponse,
  PublicPartner,
  SirhBalance,
} from "@/types/api";
import type {
  CodePaiement,
  DemandePartenaire,
  Partenaire,
  Solde,
  StatutPartenaire,
  StatutTransaction,
  Transaction,
} from "@/types/domaine";
import {
  ErreurEncaissement,
  type CodeErreurEncaissement,
  type EncaissementAccepte,
  type MontantCentimes,
} from "@/types/encaissement";

/* ═══════════════════════════════════════════════════════════════════════════
 * 0. L'ERREUR DE CETTE COUCHE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Levée quand une réponse du back est illisible : date qui n'est pas une
 * date, montant qui n'est pas un nombre, statut sans équivalent dans le
 * domaine.
 *
 * Volontairement distincte d'`ErreurEncaissement`. Celle-ci dit « le serveur a
 * refusé, voici pourquoi, et l'écran sait quoi en faire ». Celle-là dit « le
 * serveur a répondu quelque chose que je ne sais pas lire » — ce n'est pas un
 * refus métier, c'est un contrat rompu, et aucun écran ne peut le rattraper.
 */
export class ErreurAdaptation extends Error {
  /** Nom du champ fautif, tel qu'il apparaît dans la réponse du back. */
  champ: string;

  constructor(champ: string, message: string) {
    super(message);
    this.name = "ErreurAdaptation";
    this.champ = champ;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. HORODATAGES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le back sert de l'ISO 8601 UTC avec `Z` (docs/data-dictionary.md:18), et
 * rien d'autre : `TIMESTAMPTZ` en base → `DateTime<Utc>` en Rust → chaîne ISO
 * en JSON (data-dictionary.md:40).
 *
 * Le domaine, lui, compare. Un compte à rebours, un tri, un « est-ce expiré »
 * se font sur des nombres, pas sur des chaînes.
 */

/**
 * Convertit un horodatage ISO 8601 en millisecondes depuis l'epoch.
 *
 * LÈVE si le résultat n'est pas fini. `Date.parse` rend `NaN` sur une chaîne
 * qu'il ne comprend pas, et `NaN` est la pire valeur qui puisse traverser
 * cette frontière : il ne lève pas, il ne se compare à rien, et il rend faux
 * tout test qui le touche. Un compte à rebours alimenté par `NaN` affiche un
 * jeton éternellement valide. Mieux vaut échouer ici, bruyamment.
 */
export function horodatage(valeur: string, champ: string): number {
  const millisecondes = Date.parse(valeur);
  if (!Number.isFinite(millisecondes)) {
    throw new ErreurAdaptation(
      champ,
      `Réponse du serveur illisible : ${champ} n'est pas une date ISO 8601 (${valeur}).`,
    );
  }
  return millisecondes;
}

/**
 * Valide un horodatage ISO 8601 et le rend TEL QUEL.
 *
 * Plusieurs types du domaine gardent une chaîne (`Transaction.date`,
 * `Solde.misAJourLe`, `CodePaiement.expireLe`). Les convertir en nombre ici
 * serait réécrire le domaine par la bande. Mais les laisser passer sans
 * regarder serait accepter n'importe quoi : une date illisible arriverait
 * intacte jusqu'à l'écran, où `formaterDate` échouerait loin de la cause.
 *
 * On valide donc, et on rend la chaîne d'origine.
 */
export function horodatageIso(valeur: string, champ: string): string {
  horodatage(valeur, champ);
  return valeur;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. MONTANTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le domaine est en centimes entiers, toujours (types/domaine.ts:9-10,
 * types/encaissement.ts:1-9). C'est une règle de sûreté, pas de style :
 * `0.1 + 0.2` vaut `0.30000000000000004`, et un centime perdu dans un
 * dispositif public est un centime que personne ne sait expliquer.
 *
 * Le back, lui, sert des EUROS DÉCIMAUX. Confirmé dans le code compilable :
 * backend/crates/core/src/money.rs:145 sérialise
 * `serialize_f64(self.0 as f64 / SUBUNIT as f64)` avec `SUBUNIT = 100`
 * (money.rs:13). L'amendement A5 (docs/decisions.md:62-71) l'assume et
 * prévient : « un 2500 résiduel écrit sous l'ancien contrat pour dire 25,00 €
 * serait désormais lu 2500,00 €, et cette erreur d'un facteur cent est
 * silencieuse ».
 *
 * Sauf que backend/crates/api/src/dto/employee.rs:3 écrit encore « Amounts
 * stay plain integers » — le commentaire est antérieur à A5 et n'a pas été
 * relu. Les deux lectures coexistent donc dans le dépôt. `centimesDepuis()`
 * ne parie sur aucune : il regarde le NOM du champ.
 */

/**
 * Convertit un décimal en euros vers des centimes entiers.
 *
 * ─── Pourquoi `Math.round` est correct ICI, alors qu'on l'évite ailleurs ───
 *
 * `lib/montant.ts:12-22` refuse `parseFloat(x) * 100` et découpe la chaîne à
 * la main. Le raisonnement y est juste, et il ne s'applique pas ici — les
 * deux fonctions ne reçoivent pas la même chose.
 *
 *   - `montant.ts` reçoit la SAISIE DE L'UTILISATEUR, une chaîne. « 12,50 »
 *     n'a pas encore été arrondi par qui que ce soit. Découper le texte donne
 *     1250 exactement, sans jamais passer par une valeur décimale, et permet
 *     en plus de REFUSER « 3,999 » — trois décimales, saisie invalide. C'est
 *     strictement mieux, et c'est pour cela que c'est fait là-bas.
 *
 *   - ici, la valeur arrive DÉJÀ EN NOMBRE, sortie de `JSON.parse`. La chaîne
 *     n'existe plus : `456.56` est devenu le double le plus proche de 456,56,
 *     et l'information « combien de décimales l'utilisateur avait tapé » est
 *     perdue avant que cette fonction soit appelée. Il n'y a rien à découper.
 *
 * Reste à choisir entre tronquer et arrondir sur ce double. La troncature est
 * fausse : `0.29 * 100` vaut `28.999999999999996`, tronqué cela donne 28
 * centimes. Mesuré côté back sur 0,01 € à 20 000 € : 131 252 montants sur
 * 1 999 999, soit 6,6 %, perdent un centime (docs/decisions.md:85-92).
 * L'arrondi corrige ces cas : `Math.round(28.999999999999996)` vaut 29.
 *
 * Le défaut connu de l'arrondi — accepter `3.999` en le portant à 400 — n'en
 * est pas un ici : le back a DÉJÀ refusé plus de deux décimales avant de
 * sérialiser (`money.rs:71-73`, `InvalidMoneyError::TooManyDecimals`). Un
 * nombre à trois décimales ne peut pas nous parvenir sans que le contrat soit
 * rompu en amont. Là où ce filtre n'existe pas — la saisie utilisateur —
 * `montant.ts` fait le travail par le texte, et c'est bien la bonne place.
 *
 * LÈVE si le résultat n'est pas un entier fini.
 */
export function centimesDepuisEuros(
  valeur: number,
  champ: string,
): MontantCentimes {
  const centimes = Math.round(valeur * 100);
  if (!Number.isInteger(centimes)) {
    throw new ErreurAdaptation(
      champ,
      `Réponse du serveur illisible : ${champ} n'est pas un montant (${valeur}).`,
    );
  }
  return centimes;
}

/**
 * Prend un entier de centimes tel quel, après vérification.
 *
 * Aucune arithmétique : c'est déjà l'unité du domaine. La seule chose à faire
 * est de confirmer que le back n'a pas envoyé un décimal sous un nom qui
 * promettait un entier — auquel cas la promesse est rompue et on le dit.
 */
export function centimesDepuisCentimes(
  valeur: number,
  champ: string,
): MontantCentimes {
  if (!Number.isInteger(valeur)) {
    throw new ErreurAdaptation(
      champ,
      `Réponse du serveur illisible : ${champ} promet des centimes entiers mais vaut ${valeur}.`,
    );
  }
  return valeur;
}

/**
 * Lit un montant sur un objet du réseau et rend des centimes entiers.
 *
 * La règle est portée par le NOM du champ, pas par une supposition :
 *
 *   - `<champ>_cents` présent → entier de centimes, pris tel quel ;
 *   - sinon `<champ>` → décimal en euros, converti.
 *
 * Aucun champ `*_cents` n'existe dans le contrat publié aujourd'hui : tous
 * les montants s'appellent `amount`, `settled`, `held`, `available`,
 * `total_amount`, `total_volume`, `total_received`. La branche existe pour la
 * raison écrite plus haut — `dto/employee.rs:3` dit encore « plain integers »
 * là où A5 dit « euros décimaux ». Le jour où le back tranche pour les
 * centimes, il le fera en renommant, et cette couche suivra sans qu'un seul
 * écran change. Si le back tranche pour les centimes SANS renommer, rien ici
 * ne pourra le détecter : c'est écrit dans contrat-api.md, divergence D2, et
 * cela reste à régler de vive voix.
 *
 * `brut` est typé `Readonly<Record<string, unknown>>` : tous les types de
 * `types/api.ts` sont des alias de types littéraux, donc assignables à cette
 * forme sans un seul `as` ni un seul `any`.
 */
export function centimesDepuis(
  brut: Readonly<Record<string, unknown>>,
  champ: string,
): MontantCentimes {
  const nomCentimes = `${champ}_cents`;
  const valeurCentimes = brut[nomCentimes];
  if (valeurCentimes !== undefined) {
    if (typeof valeurCentimes !== "number") {
      throw new ErreurAdaptation(
        nomCentimes,
        `Réponse du serveur illisible : ${nomCentimes} n'est pas un nombre.`,
      );
    }
    return centimesDepuisCentimes(valeurCentimes, nomCentimes);
  }

  const valeurEuros = brut[champ];
  if (typeof valeurEuros !== "number") {
    throw new ErreurAdaptation(
      champ,
      `Réponse du serveur illisible : ${champ} n'est pas un nombre.`,
    );
  }
  return centimesDepuisEuros(valeurEuros, champ);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. ERREURS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Deux formes coexistent dans le dépôt, et le back n'a pas tranché :
 *
 *   { "error": { "code": "token_expired", "message": "…" } }
 *        les routes de simulation du front
 *        (app/api/payment-tokens/route.ts:30-36), lues par
 *        encaissement.service.ts:16,36-37 ;
 *
 *   { "error": "TOKEN_EXPIRED", "message": "…", "request_id": "…" }
 *        le contrat publié (docs/data-dictionary.md:324-328) et le commentaire
 *        du fichier Rust (crates/api/src/error.rs:1).
 *
 * Le front lit aujourd'hui `corps.error.code` : sur la forme plate,
 * `("TOKEN_EXPIRED").code` vaut `undefined` et TOUTES les erreurs deviennent
 * « inconnu ». C'est la divergence D7 de l'audit. Cette fonction accepte les
 * deux, pour que le jour où le back tranche, rien ne casse d'un côté ni de
 * l'autre.
 */

/** Codes que le front sait traiter (types/encaissement.ts:33-42). */
const CODES_CONNUS: readonly CodeErreurEncaissement[] = [
  "unknown_token",
  "token_used",
  "token_expired",
  "insufficient_funds",
  "account_inactive",
  "partner_inactive",
  "invalid_amount",
  "reseau",
  "inconnu",
];

function estCodeConnu(code: string): code is CodeErreurEncaissement {
  return CODES_CONNUS.some((connu) => connu === code);
}

/**
 * Normalise un code d'erreur vers la casse du front : minuscules, tirets bas.
 *
 * Le back promet du SCREAMING_SNAKE « stable à vie »
 * (data-dictionary.md:21,626). Le front écrit ses codes en minuscules
 * (types/encaissement.ts:33-42). Le passage de l'un à l'autre est mécanique et
 * réversible, tant que personne n'introduit de tiret ou d'espace — d'où le
 * remplacement, qui n'est pas décoratif.
 */
function normaliserCode(code: string): string {
  return code.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function lireChaine(
  source: Readonly<Record<string, unknown>>,
  nom: string,
): string | null {
  const valeur = source[nom];
  return typeof valeur === "string" && valeur.trim() !== "" ? valeur : null;
}

function construire(
  codeBrut: string | null,
  message: string,
): ErreurEncaissement {
  if (codeBrut === null) {
    return new ErreurEncaissement("inconnu", message);
  }

  const code = normaliserCode(codeBrut);
  if (estCodeConnu(code)) {
    return new ErreurEncaissement(code, message);
  }

  /*
   * Code inconnu du front. La consigne est de le garder tel quel plutôt que de
   * le perdre : le remplacer par « inconnu » effacerait la seule information
   * exploitable de la réponse, et un code que le front ne connaît pas encore
   * est précisément celui qu'on veut voir apparaître dans un rapport de bug.
   *
   * C'est le SEUL `as` du fichier, et il n'élargit rien qui n'ait été vérifié :
   * `code` sort de `normaliserCode`, donc c'est une chaîne non vide, en
   * minuscules, sans espace ni tiret. Ce qu'il traverse, c'est l'union fermée
   * `CodeErreurEncaissement` — que je ne peux pas élargir sans modifier
   * types/encaissement.ts, hors périmètre ici. À reprendre le jour où ce type
   * accueillera une variante ouverte.
   */
  return new ErreurEncaissement(code as CodeErreurEncaissement, message);
}

/**
 * Transforme un corps d'erreur — l'une OU l'autre forme — en
 * `ErreurEncaissement`.
 *
 * `brut` est `unknown` parce qu'un corps d'erreur est exactement cela : ce
 * qu'on a réussi à lire d'une réponse qui a échoué. Il peut être absent, vide,
 * du HTML servi par un proxy, ou une troisième forme que personne n'a prévue.
 * Tous ces cas rendent une erreur exploitable plutôt que d'en lever une autre.
 *
 * `statut` sert uniquement au message par défaut, quand le corps ne dit rien.
 */
export function depuisErreur(
  brut: unknown,
  statut?: number,
): ErreurEncaissement {
  const messageParDefaut =
    statut === undefined
      ? "Le serveur a répondu une erreur sans corps lisible."
      : `Le serveur a répondu ${statut}.`;

  if (!estObjet(brut)) {
    return new ErreurEncaissement("inconnu", messageParDefaut);
  }

  const champErreur = brut["error"];

  /* Forme objet : { error: { code, message } }. */
  if (estObjet(champErreur)) {
    const code = lireChaine(champErreur, "code");
    const message = lireChaine(champErreur, "message");
    return construire(code, message ?? messageParDefaut);
  }

  /* Forme plate : { error: "TOKEN_EXPIRED", message, request_id }. */
  if (typeof champErreur === "string") {
    return construire(champErreur, lireChaine(brut, "message") ?? messageParDefaut);
  }

  /* Ni l'une ni l'autre : on garde au moins le message s'il existe. */
  return new ErreurEncaissement(
    "inconnu",
    lireChaine(brut, "message") ?? messageParDefaut,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. SOLDES
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `BalanceResponse` → `Solde`.
 *
 * Le domaine ne garde qu'un montant : c'est `available` — « c'est CE nombre
 * qu'on affiche en grand » (data-dictionary.md:378, glossaire :660).
 * `settled` et `held` sont perdus par la conversion, faute de champ pour les
 * accueillir ; l'écran de solde qui voudra distinguer « possédé » de
 * « réservé » aura besoin d'un type de domaine plus riche.
 *
 * `complement.misAJourLe` : `BalanceResponse` ne porte AUCUN horodatage
 * (data-dictionary.md:375-380), alors que `SirhBalance` porte `as_of`
 * (:589-596). L'asymétrie n'est expliquée nulle part. L'appelant fournit donc
 * l'instant qu'il veut voir affiché — celui de la réception, en général —
 * plutôt que de laisser cette couche en inventer un.
 */
export function depuisSolde(
  brut: BalanceResponse,
  complement: { misAJourLe: string },
): Solde {
  return {
    montant: centimesDepuis(brut, "available"),
    misAJourLe: horodatageIso(complement.misAJourLe, "misAJourLe"),
  };
}

/**
 * `SirhBalance` → `Solde`.
 *
 * Seule forme de solde du contrat qui se suffise à elle-même : elle porte
 * `as_of`, donc aucun complément n'est nécessaire.
 */
export function depuisSoldeSirh(brut: SirhBalance): Solde {
  return {
    montant: centimesDepuis(brut, "available"),
    misAJourLe: horodatageIso(brut.as_of, "as_of"),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. TRANSACTIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `OperationKind` → `StatutTransaction`.
 *
 * Le back n'a PAS de champ de statut sur une transaction : il a un `kind`
 * (data-dictionary.md:385). La correspondance se lit dans le glossaire :
 * « compensation : opération inverse corrigeant une erreur — à ne pas
 * confondre avec annulation : rien n'est jamais annulé (décision 4) »
 * (data-dictionary.md:666). Une compensation EST la contre-écriture.
 *
 * `"annulee"` est donc inatteignable, et ce n'est pas un oubli : l'invariant
 * I8 (docs/data-model.md:132-140) rend le ledger en ajout seul, `UPDATE` et
 * `DELETE` échouent au niveau des privilèges ET d'un déclencheur. Rien ne
 * s'annule, jamais. Le jour où un écran affiche « annulée », il affiche une
 * chose que le système ne sait pas produire.
 */
function statutDepuisKind(
  kind: EmployeeTransaction["kind"],
): StatutTransaction {
  return kind === "compensation" ? "contre_ecriture" : "validee";
}

/**
 * `EmployeeTransaction` → `Transaction`.
 *
 * `partenaireNom` ← `counterparty` : attention au nom du champ côté domaine.
 * `counterparty` vaut le `trade_name` du partenaire pour un paiement, mais le
 * `legal_name` de l'EMPLOYEUR pour un rechargement (data-dictionary.md:388).
 * Sur une ligne `direction: "in"`, « partenaireNom » désigne donc un employeur.
 * Le domaine porte un nom trompeur ; ce n'est pas à cette couche de le
 * corriger, mais il fallait l'écrire.
 *
 * `transactionOrigineId` ← rien, volontairement. Le domaine le documente
 * « renseigné uniquement pour une contre-écriture » (types/domaine.ts:36), et
 * `EmployeeTransaction` n'expose aucun `original_operation_id` : seul
 * `CompensationRequest` en porte un (data-dictionary.md:559), en ENTRÉE. Le
 * champ `reference` existe bien, mais rien ne dit qu'il contiendrait cet
 * identifiant — voir le commentaire d'ambiguïté sur `reference` dans
 * types/api.ts. `null` est la valeur d'absence du contrat
 * (data-dictionary.md:20) ; le lien reste à établir côté back.
 */
export function depuisTransaction(brut: EmployeeTransaction): Transaction {
  return {
    id: brut.id,
    date: horodatageIso(brut.occurred_at, "occurred_at"),
    partenaireNom: brut.counterparty,
    montant: centimesDepuis(brut, "amount"),
    statut: statutDepuisKind(brut.kind),
    transactionOrigineId: null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. CODE DE PAIEMENT
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `IssuedTokenResponse` → `CodePaiement`.
 *
 * `valeur` ← `short_code`, et pas `qr_payload`. Les deux sont des « valeurs »
 * du jeton, mais elles ne servent pas au même geste : `short_code` est ce qui
 * se lit à voix haute et se tape au comptoir (« K7M2-P4XQ »), `qr_payload` est
 * ce qui s'encode dans l'image, « tel quel, sans transformation »
 * (data-dictionary.md:409). `CodePaiement` n'a que deux champs : le domaine ne
 * peut pas porter les deux.
 *
 * ⚠ PERTE D'INFORMATION ASSUMÉE. Cette conversion jette `jti`, `amount`,
 * `issued_at` et `qr_payload`. Un écran qui affiche un QR ne peut donc PAS se
 * contenter de `CodePaiement` : il lui faut la réponse brute. Le domaine est
 * ici plus pauvre que le réseau, et c'est le domaine qu'il faudra enrichir —
 * pas cette fonction qu'il faudra contourner.
 */
export function depuisCodePaiement(brut: IssuedTokenResponse): CodePaiement {
  return {
    valeur: brut.short_code,
    expireLe: horodatageIso(brut.expires_at, "expires_at"),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. PARTENAIRES
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `CatalogItem` → `Partenaire`.
 *
 * `categorieId` ← `category`, qui est un LIBELLÉ et non un identifiant. Le
 * schéma n'a aucune table de catégories : les 18 `CREATE TABLE` de
 * backend/migrations/0001_schema.sql n'en comportent pas, et `category` est
 * une colonne de texte sur `partners`. Le domaine attend un `Identifiant`
 * (types/domaine.ts:22) ; on lui passe le libellé, faute de mieux, et sans
 * fabriquer un identifiant qui n'existe nulle part. À corriger le jour où le
 * back se dote d'un référentiel de catégories — ce que la règle 4 de
 * front/docs/ARCHITECTURE.md réclame déjà.
 *
 * `complement.estMisEnAvant` : `CatalogItem` ne porte aucun champ de mise en
 * avant (data-dictionary.md:470-480). L'information existe côté back, mais
 * ailleurs — dans `GET /me/minister-picks` (:395-398) et dans
 * `GET /admin/highlights` (:513-520). Seul l'appelant, qui a chargé ces
 * listes, peut recouper. Cette couche ne devine pas.
 */
export function depuisPartenaire(
  brut: CatalogItem,
  complement: { estMisEnAvant: boolean },
): Partenaire {
  return {
    id: brut.id,
    nom: brut.trade_name,
    categorieId: brut.category,
    ville: brut.city === null ? null : brut.city.name,
    estOfficiel: brut.is_official_partner,
    estMisEnAvant: complement.estMisEnAvant,
  };
}

/**
 * `PublicPartner` → `Partenaire`.
 *
 * Deux valeurs sont DÉDUITES, pas inventées, et chacune d'une règle écrite :
 *
 *   - `estOfficiel: true` — « Seuls les partenaires `approved` y figurent »
 *     (data-dictionary.md:356), et `is_official_partner` est précisément
 *     dérivé de `status === "approved"` (amendement A4, :670). Un partenaire
 *     présent sur cette surface est officiel par construction.
 *
 *   - `estMisEnAvant: true` — la route s'appelle `featured-partners` et sert
 *     la liste des mises en avant (data-dictionary.md:339). Y figurer, c'est
 *     être mis en avant.
 *
 * Ces deux déductions ne valent QUE pour cette surface. C'est la raison d'être
 * d'une fonction séparée de `depuisPartenaire()` : la même déduction serait
 * fausse sur un `CatalogItem`.
 */
export function depuisPartenairePublic(brut: PublicPartner): Partenaire {
  return {
    id: brut.id,
    nom: brut.trade_name,
    categorieId: brut.category,
    ville: brut.city === null ? null : brut.city.name,
    estOfficiel: true,
    estMisEnAvant: true,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. DEMANDE PARTENAIRE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `PartnerStatus` → `StatutPartenaire`.
 *
 * Quatre valeurs sur cinq se correspondent. La cinquième, `"closed"`
 * (data-dictionary.md:57), n'a AUCUN équivalent dans l'union du front
 * (types/domaine.ts:50). La mapper sur `"suspendu"` serait confondre une
 * fermeture définitive avec une suspension réversible — deux situations qui
 * n'ouvrent pas les mêmes gestes.
 *
 * On lève donc, plutôt que de rendre une valeur plausible et fausse. Le jour
 * où un partenaire fermé remonte dans une file de validation, l'écran doit
 * s'arrêter et quelqu'un doit décider ce que le front affiche — pas cette
 * couche, en silence.
 */
function statutDepuisPartnerStatus(
  statut: PartnerReviewItem["status"],
): StatutPartenaire {
  switch (statut) {
    case "pending":
      return "en_attente";
    case "approved":
      return "valide";
    case "rejected":
      return "refuse";
    case "suspended":
      return "suspendu";
    case "closed":
      throw new ErreurAdaptation(
        "status",
        'Le statut partenaire "closed" n\'a pas d\'équivalent dans le domaine du front (types/domaine.ts:50).',
      );
  }
}

/**
 * `PartnerReviewItem` → `DemandePartenaire`.
 *
 * `nom` ← `legal_name`. Le back sert les deux noms ; le domaine n'en garde
 * qu'un. Sur un écran de validation, on juge une personne morale, pas une
 * enseigne : c'est le nom légal qui engage. `trade_name` est perdu.
 *
 * `complement.siren` et `complement.objetSocial` : le back ne sert NI l'un NI
 * l'autre. `PartnerReviewItem` porte `ifu` (data-dictionary.md:497), qui est
 * un identifiant fiscal — ce n'est pas un SIREN, et il est nullable là où le
 * domaine exige une chaîne. Les traiter comme équivalents serait affirmer une
 * égalité que rien n'établit. L'objet social, lui, n'existe nulle part dans le
 * contrat ni dans le schéma. Ces deux champs sont donc demandés à l'appelant,
 * et l'audit les compte parmi ce que le back n'expose pas encore.
 *
 * `motifDecision` ← rien. Le motif de refus part en ENTRÉE
 * (`RejectRequest.reason`, data-dictionary.md:509) et n'est jamais renvoyé :
 * `PartnerReviewItem` ne porte aucun champ de motif. `null` est la valeur
 * d'absence du contrat (:20).
 *
 * `decideeLe` ← rien. La table `partners` a bien une colonne `reviewed_at`
 * (backend/migrations/0001_schema.sql:116), mais le DTO ne l'expose pas :
 * `submitted_at` est le seul horodatage servi (:504). Ne pas confondre les
 * deux — l'un date le dépôt, l'autre la décision.
 */
export function depuisDemandePartenaire(
  brut: PartnerReviewItem,
  complement: { siren: string; objetSocial: string },
): DemandePartenaire {
  /* Validé même s'il n'est pas exposé : une date illisible est un contrat
     rompu, qu'on la garde ou non. */
  horodatage(brut.submitted_at, "submitted_at");

  return {
    id: brut.id,
    nom: brut.legal_name,
    siren: complement.siren,
    objetSocial: complement.objetSocial,
    statut: statutDepuisPartnerStatus(brut.status),
    motifDecision: null,
    decideeLe: null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. ENCAISSEMENT
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `PaymentResponse` → `EncaissementAccepte`.
 *
 * `ref` ← `id`, l'identifiant du paiement, et non `jti` : le `jti` identifie
 * le JETON consommé, pas l'écriture. Un caissier qui cite une référence cite
 * la transaction.
 *
 * `complement.employee` : le back ne sert PAS l'identité du salarié au
 * partenaire, et c'est une décision, pas un oubli — il n'expose qu'un
 * `customer_label` valant « K. A. », « jamais le nom complet »
 * (data-dictionary.md:434), et `PaymentResponse` ne porte même pas ce
 * label-là (:443-451). L'écran d'encaissement du front affiche aujourd'hui
 * `employee.name` : c'est la divergence D14 de l'audit, et elle se règle sur
 * l'écran, pas ici.
 *
 * `complement.rejoue` : `PaymentResponse` ne porte aucun marqueur de rejeu.
 * Un règlement rejoué par le même partenaire renvoie `200` avec exactement la
 * même forme et `status: "settled"` (data-dictionary.md:645) — rien ne le
 * distingue d'un premier encaissement. Seul l'appelant sait s'il rejouait.
 * Divergence D13.
 */
export function depuisEncaissement(
  brut: PaymentResponse,
  complement: {
    employee: { id: string; name: string };
    rejoue: boolean;
  },
): EncaissementAccepte {
  return {
    ref: brut.id,
    amount: centimesDepuis(brut, "amount"),
    createdAt: horodatage(brut.occurred_at, "occurred_at"),
    employee: complement.employee,
    rejoue: complement.rejoue,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. CE QUI N'A VOLONTAIREMENT PAS D'ADAPTATEUR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chacun de ces manques est un manque du contrat, pas de ce fichier. Écrire
 * la fonction supposerait d'inventer la donnée absente.
 *
 *   JetonResolu        Le back n'a AUCUNE route qui résolve un jeton sans le
 *                      consommer : ni docs/data-dictionary.md §4.5, ni
 *                      crates/api/src/routes/partner.rs:1-3. Il n'existe donc
 *                      aucun type réseau d'où partir. Divergence D6.
 *
 *   Categorie          Aucune table de catégories dans le schéma, aucun DTO,
 *                      aucune route. `category` est un libellé porté par le
 *                      partenaire. Rien à convertir.
 *
 *   ReponsePaginee<T>  `Paginated<T>` est keyset — `items` + `next_cursor`.
 *                      `ReponsePaginee<T>` est offset — `page`, `taillePage`,
 *                      `total`. Le back ne compte pas les lignes et ne PEUT
 *                      pas produire `total` : la conversion n'existe pas.
 *                      Divergence D10 ; il faut trancher l'enveloppe avant.
 *
 *   PartnerTransaction Convertir vers `Transaction` collerait `customer_label`
 *                      dans `partenaireNom`, c'est-à-dire le client dans le
 *                      champ du commerçant. Le domaine n'a pas de type pour la
 *                      vue partenaire ; il en faut un.
 *
 *   ChargeUtileQr      Son champ `amt` est d'unité indéterminée (voir
 *                      types/api.ts). Convertir un montant dont on ignore
 *                      l'unité, c'est se tromper d'un facteur cent une fois
 *                      sur deux. Ambiguïté A1 de l'audit.
 */
