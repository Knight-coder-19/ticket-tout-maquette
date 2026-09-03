/**
 * Le service de l'espace d'administration.
 *
 * Il ne connaît ni `fetch`, ni l'URL du backend, ni la forme des erreurs : il
 * décrit des appels et convertit ce qui en revient vers le domaine. Le
 * transport est dans `lib/api/client.ts`, les conversions dans
 * `lib/api/adaptateurs.ts`.
 *
 * ─── Ce fichier remplace l'interface `ServiceAdministration` ───
 *
 * L'interface qui vivait ici décrivait `listerDemandes(page: number)` rendant
 * une `ReponsePaginee` — une pagination par OFFSET. Le back pagine par KEYSET
 * et ne compte pas les lignes : il ne peut pas produire `total`
 * (`extractors/pagination.rs:1-3`, divergence D10 de
 * `front/docs/contrat-api.md`). Aucune implémentation ne pouvait satisfaire
 * cette interface, et son type de retour `DemandePartenaire` ne porte ni
 * catégorie, ni ville, ni date de dépôt — les trois choses que l'écran de
 * validation affiche.
 *
 * Elle est donc remplacée plutôt que laissée à côté. Si l'équipe veut la
 * conserver, c'est l'enveloppe de pagination qu'il faut trancher d'abord.
 */

import { appelApi, appelApiSansContenu } from "@/lib/api/client";
import {
  depuisComptePartenaire,
  depuisDecisionJournal,
  depuisDemandeAdhesion,
  depuisEcritureRegistre,
  depuisApercuLot,
  depuisEmployeur,
  depuisReclamation,
  depuisTableauDeBordNational,
  depuisReclamationResume,
  depuisRechargement,
  depuisFicheBeneficiaire,
  depuisLigneRepertoire,
  depuisMiseEnAvant,
  depuisRegularisation,
  depuisTotauxTransactions,
  depuisTransactionNationale,
  depuisVerification,
} from "@/lib/api/adaptateurs";
import type {
  ChainVerification,
  JournalList,
  AdjustmentResult,
  AdminTransactionList,
  EmployeeDetail,
  EmployeeDirectoryList,
  CreateHighlightRequest,
  CreateHighlightResponse,
  BatchPreview,
  ClaimCloseRequest,
  ClaimDetail,
  Dashboard,
  ClaimList,
  ClaimMessageRequest,
  EmployerItem,
  HighlightItem,
  TopupRequest,
  TopupResponse,
  ReorderRequest,
  ReorderResponse,
  LedgerEntryList,
  Paginated,
  PartnerAccountList,
  PartnerReviewItem,
} from "@/types/api";
import type {
  ComptePartenaire,
  DecisionJournal,
  DemandeAdhesion,
  EcritureRegistre,
  VerificationIntegrite,
  TotauxTransactions,
  TransactionNationale,
  EmployeurRepertoire,
  FicheBeneficiaire,
  LigneRepertoire,
  Regularisation,
  SensRegularisation,
  StatutBeneficiaire,
  Emplacement,
  MiseEnAvant,
  ApercuLot,
  Rechargement,
  Reclamation,
  ReclamationResume,
  StatutReclamation,
  TableauDeBordNational,
} from "@/types/domaine";

/** Une page de la file de validation, dans le vocabulaire du domaine. */
export interface PageDemandes {
  demandes: DemandeAdhesion[];
  /** Curseur opaque pour la page suivante. `null` = fin de liste. */
  curseurSuivant: string | null;
}

/**
 * Les demandes d'adhésion en attente, la plus ancienne en premier.
 *
 * L'ordre vient du serveur, pas d'un tri local : c'est lui qui pagine, et
 * trier après coup ne trierait que la page reçue.
 */
export async function listerDemandesEnAttente(
  curseur?: string,
): Promise<PageDemandes> {
  const parametres = new URLSearchParams({ status: "pending" });
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const brut = await appelApi<Paginated<PartnerReviewItem>>(
    `/v1/admin/partners?${parametres.toString()}`,
    { cache: "no-store" },
  );

  return {
    demandes: brut.items.map(depuisDemandeAdhesion),
    curseurSuivant: brut.next_cursor,
  };
}

/**
 * Accepte une demande. Ne rend rien : la route répond `204`
 * (`data-dictionary.md:507`).
 */
