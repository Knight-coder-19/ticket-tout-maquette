/**
 * Emission d'un jeton de paiement pour un salarie.
 * Cette route sert le front tant que le backend n'existe pas ; elle lit et
 * ecrit uniquement dans le magasin en memoire.
 */

import { NextResponse } from "next/server";

import {
  TTL_JETON,
  enregistrerJeton,
  jetonExiste,
  trouverSalarie,
  type JetonPaiement,
} from "@/mocks/magasin";

/* L'etat vit en memoire : aucune reponse ne doit etre mise en cache. */
export const dynamic = "force-dynamic";

/* Alphabet sans caractere ambigu (ni 0/O ni 1/I) : le code est lu a voix
   haute au comptoir. 32 caracteres divisent 256, le tirage reste uniforme. */
const ALPHABET_JETON = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LONGUEUR_JETON = 16;
const TENTATIVES_MAX = 8;

interface CorpsEmission {
  employeeId: string;
}

function erreur(
  statut: number,
  code: string,
  message: string,
): NextResponse<{ error: { code: string; message: string } }> {
  return NextResponse.json({ error: { code, message } }, { status: statut });
}

function genererValeurJeton(): string {
  const octets = new Uint8Array(LONGUEUR_JETON);
  crypto.getRandomValues(octets);
  let valeur = "";
  for (const octet of octets) {
    valeur += ALPHABET_JETON.charAt(octet % ALPHABET_JETON.length);
  }
  return valeur;
}

function genererValeurJetonLibre(): string {
  for (let tentative = 0; tentative < TENTATIVES_MAX; tentative += 1) {
    const valeur = genererValeurJeton();
    if (!jetonExiste(valeur)) {
      return valeur;
    }
  }
  throw new Error("Impossible de generer un jeton de paiement unique.");
}

/** Rien de ce qui arrive par le reseau n'est suppose bien forme. */
function lireCorps(donnees: unknown): CorpsEmission | null {
  if (typeof donnees !== "object" || donnees === null) {
    return null;
  }
  const employeeId = (donnees as { employeeId?: unknown }).employeeId;
  if (typeof employeeId !== "string" || employeeId.trim() === "") {
    return null;
  }
  return { employeeId: employeeId.trim() };
}

export async function POST(requete: Request): Promise<NextResponse> {
  const donnees: unknown = await requete.json().catch(() => null);
  const corps = lireCorps(donnees);
  if (!corps) {
    return erreur(
      400,
      "invalid_request",
      "Le champ employeeId est obligatoire.",
    );
  }

  const salarie = trouverSalarie(corps.employeeId);
  if (!salarie) {
    return erreur(404, "unknown_employee", "Ce salarié est introuvable.");
  }
  if (salarie.statut !== "actif") {
    return erreur(403, "account_inactive", "Ce compte n'est pas actif.");
  }
  if (salarie.soldeCentimes <= 0) {
    return erreur(402, "empty_balance", "Le solde de ce compte est vide.");
  }

  const maintenant = Date.now();
  const jeton: JetonPaiement = {
    token: genererValeurJetonLibre(),
    employeeId: salarie.id,
    issuedAt: new Date(maintenant).toISOString(),
    expiresAt: new Date(maintenant + TTL_JETON).toISOString(),
    usedAt: null,
  };
  enregistrerJeton(jeton);

  return NextResponse.json(jeton, { status: 201 });
}
