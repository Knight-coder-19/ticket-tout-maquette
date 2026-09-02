/**
 * Magasin de donnees en memoire.
 * Il tient lieu de backend le temps que l'API reelle existe : les routes
 * de `src/app/api` lisent et ecrivent ici, et nulle part ailleurs.
 *
 * Regle monetaire : tous les montants sont des entiers de centimes.
 * Aucun flottant ne traverse ce fichier (T. Vignal). La conversion vers les
 * euros decimaux que sert le back a lieu au moment de repondre, dans
 * `mocks/enveloppe.ts`, jamais ici.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE MODÈLE EST CELUI DU BACK
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le salarie fixe le montant a l'emission ; les fonds sont **reserves** ; le
 * partenaire regle sur une reference de jeton, sans jamais saisir de montant.
 * Sources : `core/src/payments/authorize.rs:1-3`, `settle.rs:1-3`,
 * `expire.rs:1-3`, et `docs/data-dictionary.md:401-412` et :437-451.
 *
 * Trois invariants du back sont tenus ici par construction :
 *
 *   I3  `held <= settled`, et `available = settled - held` jamais negatif
 *       (data-model.md:56-64) : `emettreJeton` refuse si le disponible ne
 *       couvre pas le montant.
 *   I4  `held` egale la somme des jetons **actifs** du compte
 *       (data-model.md:95-98) : `held` n'est pas stocke, il est **calcule**.
 *       Un cache ne peut pas deriver s'il n'existe pas.
 *   I6  un jeton n'est encaisse qu'une fois (data-model.md:114-121) : un
 *       jeton quitte `active` pour exactement un etat terminal.
 */

import type {
  Identifiant,
  MontantCentimes,
  StatutPartenaire,
  StatutTransaction,
} from "@/types/domaine";

/** Duree de validite d'un jeton, en millisecondes. `TOKEN_TTL_SECONDS=300`. */
export const TTL_JETON = 5 * 60 * 1000;

/** Un salarie suspendu conserve son solde mais ne peut plus emettre. */
export type StatutSalarie = "actif" | "suspendu";

export interface SalarieMagasin {
  id: Identifiant;
  nom: string;
  employeur: string;
  statut: StatutSalarie;
  /** Entier de centimes. C'est `balance_settled` : le total possede. */
  soldeCentimes: MontantCentimes;
}

export interface PartenaireMagasin {
  id: Identifiant;
  nom: string;
  ville: string;
  statut: StatutPartenaire;
}

/**
 * Les quatre etats d'un jeton.
 * Identiques a l'ENUM `token_status` (`migrations/0001_schema.sql:10`).
 */
export type StatutJeton = "active" | "consumed" | "expired" | "cancelled";

/** Comment le partenaire a presente le jeton. ENUM `entry_mode` (:13). */
export type ModeSaisie = "qr_scan" | "short_code";

/**
 * Un jeton de paiement.
 * Colonnes reprises de `payment_tokens` (`migrations/0001_schema.sql:142-154`).
 */
export interface JetonMagasin {
  jti: Identifiant;
  /** Huit caracteres, sans separateur. L'affichage `XXXX-XXXX` est cosmetique. */
  shortCode: string;
  employeeId: Identifiant;
  /** Entier de centimes. `CHECK (amount > 0)`, :151. */
  montantCentimes: MontantCentimes;
  statut: StatutJeton;
  /** Date ISO 8601. */
  issuedAt: string;
  /** Date ISO 8601. */
  expiresAt: string;
  /** Date ISO 8601 du passage a un etat terminal, `null` tant qu'actif (:153). */
  resolvedAt: string | null;
}

/** Un reglement ecrit au registre. Colonnes de `payments` (:190-197). */
export interface PaiementMagasin {
  id: Identifiant;
  /** Unique : c'est la protection contre le double encaissement (I6). */
  jti: Identifiant;
  partenaireId: Identifiant;
  montantCentimes: MontantCentimes;
  modeSaisie: ModeSaisie;
  /** Date ISO 8601. `= scanned_at`, ce que le commercant reconnait. */
  occurredAt: string;
  /** Date ISO 8601. Moment d'arrivee au serveur. */
  syncedAt: string;
}