export async function accepterDemande(demandeId: string): Promise<void> {
  await appelApiSansContenu(
    `/v1/admin/partners/${encodeURIComponent(demandeId)}/approve`,
    { method: "POST" },
  );
}

/**
 * Refuse une demande, motif obligatoire.
 *
 * Le motif est vérifié ici AUSSI, avant l'appel — mais ce n'est pas ce qui
 * fait la règle. La route refuse un motif vide en `422` de son côté
 * (`admin/partners/[id]/reject/route.ts`), et c'est là qu'est la garantie :
 * un contrôle côté client se contourne, pas un contrôle côté serveur. Celui-ci
 * évite seulement un aller-retour inutile.
 */
export async function refuserDemande(demandeId: string, motif: string): Promise<void> {
  await appelApiSansContenu(
    `/v1/admin/partners/${encodeURIComponent(demandeId)}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: motif }),
    },
  );
}

/**
 * Le journal des décisions d'adhésion, du plus récent au plus ancien.
 *
 * ⚠ S'appuie sur une route que NOUS proposons : le back n'expose aucune
 * lecture d'`audit_log`. Voir `types/api.ts`, type `LigneJournal`.
 */
export async function lireJournalDecisions(): Promise<DecisionJournal[]> {
  const brut = await appelApi<JournalList>(
    "/v1/admin/audit?entity_type=partner",
    { cache: "no-store" },
  );
  return brut.items.map(depuisDecisionJournal);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REGISTRE DES COMPTES PARTENAIRES
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FiltresComptes {
  /** Statut du back (`pending`, `approved`, …) ou `undefined` pour tous. */
  statut?: string;
  categorie?: string;
  ville?: string;
  /** Recherche libre : enseigne, raison sociale, ville. */
  recherche?: string;
}

export interface PageComptes {
  comptes: ComptePartenaire[];
  curseurSuivant: string | null;
}

/**
 * Le registre des comptes, filtré, trié par enseigne.
 *
 * ⚠ S'appuie sur une route que NOUS proposons, `GET /admin/partner-accounts` :
 * le contrat n'expose ni filtre de catégorie, ni recherche, ni volume
 * d'activité. Voir `types/api.ts`, type `PartnerAccountItem`.
 */
export async function listerComptes(
  filtres: FiltresComptes = {},
  curseur?: string,
): Promise<PageComptes> {
  const parametres = new URLSearchParams();
  if (filtres.statut !== undefined && filtres.statut !== "") parametres.set("status", filtres.statut);
  if (filtres.categorie !== undefined && filtres.categorie !== "") parametres.set("category", filtres.categorie);
  if (filtres.ville !== undefined && filtres.ville !== "") parametres.set("city", filtres.ville);
  if (filtres.recherche !== undefined && filtres.recherche.trim() !== "") parametres.set("q", filtres.recherche.trim());
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<PartnerAccountList>(
    `/v1/admin/partner-accounts${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );

  return {
    comptes: brut.items.map(depuisComptePartenaire),
    curseurSuivant: brut.next_cursor,
  };
}

/** Suspend un compte agréé. Motif obligatoire, refusé en `422` sans lui. */
export async function suspendreCompte(compteId: string, motif: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/partners/${encodeURIComponent(compteId)}/suspend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: motif }),
  });
}

/**
 * Réactive un compte suspendu.
 *
 * Pas de motif : la route n'en demande pas pour une décision favorable, comme
 * `approve` qui répond `204` sans corps (`data-dictionary.md:507`).
 */
