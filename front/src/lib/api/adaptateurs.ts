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
  ChainVerification,
  DailyRevenueItem,
  LedgerEntryItem,
  LigneJournal,
  PartnerAccountItem,
  PartnerAccountStatus,
  PartnerReviewItem,
  PartnerStatus,
  PartnerSummary,
  PaymentResponse,
  PublicPartner,
  ResolvedTokenItem,
  SirhBalance,
} from "@/types/api";
import type {
  CodePaiement,
  ComptePartenaire,
  DecisionJournal,
  EcritureRegistre,
  DemandeAdhesion,
  DemandePartenaire,
  MonCompte,
  Partenaire,
  NatureEcriture,
  SensDecision,
  Solde,
  StatutPartenaire,
  StatutTransaction,
  VerificationIntegrite,
  Transaction,
} from "@/types/domaine";
import type {
  EncaissementAccepte,
  JetonResolu,
  JourneeRecettes,
  MontantCentimes,
  ResumeActivite,
} from "@/types/encaissement";
import { ErreurService } from "@/types/erreurs";

/* ═══════════════════════════════════════════════════════════════════════════
 * 0. CE QUE CETTE COUCHE LÈVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ErreurService` avec le code `"reponse_illisible"`, et le nom du champ fautif
 * dans `champ`. Pas de classe dédiée : une réponse qu'on ne sait pas lire est
 * un échec comme un autre pour l'écran qui l'attrape, et lui demander de
 * connaître deux classes pour ne rien laisser passer était le vrai défaut.
 *
 * Ce que le code dit exactement : « le serveur a répondu quelque chose que je
 * ne sais pas lire ». Ce n'est pas un refus métier, c'est un contrat rompu —
 * aucun écran ne peut le rattraper, il ne peut que l'afficher et le journaliser.
 */

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
export function horodatage(valeur: unknown, champ: string): number {
  /* `unknown` et pas `string` : c'est une fonction de frontière, et le corps
     d'une réponse n'est pas encore vérifié quand elle est appelée. Un nombre
     déjà en millisecondes passe tel quel — c'est ce que tolérait le service
     avant de déléguer ici, et le retirer aurait changé son comportement. */
  const millisecondes =
    typeof valeur === "number" ? valeur : Date.parse(String(valeur));
  if (!Number.isFinite(millisecondes)) {
    throw new ErreurService(
      "reponse_illisible",
      `Réponse du serveur illisible : ${champ} n'est pas une date ISO 8601 (${valeur}).`,
      { champ },
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
    throw new ErreurService(
      "reponse_illisible",
      `Réponse du serveur illisible : ${champ} n'est pas un montant (${valeur}).`,
      { champ },
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
    throw new ErreurService(
      "reponse_illisible",
      `Réponse du serveur illisible : ${champ} promet des centimes entiers mais vaut ${valeur}.`,
      { champ },
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
      throw new ErreurService(
        "reponse_illisible",
        `Réponse du serveur illisible : ${nomCentimes} n'est pas un nombre.`,
        { champ: nomCentimes },
      );
    }
    return centimesDepuisCentimes(valeurCentimes, nomCentimes);
  }

  const valeurEuros = brut[champ];
  if (typeof valeurEuros !== "number") {
    throw new ErreurService(
      "reponse_illisible",
      `Réponse du serveur illisible : ${champ} n'est pas un nombre.`,
      { champ },
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

/**
 * Normalise un code d'erreur vers la casse du front : minuscules, tirets bas.
 *
 * Le back promet du SCREAMING_SNAKE « stable à vie »
 * (data-dictionary.md:21,626). Le front écrit ses codes en minuscules
 * (types/erreurs.ts:18-21). Le passage de l'un à l'autre est mécanique et
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
  statut: number | undefined,
): ErreurService {
  if (codeBrut === null) {
    return new ErreurService("inconnu", message, { statut });
  }

  /*
   * Un code que le front ne connaît pas traverse TEL QUEL, et c'est voulu : le
   * remplacer par « inconnu » effacerait la seule information exploitable de la
   * réponse, et un code encore inconnu est précisément celui qu'on veut voir
   * apparaître dans un rapport de bug.
   *
   * Aucune assertion n'est nécessaire pour cela : `CodeErreur` est
   * une union ouverte (`CodeConnu | (string & {})`, types/erreurs.ts), donc
   * une chaîne quelconque y entre sans forcer le typage. Les tables de messages
   * des composants restent des `Record<string, string>` avec leur repli — un
   * code inconnu y tombe sur le message par défaut, sans casser.
   */
  return new ErreurService(normaliserCode(codeBrut), message, { statut });
}

/**
 * Transforme un corps d'erreur — l'une OU l'autre forme — en `ErreurService`.
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
): ErreurService {
  const messageParDefaut =
    statut === undefined
      ? "Le serveur a répondu une erreur sans corps lisible."
      : `Le serveur a répondu ${statut}.`;

  if (!estObjet(brut)) {
    return new ErreurService("inconnu", messageParDefaut, { statut });
  }

  const champErreur = brut["error"];

  /* Forme objet : { error: { code, message } }. */
  if (estObjet(champErreur)) {
    const code = lireChaine(champErreur, "code");
    const message = lireChaine(champErreur, "message");
    return construire(code, message ?? messageParDefaut, statut);
  }

  /* Forme plate : { error: "TOKEN_EXPIRED", message, request_id }. */
  if (typeof champErreur === "string") {
    return construire(
      champErreur,
      lireChaine(brut, "message") ?? messageParDefaut,
      statut,
    );
  }

  /* Ni l'une ni l'autre : on garde au moins le message s'il existe. */
  return new ErreurService(
    "inconnu",
    lireChaine(brut, "message") ?? messageParDefaut,
    { statut },
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
 * Les cinq valeurs de l'ENUM (`0001_schema.sql:7`) ont chacune la leur. C'est
 * la SEULE traduction de statut de partenaire du projet : la file de
 * validation et le registre des comptes l'utilisent toutes deux.
 *
 * ⚠ Elle levait autrefois sur `"closed"`, faute d'équivalent dans une union du
 * domaine qui n'en portait que quatre. Ce n'est plus le cas : l'union en a
 * cinq, et un partenaire fermé se convertit comme les autres. Un écran qui ne
 * veut pas en traiter le filtre — il ne compte plus sur une exception pour
 * l'arrêter.
 *
 * Le `default` reste, et lève. Il ne couvre plus un trou de notre côté mais un
 * élargissement du leur : « toute nouvelle valeur est un changement cassant »
 * (`data-dictionary.md:51`), et mieux vaut s'arrêter que ranger un statut
 * inconnu dans un fourre-tout.
 */
function statutDepuisPartnerStatus(statut: PartnerStatus): StatutPartenaire {
  switch (statut) {
    case "pending":
      return "en_attente";
    case "approved":
      return "agree";
    case "rejected":
      return "refuse";
    case "suspended":
      return "suspendu";
    case "closed":
      return "ferme";
    default:
      throw new ErreurService(
        "reponse_illisible",
        `Réponse du serveur illisible : statut de partenaire inconnu (${String(statut)}).`,
        { champ: "status" },
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
 * 8 bis. FILE DE VALIDATION ET JOURNAL DES DÉCISIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `PartnerReviewItem` → `DemandeAdhesion`.
 *
 * Aucun complément : contrairement à `depuisDemandePartenaire()`, tout ce que
 * `DemandeAdhesion` porte existe dans le DTO. C'est le bénéfice d'avoir taillé
 * le type du domaine sur ce dont l'écran a besoin plutôt que l'inverse.
 *
 * `estEnLigne` est DÉDUIT, pas inventé : `service_mode === "online"`. La
 * contrainte `physical_needs_city` (`0001_schema.sql:118`) garantit qu'un
 * partenaire non exclusivement en ligne a une ville, donc les deux lectures
 * concordent — mais on prend le champ, pas la conséquence.
 *
 * `ville` est aplati depuis `city.name`, et `departement` depuis
 * `city.department` : l'écran affiche « Cotonou (Littoral) », il n'a que faire
 * de l'identifiant de la ville.
 */
export function depuisDemandeAdhesion(brut: PartnerReviewItem): DemandeAdhesion {
  return {
    id: brut.id,
    raisonSociale: brut.legal_name,
    enseigne: brut.trade_name,
    categorie: brut.category,
    identifiantFiscal: brut.ifu,
    ville: brut.city === null ? null : brut.city.name,
    departement: brut.city === null ? null : brut.city.department,
    estEnLigne: brut.service_mode === "online",
    siteWeb: brut.website_url,
    courrielContact: brut.contact_email,
    deposeeLe: horodatageIso(brut.submitted_at, "submitted_at"),
  };
}

/**
 * Le verbe du journal → le sens de la décision.
 *
 * Les deux verbes reconnus sont les nôtres (`consignerAuJournal` dans le
 * magasin) : la colonne `action` est un `TEXT` libre (`0001_schema.sql:268`) et
 * aucun document ne fixe de vocabulaire. Tout autre verbe rend `"autre"` — et
 * `action` conserve la chaîne brute, pour qu'un verbe inconnu apparaisse dans
 * un rapport de bug au lieu de disparaître.
 */
function sensDepuisAction(action: string): SensDecision {
  if (action === "partner.approved") return "acceptee";
  if (action === "partner.rejected") return "refusee";
  return "autre";
}

/** Lit une chaîne dans un `payload` JSONB, sans rien supposer de sa forme. */
function chaineDuPayload(
  payload: Record<string, unknown> | null,
  champ: string,
): string | null {
  if (payload === null) return null;
  const valeur = payload[champ];
  return typeof valeur === "string" && valeur.trim() !== "" ? valeur : null;
}

/**
 * `LigneJournal` → `DecisionJournal`.
 *
 * ⚠ Le type d'entrée vient d'une route que NOUS proposons, pas du contrat du
 * back — voir `types/api.ts`. Cet adaptateur changera avec elle.
 *
 * `payload` est un `JSONB` : rien n'y est garanti, tout y est lu avec
 * précaution. Une entrée dont le payload est vide reste affichable, avec des
 * champs nuls, plutôt que de faire tomber la liste entière.
 */
export function depuisDecisionJournal(brut: LigneJournal): DecisionJournal {
  return {
    id: brut.id,
    demandeId: brut.entity_id,
    enseigne: chaineDuPayload(brut.payload, "trade_name"),
    decision: sensDepuisAction(brut.action),
    action: brut.action,
    motif: chaineDuPayload(brut.payload, "reason"),
    auteurId: brut.actor_id,
    priseLe: horodatageIso(brut.created_at, "created_at"),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 ter. REGISTRE DES COMPTES PARTENAIRES
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `PartnerAccountItem` → `ComptePartenaire`.
 *
 * ⚠ Le type d'entrée vient d'une route que NOUS proposons — voir
 * `types/api.ts`. Cet adaptateur changera avec elle.
 *
 * `totalRecu` repasse en CENTIMES : le back sert des euros décimaux
 * (`money.rs:145`), le domaine ne connaît que des entiers de centimes. C'est
 * exactement le travail de cette couche, et `centimesDepuis()` lève si le
 * serveur envoie autre chose qu'un nombre.
 */
export function depuisComptePartenaire(brut: PartnerAccountItem): ComptePartenaire {
  return {
    id: brut.id,
    raisonSociale: brut.legal_name,
    enseigne: brut.trade_name,
    categorie: brut.category,
    identifiantFiscal: brut.ifu,
    ville: brut.city === null ? null : brut.city.name,
    departement: brut.city === null ? null : brut.city.department,
    estEnLigne: brut.service_mode === "online",
    courrielContact: brut.contact_email,
    statut: statutDepuisPartnerStatus(brut.status),
    totalRecu: centimesDepuis(brut, "total_received"),
    nombreTransactions: brut.transaction_count,
    decideeLe:
      brut.reviewed_at === null ? null : horodatageIso(brut.reviewed_at, "reviewed_at"),
    auteurDecision: brut.reviewed_by,
    motifDecision: brut.review_reason,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 quater. REGISTRE COMPTABLE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `operation_kind` → `NatureEcriture`.
 *
 * Les quatre valeurs de l'ENUM (`data-dictionary.md:61`) ont chacune la leur.
 * `closure_forfeit` devient « déchéance » : c'est le terme du glossaire pour le
 * solde résiduel d'un compte fermé passé le délai de grâce.
 *
 * Une nature inconnue lève. Le registre est la pièce comptable du dispositif :
 * y afficher une opération dont on ne sait pas dire la nature serait pire que
 * de refuser de l'afficher.
 */
function natureDepuisKind(kind: LedgerEntryItem["kind"]): NatureEcriture {
  switch (kind) {
    case "topup":
      return "rechargement";
    case "payment":
      return "paiement";
    case "compensation":
      return "annulation";
    case "closure_forfeit":
      return "decheance";
    default:
      throw new ErreurService(
        "reponse_illisible",
        `Réponse du serveur illisible : nature d'opération inconnue (${String(kind)}).`,
        { champ: "kind" },
      );
  }
}

/**
 * `LedgerEntryItem` → `EcritureRegistre`.
 *
 * ⚠ Le type d'entrée vient d'une route que NOUS proposons — voir
 * `types/api.ts`. Cet adaptateur changera avec elle.
 *
 * `montant` repasse en CENTIMES : le back sert des euros décimaux
 * (`money.rs:145`), le domaine ne connaît que des entiers. Le formatage
 * n'arrive qu'à l'affichage.
 *
 * `titulaire` aplatit les trois colonnes de propriétaire en une seule chaîne
 * lisible : l'identifiant du salarié ou du partenaire, ou le code du compte
 * système. Un agent lit « SAL-001 » ou « MINISTRY_ISSUANCE », pas un UUID de
 * compte.
 */
export function depuisEcritureRegistre(brut: LedgerEntryItem): EcritureRegistre {
  const typeTitulaire = brut.account_owner_type ?? "system";
  return {
    seq: brut.seq,
    operationId: brut.operation_id,
    titulaire: brut.account_owner_id ?? brut.account_system_code ?? brut.account_id,
    typeTitulaire,
    sens: brut.direction,
    montant: centimesDepuis(brut, "amount"),
    nature: natureDepuisKind(brut.kind),
    libelle: brut.memo,
    survenueLe: horodatageIso(brut.occurred_at ?? brut.recorded_at, "occurred_at"),
    inscriteLe: horodatageIso(brut.recorded_at, "recorded_at"),
    empreinte: brut.hash,
    empreintePrecedente: brut.prev_hash,
    annuleePar: brut.compensated_by,
    motifAnnulation: brut.compensation_reason,
  };
}

/**
 * `ChainVerification` → `VerificationIntegrite`.
 *
 * ✅ Le type d'entrée est celui du CONTRAT (`data-dictionary.md:576-580`), un
 * des rares que le back ait entièrement spécifiés.
 *
 * `controleeA` est ajouté par le front, pas lu du serveur : la route ne rend
 * pas d'horodatage, et l'écran doit pouvoir dire QUAND le contrôle a été fait.
 * Un résultat d'intégrité sans heure ne prouve rien — il pourrait dater d'hier.
 */
export function depuisVerification(
  brut: ChainVerification,
  controleeA: number,
): VerificationIntegrite {
  return {
    intacte: brut.valid,
    ecrituresVerifiees: brut.checked_entries,
    premiereFautive: brut.first_invalid_seq,
    controleeA,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 quinquies. MON COMPTE — ESPACE PARTENAIRE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `PartnerAccountStatus` → `MonCompte`.
 *
 * ⚠ Le type d'entrée vient d'une route que NOUS proposons : le contrat n'a
 * aucune route disant à un partenaire l'état de son compte. Voir
 * `types/api.ts`.
 *
 * Le statut passe par `statutDepuisPartnerStatus`, la traduction unique du
 * projet — celle-là même que la file de validation et le registre des comptes
 * utilisent. Un statut est un statut, quel que soit l'écran qui le lit.
 */
export function depuisMonCompte(brut: PartnerAccountStatus): MonCompte {
  return {
    id: brut.id,
    enseigne: brut.trade_name,
    statut: statutDepuisPartnerStatus(brut.status),
    motif: brut.review_reason,
    decideeLe:
      brut.reviewed_at === null ? null : horodatageIso(brut.reviewed_at, "reviewed_at"),
    deposeeLe: horodatageIso(brut.submitted_at, "submitted_at"),
    courrielContact: brut.contact_email,
    ville: brut.city === null ? null : brut.city.name,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 sexies. TABLEAU DE BORD DU COMMERÇANT
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `PartnerSummary` → `ResumeActivite`.
 *
 * ✅ Le type d'entrée est celui du CONTRAT (`data-dictionary.md:418-425`).
 *
 * `total` repasse en CENTIMES : le back sert des euros décimaux, le domaine ne
 * connaît que des entiers, et le formatage n'arrive qu'à l'affichage.
 */
export function depuisResumeActivite(brut: PartnerSummary): ResumeActivite {
  return {
    total: centimesDepuis(brut, "total_received"),
    nombre: brut.transaction_count,
    depuis: horodatageIso(brut.period_from, "period_from"),
    jusqua: horodatageIso(brut.period_to, "period_to"),
    estOfficiel: brut.is_official_partner,
  };
}

/**
 * `DailyRevenueItem` → `JourneeRecettes`.
 *
 * ⚠ Le type d'entrée vient d'une route que NOUS proposons — le contrat n'a
 * aucune série journalière. Voir `types/api.ts`.
 *
 * `jour` reste une chaîne `YYYY-MM-DD` et n'est PAS converti en horodatage : ce
 * n'est pas un instant, c'est une journée. La convertir en millisecondes
 * introduirait un fuseau là où il n'y en a pas, et deux postes réglés
 * différemment n'afficheraient pas les mêmes barres.
 */
export function depuisJourneeRecettes(brut: DailyRevenueItem): JourneeRecettes {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(brut.day)) {
    throw new ErreurService(
      "reponse_illisible",
      `Réponse du serveur illisible : day n'est pas une date YYYY-MM-DD (${brut.day}).`,
      { champ: "day" },
    );
  }
  return {
    jour: brut.day,
    total: centimesDepuis(brut, "total_received"),
    nombre: brut.transaction_count,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. ENCAISSEMENT
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `ResolvedTokenItem` → `JetonResolu`.
 *
 * ⚠ Le type d'entrée vient d'une route que NOUS proposons — le contrat n'a
 * aucune lecture de jeton sans consommation (divergence D6). Voir
 * `types/api.ts`.
 *
 * `montant` repasse en CENTIMES : le back sert des euros décimaux
 * (`money.rs:145`), le domaine ne connaît que des entiers.
 *
 * `expireA` devient un NOMBRE de millisecondes. C'est la seule conversion qui
 * permette au compte à rebours de compter, et `horodatage` lève si le serveur
 * envoie autre chose qu'une date — un compte à rebours alimenté par `NaN`
 * afficherait un jeton éternellement valide.
 */
export function depuisJetonResolu(brut: ResolvedTokenItem): JetonResolu {
  return {
    jti: brut.jti,
    codeCourt: brut.short_code,
    montant: centimesDepuis(brut, "amount"),
    beneficiaire: brut.customer_label,
    expireA: horodatage(brut.expires_at, "expires_at"),
  };
}

/**
 * `PaymentResponse` → `EncaissementAccepte`.
 *
 * ✅ Le type d'entrée est celui du CONTRAT (`data-dictionary.md:443-451`).
 *
 * `complement` porte les deux choses que le serveur ne dit pas :
 *
 *   - `beneficiaire` — `PaymentResponse` ne renvoie ni identité ni
 *     `customer_label`. L'écran le tient du jeton résolu, un pas plus tôt.
 *   - `rejoue` — un règlement rejoué rend `200` avec exactement la même forme
 *     et `status: "settled"` (:645). Rien ne le distingue. Seul l'appelant sait
 *     s'il rejouait, parce que c'est lui qui a renvoyé.
 *
 * Le paramètre est obligatoire : la signature dit « ce que le serveur ne
 * fournit pas, dis-le-moi » plutôt que d'inventer une valeur par défaut.
 */
export function depuisEncaissement(
  brut: PaymentResponse,
  complement: { beneficiaire: string; rejoue: boolean },
): EncaissementAccepte {
  return {
    reference: brut.id,
    jti: brut.jti,
    montant: centimesDepuis(brut, "amount"),
    regleA: horodatage(brut.occurred_at, "occurred_at"),
    modeSaisie: brut.entry_mode,
    beneficiaire: complement.beneficiaire,
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