export interface TransactionMagasin {
  id: Identifiant;
  /** Date ISO 8601. */
  date: string;
  salarieId: Identifiant;
  partenaireId: Identifiant;
  jetonToken: string | null;
  /** Entier de centimes. */
  montantCentimes: MontantCentimes;
  statut: StatutTransaction;
}

export interface Magasin {
  salaries: SalarieMagasin[];
  partenaires: PartenaireMagasin[];
  /** Indexes par `jti`. */
  jetons: Map<Identifiant, JetonMagasin>;
  paiements: PaiementMagasin[];
  transactions: TransactionMagasin[];
}

/**
 * Jeu de donnees de demonstration.
 * Il est choisi pour que chaque refus soit atteignable depuis l'interface :
 * - SAL-001 : solde confortable, le parcours nominal ;
 * - SAL-002 : solde faible, le refus pour montant superieur au disponible ;
 * - SAL-003 : compte suspendu, le refus de compte.
 */
function donneesInitiales(): Magasin {
  return {
    salaries: [
      { id: "SAL-001", nom: "Amelie Roussel", employeur: "Mairie de Cotonou", statut: "actif", soldeCentimes: 15_000 },
      { id: "SAL-002", nom: "Bastien Nkoue", employeur: "Mairie de Cotonou", statut: "actif", soldeCentimes: 350 },
      { id: "SAL-003", nom: "Clara Doumbia", employeur: "Office du tourisme", statut: "suspendu", soldeCentimes: 0 },
    ],
    partenaires: [
      { id: "PRT-001", nom: "Boulangerie du Marche", ville: "Cotonou", statut: "valide" },
      { id: "PRT-002", nom: "Librairie Les Palmiers", ville: "Porto-Novo", statut: "en_attente" },
    ],
    jetons: new Map<Identifiant, JetonMagasin>(),
    paiements: [],
    transactions: [
      { id: "TRX-001", date: "2026-08-28T09:14:00.000Z", salarieId: "SAL-001", partenaireId: "PRT-001", jetonToken: null, montantCentimes: 1_250, statut: "validee" },
      { id: "TRX-002", date: "2026-08-30T12:02:00.000Z", salarieId: "SAL-002", partenaireId: "PRT-001", jetonToken: null, montantCentimes: 480, statut: "validee" },
    ],
  };
}

/*
 * En developpement, Next recharge les modules a chaud : sans cette
 * accroche, un jeton emis disparaitrait avant d'etre resolu. Le magasin est
 * donc epingle sur globalThis, une seule fois par processus.
 */
const CLE_MAGASIN = "__carteproMagasin__";
type PorteeGlobale = typeof globalThis & Record<typeof CLE_MAGASIN, Magasin | undefined>;
const portee = globalThis as PorteeGlobale;

export const magasin: Magasin =
  portee[CLE_MAGASIN] ?? (portee[CLE_MAGASIN] = donneesInitiales());

/* ═══════════════════════════════════════════════════════════════════════════
 * REFERENTIEL
 * ═══════════════════════════════════════════════════════════════════════════ */

export function trouverSalarie(id: string): SalarieMagasin | undefined {
  return magasin.salaries.find((salarie) => salarie.id === id);
}

