/**
 * Le registre : le journal comptable du dispositif.
 *
 * En ajout seul, en partie double, chaine par hachage. C'est la piece du
 * magasin qui simule `ledger_operations`, `ledger_entries`, `accounts` et
 * `compensations` (`0001_schema.sql:47-67`, `:160-188`, `:229-237`).
 *
 * ═════════════════════════════════════════════════════════════════════════
 * REGLE R1 : UNE ECRITURE VALIDEE N'EST NI MODIFIEE NI SUPPRIMEE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Cote base, trois declencheurs `forbid_mutation()` refusent `UPDATE`,
 * `DELETE` et `TRUNCATE` sur `ledger_entries` et `ledger_operations`
 * (`:286-308`). Ici, deux choses en tiennent lieu :
 *
 *   1. chaque ecriture et chaque operation est GELEE a l'insertion
 *      (`Object.freeze`). Les modules ES sont en mode strict : une affectation
 *      sur un objet gele leve, elle n'echoue pas en silence. Le code ne peut
 *      donc pas modifier une ecriture, meme par erreur ;
 *
 *   2. rien dans ce fichier ne retire jamais un element du tableau. Une
 *      annulation AJOUTE une operation inverse ; elle ne touche pas
 *      l'originale.
 *
 * Le gel protege le code de lui-meme. Il ne protege pas d'une alteration au
 * niveau du stockage -- l'equivalent d'un `UPDATE` passe outre les
 * declencheurs. C'est precisement le role de la chaine de hachage :
 * `verifierChaine` detecte une telle alteration et dit ou.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * LES INVARIANTS TENUS ICI
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   I1  partie double equilibree (`data-model.md:28-45`) : `posterOperation`
 *       ecrit EXACTEMENT deux ecritures, un debit et un credit, du meme
 *       montant, egal a celui de l'operation. Rien d'autre n'ecrit ici.
 *   I2  le solde d'un compte est le reflet de ses ecritures (`:47-54`) : le
 *       solde stocke est un cache, `recalculerSolde` le refait depuis le
 *       journal, et l'essai verifie que les deux coincident.
 *   I3  aucun compte d'utilisateur negatif (`:56-64`), les comptes systeme
 *       exemptes -- c'est le solde negatif de MINISTRY_ISSUANCE qui mesure le
 *       total emis.
 *   I5  chaine continue et verifiable (`:104-112`).
 *   I8  ajout seul (`:132-140`).
 */

import { sha256 } from "@/mocks/sha256";
import type { Identifiant, MontantCentimes } from "@/types/domaine";

/* ═══════════════════════════════════════════════════════════════════════════
 * LE HACHAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * L'empreinte qui precede la premiere ecriture. 32 octets a zero.
 * `GENESIS_HASH` de `ledger/hash.rs:1`.
 */
export const GENESIS_HASH = "0".repeat(64);

/**
 * LA SERIALISATION CANONIQUE. Toute modification invalide la chaine existante.
 *
 * `ledger/hash.rs:1-2` impose cette signature :
 * `entry_hash(seq, operation_id, account_id, direction, amount, recorded_at,
 * prev_hash)` -- sept champs, dans cet ordre, et le commentaire du fichier Rust
 * demande explicitement que la serialisation soit documentee « any change to it
 * invalidates the existing chain ».
 *
 * Forme retenue : les sept champs joints par U+0000. Le separateur ne peut
 * apparaitre dans aucun d'eux -- ce sont des entiers, des UUID, des mots d'une
 * enumeration, une date ISO 8601 et un hexadecimal. Deux ecritures differentes
 * ne peuvent donc pas produire la meme chaine par un decoupage ambigu, ce qui
 * arriverait avec un separateur present dans les donnees.
 *
 * `seq` fait partie du hachage : reordonner deux ecritures les invalide toutes
 * les deux, meme si leur contenu est intact.
 */