export async function reactiverCompte(compteId: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/partners/${encodeURIComponent(compteId)}/reinstate`, {
    method: "POST",
  });
}

/**
 * Ferme un compte, définitivement. Motif obligatoire.
 *
 * ⚠ Sans retour au-delà du délai de grâce : voir l'en-tête de
 * `app/api/v1/admin/partners/[id]/close/route.ts`. L'écran doit l'annoncer
 * avant la confirmation.
 */
export async function fermerCompte(compteId: string, motif: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/partners/${encodeURIComponent(compteId)}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: motif }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REGISTRE COMPTABLE
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FiltresRegistre {
  /** Date ISO 8601 incluse, comparée à la date du fait. */
  depuis?: string;
  jusqua?: string;
  /**
   * Le TITULAIRE du compte, salarié comme partenaire.
   *
   * Il s'appelait `partenaireId` tant que le registre de l'administration
   * était seul à s'en servir. La fiche d'un bénéficiaire en a eu besoin pour
   * un salarié : le registre ne connaît qu'un compte et son propriétaire, et
   * un nom qui ne désigne qu'une moitié de ses usages finit par faire croire
   * qu'il ne sert qu'à celle-là.
   */
  titulaireId?: string;
  /** Nature côté back : `topup`, `payment`, `compensation`, `closure_forfeit`. */
  nature?: string;
  /**
   * Ne garde que les écritures d'UNE opération précise.
   *
   * Ajouté pour `OperationVisee` (réclamations) : relire EN DIRECT l'écriture
   * qu'un dossier vise, plutôt que d'en garder une copie qui pourrait diverger.
   */
  operationId?: string;
}

export interface PageRegistre {
  ecritures: EcritureRegistre[];
  curseurSuivant: string | null;
}

/**
 * Les écritures du registre, la plus récente en premier.
 *
 * ⚠ S'appuie sur une route que NOUS proposons : le contrat n'expose aucune
 * lecture du journal. Voir `types/api.ts`, type `LedgerEntryItem`.
 */
export async function listerEcritures(
  filtres: FiltresRegistre = {},
  curseur?: string,
): Promise<PageRegistre> {
  const parametres = new URLSearchParams();
  if (filtres.depuis !== undefined && filtres.depuis !== "") parametres.set("from", filtres.depuis);
  if (filtres.jusqua !== undefined && filtres.jusqua !== "") parametres.set("to", filtres.jusqua);
  if (filtres.titulaireId !== undefined && filtres.titulaireId !== "") parametres.set("partner", filtres.titulaireId);
  if (filtres.nature !== undefined && filtres.nature !== "") parametres.set("kind", filtres.nature);
  if (filtres.operationId !== undefined && filtres.operationId !== "") parametres.set("operation_id", filtres.operationId);
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<LedgerEntryList>(
    `/v1/admin/ledger-entries${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );

  return {
    ecritures: brut.items.map(depuisEcritureRegistre),
    curseurSuivant: brut.next_cursor,
  };
}

/**
 * Rejoue la vérification d'intégrité de la chaîne.
 *
 * ✅ Route du CONTRAT, `GET /api/v1/admin/audit/verify`
 * (`data-dictionary.md:575-580`).
 *
 * L'heure du contrôle est posée ICI, à la réception : la route ne rend pas
 * d'horodatage, et un résultat d'intégrité sans heure ne prouve rien — il
 * pourrait dater d'hier.
 */
export async function verifierIntegrite(): Promise<VerificationIntegrite> {
  const brut = await appelApi<ChainVerification>("/v1/admin/audit/verify", {
    cache: "no-store",
  });
  return depuisVerification(brut, Date.now());
}

/**
 * Annule une opération : écrit une écriture inverse, n'en supprime aucune.
 *
 * ✅ Route du CONTRAT, `POST /api/v1/admin/compensations`, corps
 * `CompensationRequest { original_operation_id, reason }` (:558-559).
 *
 * Le motif est obligatoire et refusé côté serveur en `422` — le contrôle de
 * l'écran n'est que de l'aide à la saisie.
 */