export function trouverPartenaire(id: string): PartenaireMagasin | undefined {
  return magasin.partenaires.find((partenaire) => partenaire.id === id);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CODES COURTS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Alphabet de `crypto/short_code.rs:1-2` : huit caracteres pris dans
 * `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, sans `0`, `O`, `1`, `I` ni `l`. Le code
 * est lu a voix haute au comptoir : toute paire ambigue est exclue.
 */
const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGUEUR_CODE = 8;

/**
 * Tire un caractere uniformement, par rejet.
 *
 * L'alphabet compte 31 caracteres, qui ne divise pas 256 : un simple
 * `octet % 31` favoriserait les premiers caracteres. On rejette les octets
 * au-dela du plus grand multiple de 31 inferieur a 256, ce qui retablit
 * l'uniformite. Ce n'est pas du zele : un tirage biaise reduit l'espace
 * reellement atteignable d'un code que quelqu'un pourrait deviner.
 */
function caractereAleatoire(): string {
  const taille = ALPHABET_CODE.length;
  const plafond = Math.floor(256 / taille) * taille;
  const octet = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(octet);
    const tire = octet[0] ?? 0;
    if (tire < plafond) return ALPHABET_CODE.charAt(tire % taille);
  }
}

function nouveauShortCode(): string {
  let valeur = "";
  for (let i = 0; i < LONGUEUR_CODE; i += 1) valeur += caractereAleatoire();
  return valeur;
}

/**
 * Normalise une saisie de comptoir : majuscules, sans separateur ni espace.
 * Le contrat affiche `"K7M2-P4XQ"` (data-dictionary.md:405) ; le tiret est
 * une aide a la lecture, pas une partie du code.
 */
export function normaliserShortCode(saisie: string): string {
  return saisie.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/** Met le code au format d'affichage `XXXX-XXXX` (`short_code.rs:3`). */
export function formaterShortCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * EXPIRATION — LA LIBERATION PARESSEUSE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Fait passer a `expired` tout jeton actif dont l'echeance est atteinte.
 *
 * `expire.rs:1-3` : « move due tokens to expired and release their holds […]
 * called by the worker and **lazily when a balance is read** ». Il n'y a pas
 * de worker dans les mocks, donc seule la voie paresseuse existe : chaque
 * route l'appelle avant de lire ou d'ecrire quoi que ce soit.
 *
 * La reservation se libere d'elle-meme, sans ligne de code dediee : `held`
 * est la somme des jetons **actifs**, et le jeton vient de cesser de l'etre.
 */
export function libererJetonsExpires(maintenant: number): number {
  let liberes = 0;
  for (const [jti, jeton] of magasin.jetons) {
    if (jeton.statut !== "active") continue;
    if (Date.parse(jeton.expiresAt) > maintenant) continue;
    magasin.jetons.set(jti, {
      ...jeton,
      statut: "expired",
      resolvedAt: new Date(maintenant).toISOString(),
    });
    liberes += 1;
  }
  return liberes;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SOLDES
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface SoldeMagasin {
  /** Total possede. Entier de centimes. */
  settledCentimes: MontantCentimes;
  /** Reserve par les jetons actifs. Entier de centimes. */
  heldCentimes: MontantCentimes;
  /** `settled - held`. C'est ce nombre qu'on affiche en grand. */
  disponibleCentimes: MontantCentimes;
}

/** Les jetons encore actifs d'un salarie, apres liberation des expires. */
export function jetonsActifsDe(employeeId: string, maintenant: number): JetonMagasin[] {
  libererJetonsExpires(maintenant);
  return [...magasin.jetons.values()].filter(
    (jeton) => jeton.employeeId === employeeId && jeton.statut === "active",
  );
}

/**
 * Le solde d'un salarie.
 *
 * `held` est **calcule** depuis les jetons actifs, jamais stocke : c'est
 * l'invariant I4 (`data-model.md:95-98`) rendu vrai par construction plutot
 * que verifie apres coup. Le back, lui, stocke `balance_held` et le
 * recalcule — il a un journal a tenir, nous non.
 */
export function soldeDe(employeeId: string, maintenant: number): SoldeMagasin | undefined {
  const salarie = trouverSalarie(employeeId);
  if (!salarie) return undefined;

  const heldCentimes = jetonsActifsDe(employeeId, maintenant).reduce(
    (somme, jeton) => somme + jeton.montantCentimes,
    0,
  );
  return {
    settledCentimes: salarie.soldeCentimes,
    heldCentimes,
    disponibleCentimes: salarie.soldeCentimes - heldCentimes,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * JETONS
 * ═══════════════════════════════════════════════════════════════════════════ */

export type EchecEmission = "compte_inactif" | "solde_insuffisant" | "montant_invalide";

/**
 * Emet un jeton et reserve les fonds.
 *
 * L'ordre est celui d'`authorize.rs:1-2` : verifier le statut, verifier le
 * **disponible**, poser la reservation, tirer `jti` et `short_code`, inserer.
 * Le solde regle ne bouge pas — seul le disponible baisse, parce que la
 * reservation est un jeton actif de plus.
 */
export function emettreJeton(
  employeeId: string,
  montantCentimes: MontantCentimes,
  maintenant: number,
): { jeton: JetonMagasin } | { echec: EchecEmission } {
  const salarie = trouverSalarie(employeeId);
  if (!salarie || salarie.statut !== "actif") return { echec: "compte_inactif" };
  if (!Number.isInteger(montantCentimes) || montantCentimes <= 0) {
    return { echec: "montant_invalide" };
  }

  const solde = soldeDe(employeeId, maintenant);
  if (!solde || solde.disponibleCentimes < montantCentimes) {
    return { echec: "solde_insuffisant" };
  }

  /* `uq_active_short_code` : un code court actif est unique (:156). */
  const codesActifs = new Set(
    [...magasin.jetons.values()]
      .filter((jeton) => jeton.statut === "active")
      .map((jeton) => jeton.shortCode),
  );
  let shortCode = nouveauShortCode();
  while (codesActifs.has(shortCode)) shortCode = nouveauShortCode();

  const jeton: JetonMagasin = {
    jti: crypto.randomUUID(),
    shortCode,
    employeeId: salarie.id,
    montantCentimes,
    statut: "active",
    issuedAt: new Date(maintenant).toISOString(),
    expiresAt: new Date(maintenant + TTL_JETON).toISOString(),
    resolvedAt: null,
  };
  magasin.jetons.set(jeton.jti, jeton);
  return { jeton };
}

export function trouverJetonParJti(jti: string): JetonMagasin | undefined {
  return magasin.jetons.get(jti);
}

/**
 * Retrouve un jeton par son code court, parmi les **actifs** seulement.
 *
 * L'unicite du code court ne porte que sur les jetons actifs (index partiel
 * `uq_active_short_code`) : un code deja consomme peut avoir ete reattribue,
 * et le chercher parmi les jetons termines rendrait une reponse arbitraire.
 */
export function trouverJetonParCode(saisie: string): JetonMagasin | undefined {
  const code = normaliserShortCode(saisie);
  return [...magasin.jetons.values()].find(
    (jeton) => jeton.statut === "active" && jeton.shortCode === code,
  );
}

/**
 * Resout une reference, `jti` ou code court.
 * `TokenRef` de `payments/mod.rs:1` : « scanned jti or typed short code ».
 */
export function trouverJetonParReference(reference: string): JetonMagasin | undefined {
  return trouverJetonParJti(reference) ?? trouverJetonParCode(reference);
}

/**
 * Annule un jeton actif et libere sa reservation.
 *
 * C'est `cancel_token` (`payments/repo.rs:1`), servi par
 * `DELETE /api/v1/me/payment-tokens/{jti}` (data-dictionary.md:412). C'est le
 * seul mecanisme specifie pour rendre les fonds d'un jeton qu'on ne veut plus :
 * regenerer un code, c'est annuler puis emettre.
 */
export function annulerJeton(jti: string, maintenant: number): JetonMagasin | undefined {
  const jeton = magasin.jetons.get(jti);
  if (!jeton || jeton.statut !== "active") return undefined;
  const annule: JetonMagasin = {
    ...jeton,
    statut: "cancelled",
    resolvedAt: new Date(maintenant).toISOString(),
  };
  magasin.jetons.set(jti, annule);
  return annule;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REGLEMENT
 * ═══════════════════════════════════════════════════════════════════════════ */

export function trouverPaiementParJti(jti: string): PaiementMagasin | undefined {
  return magasin.paiements.find((paiement) => paiement.jti === jti);
}

/**
 * Consomme le jeton, debite le solde regle, ecrit le paiement.
 *
 * Le disponible ne bouge PAS a cet instant, et c'est voulu : il avait deja
 * baisse a l'emission, quand les fonds ont ete reserves. Ici la reservation
 * disparait (le jeton n'est plus actif) et le solde regle baisse du meme
 * montant. Les deux mouvements se compensent exactement — c'est la partie
 * double vue depuis le compte du salarie.
 */
export function reglerJeton(
  jeton: JetonMagasin,
  partenaireId: string,
  modeSaisie: ModeSaisie,
  scannedAt: string,
  maintenant: number,
): PaiementMagasin {
  magasin.jetons.set(jeton.jti, {
    ...jeton,
    statut: "consumed",
    resolvedAt: new Date(maintenant).toISOString(),
  });

  const salarie = trouverSalarie(jeton.employeeId);
  if (salarie) salarie.soldeCentimes -= jeton.montantCentimes;

  const paiement: PaiementMagasin = {
    id: crypto.randomUUID(),
    jti: jeton.jti,
    partenaireId,
    montantCentimes: jeton.montantCentimes,
    modeSaisie,
    occurredAt: scannedAt,
    syncedAt: new Date(maintenant).toISOString(),
  };
  magasin.paiements.push(paiement);
  return paiement;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ANCIEN MODÈLE — conserve uniquement pour les deux routes historiques
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `POST /api/payment-tokens` et `GET /api/payment-tokens/{token}` servent le
 * modele ou le caissier saisissait le montant. Les ecrans d'encaissement en
 * dependent encore (`EtapeMontant.tsx` demande le montant a la caisse), et la
 * consigne est de ne toucher a aucun ecran.
 *
 * ⚠ Ces structures sont a supprimer en meme temps que ces deux routes, le jour
 * ou le parcours partenaire sera refait sur le modele du back — c'est la
 * divergence D4 de `front/docs/contrat-api.md`. Ne rien ajouter ici.
 */

/** ANCIEN MODÈLE. Voir l'avertissement ci-dessus. */
export interface JetonPaiement {
  token: string;
  employeeId: Identifiant;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

const CLE_JETONS_HERITES = "__carteproJetonsHerites__";
type PorteeHeritee = typeof globalThis &
  Record<typeof CLE_JETONS_HERITES, Map<string, JetonPaiement> | undefined>;
const porteeHeritee = globalThis as PorteeHeritee;

const jetonsHerites: Map<string, JetonPaiement> =
  porteeHeritee[CLE_JETONS_HERITES] ??
  (porteeHeritee[CLE_JETONS_HERITES] = new Map<string, JetonPaiement>());

/** ANCIEN MODÈLE. */
export function trouverJeton(token: string): JetonPaiement | undefined {
  return jetonsHerites.get(token);
}

/** ANCIEN MODÈLE. */
export function jetonExiste(token: string): boolean {
  return jetonsHerites.has(token);
}

/** ANCIEN MODÈLE. */
export function enregistrerJeton(jeton: JetonPaiement): JetonPaiement {
  jetonsHerites.set(jeton.token, jeton);
  return jeton;
}

/** ANCIEN MODÈLE. */
export function marquerJetonUtilise(
  token: string,
  utiliseLe: string,
): JetonPaiement | undefined {
  const jeton = jetonsHerites.get(token);
  if (!jeton) return undefined;
  const consomme: JetonPaiement = { ...jeton, usedAt: utiliseLe };
  jetonsHerites.set(token, consomme);
  return consomme;
}

/** ANCIEN MODÈLE. */
export function jetonEstExpire(jeton: JetonPaiement, maintenant: number): boolean {
  return Date.parse(jeton.expiresAt) <= maintenant;
}