export function empreinteEcriture(champs: {
  seq: number;
  operationId: string;
  accountId: string;
  direction: DirectionEcriture;
  amountCentimes: number;
  recordedAt: string;
  prevHash: string;
}): string {
  return sha256(
    [
      String(champs.seq),
      champs.operationId,
      champs.accountId,
      champs.direction,
      String(champs.amountCentimes),
      champs.recordedAt,
      champs.prevHash,
    ].join("\u0000"),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LES TYPES
 * ═══════════════════════════════════════════════════════════════════════════ */

/** ENUM `entry_direction` (`0001_schema.sql:12`). */
export type DirectionEcriture = "debit" | "credit";

/** ENUM `operation_kind` (`:11`). */
export type NatureOperation = "topup" | "payment" | "compensation" | "closure_forfeit";

/** ENUM `account_owner` (`:8`). */
export type TypeProprietaire = "employee" | "partner" | "system";

/** Colonnes d'`accounts` (`:47-67`), sans les reservations, portees ailleurs. */
export interface CompteRegistre {
  id: Identifiant;
  ownerType: TypeProprietaire;
  /** `null` pour un compte systeme, renseigne sinon (`system_account_shape`). */
  ownerId: Identifiant | null;
  /** Renseigne pour un compte systeme, `null` sinon. */
  systemCode: string | null;
  /**
   * CACHE du solde, en centimes. La verite est le journal : `recalculerSolde`
   * le refait depuis les ecritures, et l'invariant I2 exige que les deux
   * coincident.
   */
  soldeCentimes: MontantCentimes;
}

/** Colonnes de `ledger_operations` (`:160-169`). */
export interface OperationRegistre {
  readonly id: Identifiant;
  readonly kind: NatureOperation;
  readonly amountCentimes: MontantCentimes;
  readonly memo: string | null;
  readonly createdBy: Identifiant | null;
  /** Date ISO 8601 du fait. */
  readonly occurredAt: string;
  /** Date ISO 8601 de l'enregistrement. */
  readonly recordedAt: string;
}

/** Colonnes de `ledger_entries` (`:173-185`). */
export interface EcritureRegistre {
  readonly seq: number;
  readonly operationId: Identifiant;
  readonly accountId: Identifiant;
  readonly direction: DirectionEcriture;
  readonly amountCentimes: MontantCentimes;
  readonly recordedAt: string;
  readonly prevHash: string;
  readonly hash: string;
}

/** Colonnes de `compensations` (`:229-235`). */
export interface CompensationRegistre {
  readonly operationId: Identifiant;
  readonly originalOperationId: Identifiant;
  readonly reason: string;
  readonly approvedBy: Identifiant;
}

export interface Registre {
  comptes: CompteRegistre[];
  operations: OperationRegistre[];
  ecritures: EcritureRegistre[];
  compensations: CompensationRegistre[];
}

/* ═══════════════════════════════════════════════════════════════════════════
 * L'ETAT
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Identifiant du compte d'un salarie ou d'un partenaire. */
export function idCompte(proprietaire: string): Identifiant {
  return `ACC-${proprietaire}`;
}

const MINISTRY_ISSUANCE = "ACC-MINISTRY_ISSUANCE";
const CLOSURE_FORFEIT = "ACC-CLOSURE_FORFEIT";

function comptesInitiaux(): CompteRegistre[] {
  const utilisateur = (ownerType: TypeProprietaire, ownerId: string): CompteRegistre => ({
    id: idCompte(ownerId),
    ownerType,
    ownerId,
    systemCode: null,
    soldeCentimes: 0,
  });
  return [
    { id: MINISTRY_ISSUANCE, ownerType: "system", ownerId: null, systemCode: "MINISTRY_ISSUANCE", soldeCentimes: 0 },
    { id: CLOSURE_FORFEIT, ownerType: "system", ownerId: null, systemCode: "CLOSURE_FORFEIT", soldeCentimes: 0 },
    utilisateur("employee", "SAL-001"),
    utilisateur("employee", "SAL-002"),
    utilisateur("employee", "SAL-003"),
    ...["PRT-001", "PRT-002", "PRT-003", "PRT-004", "PRT-005", "PRT-006", "PRT-007",
        "PRT-008", "PRT-009", "PRT-010", "PRT-011", "PRT-012", "PRT-013", "PRT-014",
        "PRT-015"].map((id) => utilisateur("partner", id)),
  ];
}

const CLE = "__carteproRegistre__";
type Portee = typeof globalThis & Record<typeof CLE, Registre | undefined>;
const portee = globalThis as Portee;

export const registre: Registre =
  portee[CLE] ??
  (portee[CLE] = {
    comptes: comptesInitiaux(),
    operations: [],
    ecritures: [],
    compensations: [],
  });

export function trouverCompte(id: string): CompteRegistre | undefined {
  return registre.comptes.find((compte) => compte.id === id);
}

export function soldeDuCompte(id: string): MontantCentimes {
  return trouverCompte(id)?.soldeCentimes ?? 0;
}

/**
 * `recompute_balance` (`ledger/balance.rs:1`) : refait le solde depuis le
 * journal, sans regarder le cache. C'est ce qui rend l'invariant I2
 * verifiable au lieu d'etre suppose.
 */
export function recalculerSolde(id: string): MontantCentimes {
  return registre.ecritures
    .filter((e) => e.accountId === id)
    .reduce((somme, e) => somme + (e.direction === "credit" ? e.amountCentimes : -e.amountCentimes), 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * L'ECRITURE
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface DemandeOperation {
  kind: NatureOperation;
  amountCentimes: MontantCentimes;
  /** Compte debite : celui d'ou l'argent part. */
  debiter: string;
  /** Compte credite : celui ou l'argent arrive. */
  crediter: string;
  memo?: string | null;
  createdBy?: string | null;
  /** Date ISO 8601 du fait. Par defaut, l'instant d'enregistrement. */
  occurredAt?: string;
  quand: number;
  /** Identifiant imposé, pour un jeu de demonstration reproductible. */
  id?: string;
}

/**
 * `post_operation` (`ledger/mod.rs:1-2`) : le SEUL point d'ecriture du journal.
 *
 * Il ecrit l'operation, ses DEUX ecritures chainees et les deux caches de
 * solde. Rien d'autre dans le projet n'ajoute a `operations`, `ecritures` ou
 * ne touche `soldeCentimes` -- c'est la regle R2, et c'est ce qui rend I1
 * vrai par construction plutot que verifie apres coup.
 *
 * L'ordre debit puis credit est fixe : il fait partie de ce qui est hache.
 */
export function posterOperation(demande: DemandeOperation): OperationRegistre {
  if (!Number.isInteger(demande.amountCentimes) || demande.amountCentimes <= 0) {
    throw new Error(`Montant d'opération invalide : ${demande.amountCentimes}`);
  }
  const debite = trouverCompte(demande.debiter);
  const credite = trouverCompte(demande.crediter);
  if (!debite || !credite) throw new Error("Compte inconnu dans une opération");
  if (debite.id === credite.id) throw new Error("Une opération ne peut pas se débiter elle-même");

  const recordedAt = new Date(demande.quand).toISOString();
  const operation: OperationRegistre = Object.freeze({
    id: demande.id ?? crypto.randomUUID(),
    kind: demande.kind,
    amountCentimes: demande.amountCentimes,
    memo: demande.memo ?? null,
    createdBy: demande.createdBy ?? null,
    occurredAt: demande.occurredAt ?? recordedAt,
    recordedAt,
  });
  registre.operations.push(operation);

  for (const [compte, direction] of [
    [debite, "debit"],
    [credite, "credit"],
  ] as const) {
    const seq = registre.ecritures.length + 1;
    const prevHash = registre.ecritures.at(-1)?.hash ?? GENESIS_HASH;
    const champs = {
      seq,
      operationId: operation.id,
      accountId: compte.id,
      direction,
      amountCentimes: operation.amountCentimes,
      recordedAt,
      prevHash,
    };
    registre.ecritures.push(
      Object.freeze({ ...champs, hash: empreinteEcriture(champs) }),
    );
    compte.soldeCentimes +=
      direction === "credit" ? operation.amountCentimes : -operation.amountCentimes;
  }

  return operation;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LA VERIFICATION
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface VerificationChaine {
  valid: boolean;
  checkedEntries: number;
  /** `seq` de la premiere ecriture incoherente, `null` si la chaine tient. */
  firstInvalidSeq: number | null;
}

/**
 * `verify_chain(from_seq)` (`ledger/balance.rs:1-2`) : rend le premier `seq`
 * incoherent.
 *
 * Deux controles par ecriture, et il faut les deux :
 *   - `prev_hash` est bien l'empreinte de l'ecriture precedente -- sans quoi
 *     on pourrait retirer une ecriture du milieu ;
 *   - `hash` est bien ce que redonne `empreinteEcriture` sur ses champs --
 *     sans quoi on pourrait changer un montant.
 *
 * `checkedEntries` compte les ecritures REELLEMENT examinees, et s'arrete a la
 * premiere faute : c'est ce que dit le contrat, `checked_entries` a cote de
 * `first_invalid_seq` (`data-dictionary.md:576-580`).
 */
export function verifierChaine(depuisSeq = 1): VerificationChaine {
  let precedent = depuisSeq <= 1 ? GENESIS_HASH : (registre.ecritures[depuisSeq - 2]?.hash ?? GENESIS_HASH);
  let verifiees = 0;

  for (const ecriture of registre.ecritures) {
    if (ecriture.seq < depuisSeq) continue;
    verifiees += 1;

    const attendu = empreinteEcriture({
      seq: ecriture.seq,
      operationId: ecriture.operationId,
      accountId: ecriture.accountId,
      direction: ecriture.direction,
      amountCentimes: ecriture.amountCentimes,
      recordedAt: ecriture.recordedAt,
      prevHash: ecriture.prevHash,
    });

    if (ecriture.prevHash !== precedent || ecriture.hash !== attendu) {
      return { valid: false, checkedEntries: verifiees, firstInvalidSeq: ecriture.seq };
    }
    precedent = ecriture.hash;
  }

  return { valid: true, checkedEntries: verifiees, firstInvalidSeq: null };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * L'ANNULATION
 * ═══════════════════════════════════════════════════════════════════════════ */

export type EchecCompensation =
  | "introuvable"
  | "deja_compensee"
  | "compensation_de_compensation"
  | "motif_manquant";

export function trouverOperation(id: string): OperationRegistre | undefined {
  return registre.operations.find((o) => o.id === id);
}

export function ecrituresDe(operationId: string): EcritureRegistre[] {
  return registre.ecritures.filter((e) => e.operationId === operationId);
}

export function compensationDe(operationId: string): CompensationRegistre | undefined {
  return registre.compensations.find((c) => c.originalOperationId === operationId);
}

/**
 * `compensate(tx, admin, original_operation_id, reason)`
 * (`corrections/mod.rs:1-3`) : lit l'operation d'origine, poste l'operation
 * INVERSE par `post_operation`, insere dans `compensations`.
 *
 * L'originale n'est pas touchee. Elle ne peut pas l'etre : elle est gelee, et
 * rien ici ne la relit que pour en copier les comptes. Apres l'appel, elle est
 * bit pour bit celle d'avant -- l'essai le verifie en comparant son empreinte
 * avant et apres.
 *
 * Trois refus, tous portes ici et non par l'ecran :
 *   - motif absent : « Reason and admin are mandatory » (`corrections/mod.rs:2`) ;
 *   - compenser une compensation : refuse (decision 4, `:3`) ;
 *   - compenser deux fois la meme operation : refuse. Ce dernier n'est pas
 *     ecrit dans leur commentaire, mais `idx_compensations_original` (`:237`)
 *     et la logique le demandent -- deux inverses rendraient le solde faux
 *     d'un montant entier.
 */
export function compenser(
  operationId: string,
  administrateurId: string,
  motif: string | null,
  maintenant: number,
):
  | { operation: OperationRegistre; compensation: CompensationRegistre }
  | { echec: EchecCompensation } {
  const originale = trouverOperation(operationId);
  if (!originale) return { echec: "introuvable" };
  if (originale.kind === "compensation") return { echec: "compensation_de_compensation" };
  if (compensationDe(operationId)) return { echec: "deja_compensee" };

  const motifNettoye = motif !== null && motif.trim() !== "" ? motif.trim() : null;
  if (motifNettoye === null) return { echec: "motif_manquant" };

  const ecritures = ecrituresDe(operationId);
  const debitOrigine = ecritures.find((e) => e.direction === "debit");
  const creditOrigine = ecritures.find((e) => e.direction === "credit");
  if (!debitOrigine || !creditOrigine) return { echec: "introuvable" };

  /* L'inverse : ce qui etait credite est debite, et reciproquement. Les soldes
     reviennent donc exactement a leur etat d'avant l'operation annulee. */
  const operation = posterOperation({
    kind: "compensation",
    amountCentimes: originale.amountCentimes,
    debiter: creditOrigine.accountId,
    crediter: debitOrigine.accountId,
    memo: `Annulation de l'opération ${originale.id}`,
    createdBy: administrateurId,
    quand: maintenant,
  });

  const compensation: CompensationRegistre = Object.freeze({
    operationId: operation.id,
    originalOperationId: originale.id,
    reason: motifNettoye,
    approvedBy: administrateurId,
  });
  registre.compensations.push(compensation);

  return { operation, compensation };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LA LECTURE
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FiltreRegistre {
  /** Date ISO 8601 incluse. Compare a `occurredAt` de l'operation. */
  depuis?: string;
  /** Date ISO 8601 incluse. */
  jusqua?: string;
  /** Identifiant de partenaire : ne garde que les ecritures de son compte. */
  partenaireId?: string;
  kind?: NatureOperation;
}

/**
 * Les ecritures, LA PLUS RECENTE EN PREMIER.
 *
 * Le tri est `seq` decroissant, et c'est le seul ordre juste : `seq` est
 * l'ordre d'ecriture au journal, celui que la chaine de hachage fige. Trier par
 * date donnerait un ordre different de celui de la chaine des qu'une operation
 * porte un `occurred_at` anterieur a son enregistrement -- ce qui est le cas de
 * toute resynchronisation hors ligne.
 */
export function lireEcritures(filtre: FiltreRegistre): EcritureRegistre[] {
  const compteCible =
    filtre.partenaireId === undefined ? null : idCompte(filtre.partenaireId);

  return registre.ecritures
    .filter((ecriture) => {
      const operation = trouverOperation(ecriture.operationId);
      if (!operation) return false;
      if (filtre.kind !== undefined && operation.kind !== filtre.kind) return false;
      if (filtre.depuis !== undefined && operation.occurredAt < filtre.depuis) return false;
      if (filtre.jusqua !== undefined && operation.occurredAt > filtre.jusqua) return false;
      if (compteCible !== null && ecriture.accountId !== compteCible) return false;
      return true;
    })
    .slice()
    .sort((a, b) => b.seq - a.seq);
}
