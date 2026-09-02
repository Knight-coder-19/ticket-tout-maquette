/**
 * Le service d'encaissement.
 *
 * Il ne connaît ni `fetch`, ni l'URL du backend, ni la forme des erreurs : il
 * décrit deux appels et convertit ce qui en revient vers le domaine. Le
 * transport est dans `lib/api/client.ts`, les conversions dans
 * `lib/api/adaptateurs.ts`.
 */

import { appelApi } from "@/lib/api/client";
import { horodatage } from "@/lib/api/adaptateurs";
import type {
  EncaissementAccepte,
  JetonResolu,
  MontantCentimes,
} from "@/types/encaissement";

/** Résout un jeton présenté par un salarié. Lève si expiré, déjà utilisé ou inconnu. */
export async function resoudreJeton(token: string): Promise<JetonResolu> {
  const brut = await appelApi<{
    token: string;
    employee: { id: string; name: string };
    expiresAt: unknown;
  }>(`/payment-tokens/${encodeURIComponent(token)}`, { cache: "no-store" });

  return {
    token: brut.token,
    employee: brut.employee,
    /* La route sert de l'ISO 8601 — c'est la norme, et c'est elle qui reste sur
       le fil. La conversion appartient à la frontière : au-delà d'ici, un
       horodatage est un nombre, et le compte à rebours peut compter. */
    expiresAt: horodatage(brut.expiresAt, "expiresAt"),
  };
}

export type DemandeEncaissement = {
  token: string;
  partnerId: string;
  amount: MontantCentimes;
  /** Forgée à la caisse, une fois par tentative. Voir R3. */
  idempotencyKey: string;
  channel?: "qr" | "manuel";
};

/** Écrit l'encaissement au registre. */
export async function encaisser(
  demande: DemandeEncaissement,
): Promise<EncaissementAccepte> {
  const brut = await appelApi<{
    ref: string;
    amount: number;
    createdAt: unknown;
    employee: { id: string; name: string };
    __replayed?: boolean;
  }>("/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(demande),
  });

  return {
    ref: brut.ref,
    amount: brut.amount,
    createdAt: horodatage(brut.createdAt, "createdAt"),
    employee: brut.employee,
    rejoue: brut.__replayed === true,
  };
}
