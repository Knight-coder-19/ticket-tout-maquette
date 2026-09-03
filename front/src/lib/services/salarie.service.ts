/**
 * Le service de l'espace salarié.
 *
 * Il ne connaît ni `fetch`, ni l'URL du backend, ni la forme des erreurs : il
 * décrit des appels et convertit ce qui en revient vers le domaine.
 *
 * ─── Ce fichier remplace l'interface `ServiceSalarie` ───
 *
 * L'interface qui vivait ici rendait `recupererTransactions` en
 * `ReponsePaginee<Transaction>` — offset, `page` / `taillePage` / `total` —
 * que le back ne sait pas produire (divergence D10, comme côté partenaire :
 * voir `partenaire.service.ts`). Et `genererCodePaiement(salarieId)` ne
 * prenait aucun montant, alors que c'est le salarié qui le fixe à l'émission
 * (`AuthorizeRequest.amount`, data-dictionary.md:401-410) — le back n'a tout
 * simplement rien à réserver sans lui. Aucune implémentation honnête de
 * l'ancienne forme n'était possible.
 *
 * Les routes réelles sont câblées côté back depuis la fusion de
 * `origin/develop` (2026-09-04) : `GET /me/balance`, `GET /me/transactions`,
 * `GET /me/minister-picks`, `POST` + `DELETE /me/payment-tokens`
 * (`routes/employee.rs`). Ce fichier les appelle toutes.
 */

import { appelApi, appelApiSansContenu } from "@/lib/api/client";
import {
  depuisCodePaiement,
  depuisPartenaire,
  depuisSolde,
  depuisTransaction,
} from "@/lib/api/adaptateurs";
import type {
  BalanceResponse,
  EmployeeTransactionList,
  IssuedTokenResponse,
  MinisterPickList,
} from "@/types/api";
import type { CodePaiement, Partenaire, Solde, Transaction } from "@/types/domaine";

/**
 * Le solde disponible du salarié connecté.
 *
 * ✅ Route du CONTRAT, `GET /api/v1/me/balance` (data-dictionary.md:374-380).
 *
 * `BalanceResponse` ne porte aucun horodatage — `depuisSolde()` en réclame un
 * en complément ; celui de la réception convient, le solde vient d'être lu.
 */
export async function lireSolde(): Promise<Solde> {
  const brut = await appelApi<BalanceResponse>("/v1/me/balance", { cache: "no-store" });
  return depuisSolde(brut, { misAJourLe: new Date().toISOString() });
}

export interface PageTransactions {
  lignes: Transaction[];
  curseurSuivant: string | null;
}

/**
 * Le relevé du salarié, le plus récent d'abord.
 *
 * ✅ Route du CONTRAT, `GET /api/v1/me/transactions?cursor=&limit=`
 * (data-dictionary.md:382-392). Pagination par curseur, comme partout côté
 * back — pas de numéro de page, voir `PageTransactions` plutôt que
 * `ReponsePaginee`.
 */
export async function listerTransactions(curseur?: string, limite?: number): Promise<PageTransactions> {
  const parametres = new URLSearchParams();
  if (curseur !== undefined && curseur !== "") parametres.set("cursor", curseur);
  if (limite !== undefined) parametres.set("limit", String(limite));
  const requete = parametres.toString();

  const brut = await appelApi<EmployeeTransactionList>(
    `/v1/me/transactions${requete === "" ? "" : `?${requete}`}`,
    { cache: "no-store" },
  );

  return {
    lignes: brut.items.map(depuisTransaction),
    curseurSuivant: brut.next_cursor,
  };
}

/**
 * Les partenaires mis en avant par le Ministre.
 *
 * ✅ Route du CONTRAT (amendement A2), `GET /api/v1/me/minister-picks`
 * (data-dictionary.md:394-399).
 *
 * `estMisEnAvant` est déduit à `true` sans complément à fournir : figurer
 * dans cette liste EST la mise en avant, exactement comme sur la vitrine
 * publique (`depuisPartenairePublic`, même raisonnement).
 */
export async function lireChoixDuMinistre(): Promise<Partenaire[]> {
  const brut = await appelApi<MinisterPickList>("/v1/me/minister-picks", { cache: "no-store" });
  return brut.map((pick) => depuisPartenaire(pick.partner, { estMisEnAvant: true }));
}

export interface CodeEmis {
  code: CodePaiement;
  /**
   * Le `jti` du jeton, hors du domaine `CodePaiement` par choix
   * (`depuisCodePaiement`) mais nécessaire pour pouvoir l'annuler plus tard
   * — voir `annulerCodePaiement`. Nommé explicitement plutôt que caché : ce
   * n'est pas le rôle de l'adaptateur de le taire, seulement de ne pas le
   * mettre dans un type que le domaine n'a pas prévu pour lui.
   */
  jti: string;
}

/**
 * Émet un code de paiement pour le montant demandé.
 *
 * ✅ Route du CONTRAT, `POST /api/v1/me/payment-tokens`
 * (data-dictionary.md:401-410). C'est ICI, par le salarié, que le montant est
 * fixé — le partenaire ne le saisira jamais (D4).
 *
 * ⚠ PERTE D'INFORMATION ASSUMÉE dans `code` : `depuisCodePaiement` ne garde
 * que `short_code` et `expires_at`. Un écran qui a besoin du QR
 * (`qr_payload`) doit lire la réponse brute, pas ce type — voir le
 * commentaire de `depuisCodePaiement` dans `adaptateurs.ts`.
 */
export async function genererCodePaiement(montantCentimes: number): Promise<CodeEmis> {
  const brut = await appelApi<IssuedTokenResponse>("/v1/me/payment-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: montantCentimes / 100 }),
  });
  return { code: depuisCodePaiement(brut), jti: brut.jti };
}

/**
 * Annule un code non consommé, avant son expiration naturelle.
 *
 * ✅ Route du CONTRAT, `DELETE /api/v1/me/payment-tokens/{jti}` (:412),
 * annotée `→ 204`. Rend au disponible les fonds réservés par ce jeton.
 *
 * ⚠ `jti` — pas `short_code`. `depuisCodePaiement` ne garde pas le `jti` : un
 * écran qui veut pouvoir annuler doit conserver la réponse brute de
 * `genererCodePaiement`, ou son `jti`, à côté du `CodePaiement` affiché.
 */
export async function annulerCodePaiement(jti: string): Promise<void> {
  await appelApiSansContenu(`/v1/me/payment-tokens/${encodeURIComponent(jti)}`, {
    method: "DELETE",
  });
}
