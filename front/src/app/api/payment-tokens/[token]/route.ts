/**
 * Resolution d'un jeton de paiement, cote comptoir partenaire.
 * Lire un jeton ne le consomme pas : c'est l'encaissement qui le fera.
 */

import { NextResponse } from "next/server";

import { jetonEstExpire, trouverJeton, trouverSalarie } from "@/mocks/magasin";

/* L'etat vit en memoire : aucune reponse ne doit etre mise en cache. */
export const dynamic = "force-dynamic";

interface ParametresRoute {
  params: Promise<{ token: string }>;
}

function erreur(
  statut: number,
  code: string,
  message: string,
): NextResponse<{ error: { code: string; message: string } }> {
  return NextResponse.json({ error: { code, message } }, { status: statut });
}

export async function GET(
  _requete: Request,
  { params }: ParametresRoute,
): Promise<NextResponse> {
  const { token } = await params;

  const jeton = trouverJeton(token);
  if (!jeton) {
    return erreur(404, "unknown_token", "Ce code est introuvable.");
  }
  if (jeton.usedAt !== null) {
    return erreur(409, "token_used", "Ce code a déjà été utilisé.");
  }
  if (jetonEstExpire(jeton, Date.now())) {
    return erreur(410, "token_expired", "Ce code a expiré.");
  }

  /* Un jeton dont le porteur a disparu du magasin n'est plus resoluble :
     le comptoir n'a pas a distinguer ce cas d'un code inconnu. */
  const salarie = trouverSalarie(jeton.employeeId);
  if (!salarie) {
    return erreur(404, "unknown_token", "Ce code est introuvable.");
  }

  return NextResponse.json({
    token: jeton.token,
    employee: { id: salarie.id, name: salarie.nom },
    expiresAt: jeton.expiresAt,
  });
}