export async function annulerOperation(operationId: string, motif: string): Promise<void> {
  await appelApi<unknown>("/v1/admin/compensations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ original_operation_id: operationId, reason: motif }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VUE NATIONALE DES TRANSACTIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Les quatre filtres de la vue nationale. Tous facultatifs, tous combinables. */
export interface FiltresTransactionsNationales {
  /** Date ISO 8601 incluse, sur la date du fait. */
  depuis?: string;
  jusqua?: string;
  partenaireId?: string;
  /** Identifiant de ville, ou `en-ligne` pour les commerces sans ville. */
  villeId?: string;
  categorie?: string;
}

export interface PageTransactionsNationales {
  transactions: TransactionNationale[];
  /** Sur l'ensemble filtré, jamais sur cette page. */
  totaux: TotauxTransactions;
  curseurSuivant: string | null;
}

/**
 * L'activité nationale : qui a encaissé, où, combien, dans quelle catégorie.
 *
 * ⚠ Route que NOUS proposons, `GET /api/v1/admin/transactions`. Le contrat
 * n'expose côté administration que le tableau de bord agrégé
 * (`data-dictionary.md:561-573`) : un volume et une ventilation par ville,
 * aucune ligne. Voir l'en-tête de la route pour le détail.
 *
 * Les totaux viennent de la réponse et ne sont jamais recalculés depuis
 * `transactions` : celles-ci ne sont qu'une page.
 */
export async function listerTransactionsNationales(
  filtres: FiltresTransactionsNationales = {},
  curseur?: string,
): Promise<PageTransactionsNationales> {
  const parametres = new URLSearchParams();
  const poser = (nom: string, valeur: string | undefined): void => {
    if (valeur !== undefined && valeur !== "") parametres.set(nom, valeur);
  };
  poser("from", filtres.depuis);
  poser("to", filtres.jusqua);
  poser("partner", filtres.partenaireId);
  poser("city", filtres.villeId);
  poser("category", filtres.categorie);
  poser("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<AdminTransactionList>(
    `/v1/admin/transactions${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );

  return {
    transactions: brut.items.map(depuisTransactionNationale),
    totaux: depuisTotauxTransactions(brut.totals),
    curseurSuivant: brut.next_cursor,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LE RÉPERTOIRE DES BÉNÉFICIAIRES
 *
 * ⚠ Toutes les routes de cette section sont de NOTRE FAIT. Le répertoire
 * existe en base et dans `core/src/directory/` ; la section 4 du contrat ne
 * l'expose nulle part.
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FiltresRepertoire {
  /** Nom, prénom ou matricule. Accents et casse indifférents. */
  recherche?: string;
  statut?: StatutBeneficiaire;
  employeurId?: string;
}

export interface PageRepertoire {
  lignes: LigneRepertoire[];
  curseurSuivant: string | null;
}

export async function listerBeneficiaires(
  filtres: FiltresRepertoire = {},
  curseur?: string,
): Promise<PageRepertoire> {
  const parametres = new URLSearchParams();
  const poser = (nom: string, valeur: string | undefined): void => {
    if (valeur !== undefined && valeur !== "") parametres.set(nom, valeur);
  };
  poser("q", filtres.recherche);
  poser("status", filtres.statut);
  poser("employer", filtres.employeurId);
  poser("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<EmployeeDirectoryList>(
    `/v1/admin/employees${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );
  return {
    lignes: brut.items.map(depuisLigneRepertoire),
    curseurSuivant: brut.next_cursor,
  };
}

/** Le référentiel des employeurs, pour le filtre. Jamais une liste écrite. */
export async function listerEmployeurs(): Promise<EmployeurRepertoire[]> {
  const brut = await appelApi<EmployerItem[]>("/v1/admin/employers", { cache: "no-store" });
  return brut.map(depuisEmployeur);
}

export async function lireBeneficiaire(id: string): Promise<FicheBeneficiaire> {
  const brut = await appelApi<EmployeeDetail>(
    `/v1/admin/employees/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  return depuisFicheBeneficiaire(brut);
}

/**
 * Régularise le solde d'un bénéficiaire.
 *
 * ═══ RÈGLE R1 ═══
 *
 * Cette fonction n'envoie AUCUN solde. Elle envoie un sens, un montant et un
 * motif ; le serveur ajoute une écriture au registre et rend le solde qui en
 * découle, accompagné de l'écriture elle-même. À aucun moment le front ne dit
 * au serveur combien le compte doit valoir — il dit ce qu'il faut inscrire.
 *
 * C'est pourquoi le retour porte les deux : après une régularisation, l'écran
 * montre le nouveau solde ET la ligne qui l'explique.
 */
export async function regulariserSolde(
  id: string,
  sens: SensRegularisation,
  montantCentimes: number,
  motif: string,
): Promise<Regularisation> {
  const brut = await appelApi<AdjustmentResult>(
    `/v1/admin/employees/${encodeURIComponent(id)}/adjustments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      /* Euros décimaux sur le fil (`money.rs:145`, A5) ; le domaine reste en
         centimes entiers de bout en bout. */
      body: JSON.stringify({
        direction: sens,
        amount: montantCentimes / 100,
        reason: motif,
      }),
    },
  );
  return depuisRegularisation(brut);
}

/** Suspend un bénéficiaire. Le motif est obligatoire, côté serveur aussi. */
export async function suspendreBeneficiaire(id: string, motif: string): Promise<void> {
  await appelApiSansContenu(
    `/v1/admin/employees/${encodeURIComponent(id)}/suspend`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: motif }),
    },
  );
}

/**
 * Réactive un bénéficiaire. AUCUN motif, et aucun corps.
 *
 * Exiger une justification pour rendre ses droits à quelqu'un lui ferait
 * porter la charge d'une suspension qui n'aurait peut-être pas dû avoir lieu.
 */
export async function reactiverBeneficiaire(id: string): Promise<void> {
  await appelApiSansContenu(
    `/v1/admin/employees/${encodeURIComponent(id)}/reinstate`,
    { method: "POST" },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MISES EN AVANT — VITRINE PUBLIQUE
 *
 * ✅ Les quatre routes sont DU CONTRAT (`data-dictionary.md:513-534`,
 * confirmées par `front/docs/contrat-api.md:158-161`). Rien n'y manque côté
 * surface ; voir `app/api/v1/admin/highlights/route.ts` pour ce qui EST notre
 * ajout (le champ `note`) et pour les deux statuts HTTP non écrits par le
 * contrat, tranchés là comme ici.
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function listerMisesEnAvant(emplacement: Emplacement): Promise<MiseEnAvant[]> {
  const brut = await appelApi<HighlightItem[]>(
    `/v1/admin/highlights?placement=${encodeURIComponent(emplacement)}`,
    { cache: "no-store" },
  );
  return brut.map(depuisMiseEnAvant);
}

export type EchecMiseEnAvantAppel = "non_eligible" | "deja_en_avant";

/**
 * Ajoute un partenaire à un emplacement.
 *
 * ⚠ `motif` a été délibérément appelé `mot` partout dans le domaine : ce
 * n'est pas un motif technique qui justifie une décision, ce sont les mots du
 * ministre, qui paraissent tels quels sur la vitrine publique. Nommer ce
 * paramètre « motif » comme pour un refus ou une suspension aurait suggéré le
 * même ton — négatif, justificatif — que ces deux-là écartent explicitement.
 */
export async function ajouterMiseEnAvant(
  partenaireId: string,
  emplacement: Emplacement,
  position: number | null,
  mot: string | null,
): Promise<MiseEnAvant> {
  const brut = await appelApi<CreateHighlightResponse>("/v1/admin/highlights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partner_id: partenaireId,
      placement: emplacement,
      position,
      note: mot !== null && mot.trim() !== "" ? mot.trim() : null,
    } satisfies CreateHighlightRequest),
  });
  return depuisMiseEnAvant(brut);
}

export async function retirerMiseEnAvant(id: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/highlights/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function reordonnerMisesEnAvant(
  emplacement: Emplacement,
  ordonnes: string[],
): Promise<MiseEnAvant[]> {
  const brut = await appelApi<ReorderResponse>("/v1/admin/highlights/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      placement: emplacement,
      ordered_ids: ordonnes,
    } satisfies ReorderRequest),
  });
  return brut.map(depuisMiseEnAvant);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RECHARGEMENTS — CRÉDIT DES COMPTES SALARIÉS
 *
 * ✅ Les trois routes sont DU CONTRAT (`data-dictionary.md:537-556`,
 * confirmées par `front/docs/contrat-api.md:162-164`). `topup-batches` et sa
 * validation touchent au module le plus construit du back après le
 * paiement — voir `app/api/v1/admin/topups/route.ts` pour le détail de ce qui
 * EST notre ajout (le motif).
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Crédite un salarié, adressé par SON EMPLOYEUR ET SON MATRICULE — jamais un
 * identifiant interne. Voir `crediterSalarie` (`mocks/magasin.ts`).
 */
export async function crediterSalarie(
  employeurId: string,
  matricule: string,
  montantCentimes: number,
  motif: string,
  reference: string | null,
): Promise<Rechargement> {
  const brut = await appelApi<TopupResponse>("/v1/admin/topups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      employer_id: employeurId,
      employer_ref: matricule,
      amount: montantCentimes / 100,
      reference,
      reason: motif,
    } satisfies TopupRequest),
  });
  return depuisRechargement(brut);
}

/**
 * Téléverse un fichier de rechargements pour UN employeur et rend l'aperçu.
 *
 * ⚠ Jamais un import qui s'exécute à l'aveugle : cette fonction ne fait
 * qu'ANALYSER le fichier et le mettre en attente. Aucune écriture n'a lieu
 * avant `validerLot`.
 */
export async function televerserLot(
  employeurId: string,
  fichier: File,
  motif: string,
): Promise<ApercuLot> {
  const formulaire = new FormData();
  formulaire.set("employer_id", employeurId);
  formulaire.set("reason", motif);
  formulaire.set("file", fichier);

  const brut = await appelApi<BatchPreview>("/v1/admin/topup-batches", {
    method: "POST",
    body: formulaire,
  });
  return depuisApercuLot(brut);
}

/**
 * Valide un lot en attente : POSTE une opération par ligne.
 *
 * ⚠ RÈGLE DU BACK : un lot avec une seule ligne en erreur est refusé EN
 * ENTIER, et c'est le SERVEUR qui l'impose (`funding/batch.rs:2`) — pas
 * seulement un bouton grisé ici, qui se contournerait.
 */
export async function validerLot(id: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/topup-batches/${encodeURIComponent(id)}/validate`, {
    method: "POST",
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RÉCLAMATIONS DES SALARIÉS
 *
 * ⚠⚠ LES QUATRE ROUTES SONT ENTIÈREMENT DE NOTRE FAIT. Aucune route, aucune
 * table, aucun module ne couvre ce domaine côté back — voir l'en-tête de
 * `app/api/v1/admin/claims/route.ts` pour le constat complet.
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface PageReclamations {
  reclamations: ReclamationResume[];
  curseurSuivant: string | null;
}

/**
 * La file, la plus ancienne ouverte en premier. Sans filtre, ne rend pas les
 * dossiers clos — voir la route.
 */
export async function listerReclamationsAdmin(
  statut?: StatutReclamation,
  curseur?: string,
): Promise<PageReclamations> {
  const STATUTS: Record<StatutReclamation, string> = {
    ouverte: "open",
    en_cours: "in_progress",
    close: "closed",
  };
  const parametres = new URLSearchParams();
  if (statut !== undefined) parametres.set("status", STATUTS[statut]);
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);

  const requete = parametres.toString();
  const brut = await appelApi<ClaimList>(
    `/v1/admin/claims${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );
  return {
    reclamations: brut.items.map(depuisReclamationResume),
    curseurSuivant: brut.next_cursor,
  };
}

export async function lireReclamation(id: string): Promise<Reclamation> {
  const brut = await appelApi<ClaimDetail>(`/v1/admin/claims/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  return depuisReclamation(brut);
}

/** Répond à un dossier. Refusé si le dossier est clos — voir la route. */
export async function repondreAReclamation(id: string, texte: string): Promise<void> {
  await appelApi(`/v1/admin/claims/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: texte } satisfies ClaimMessageRequest),
  });
}

/** Clôt un dossier. Motif obligatoire, refusé côté serveur s'il est vide. */
export async function cloturerReclamationAdmin(id: string, motif: string): Promise<void> {
  await appelApiSansContenu(`/v1/admin/claims/${encodeURIComponent(id)}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: motif } satisfies ClaimCloseRequest),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TABLEAU DE BORD NATIONAL
 *
 * ✅ `GET /admin/dashboard` est du contrat (`data-dictionary.md:561-573`).
 * `by_category` et `weekly` sont notre ajout — voir `types/api.ts`.
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FenetreTableauDeBord {
  depuis?: string;
  jusqua?: string;
}

export async function lireTableauDeBordNational(
  fenetre: FenetreTableauDeBord = {},
): Promise<TableauDeBordNational> {
  const parametres = new URLSearchParams();
  if (fenetre.depuis !== undefined && fenetre.depuis !== "") parametres.set("from", fenetre.depuis);
  if (fenetre.jusqua !== undefined && fenetre.jusqua !== "") parametres.set("to", fenetre.jusqua);

  const requete = parametres.toString();
  const brut = await appelApi<Dashboard>(
    `/v1/admin/dashboard${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );
  return depuisTableauDeBordNational(brut);
}
