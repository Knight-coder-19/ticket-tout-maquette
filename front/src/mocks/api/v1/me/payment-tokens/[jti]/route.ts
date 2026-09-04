/**
 * `DELETE /api/v1/me/payment-tokens/{jti}` — annulation d'un jeton.
 *
 * Contrat : `docs/data-dictionary.md:412`, annote `→ 204`. Logique :
 * `cancel_token` (`payments/repo.rs:1`).
 *
 * C'est le seul mecanisme SPECIFIE pour rendre au disponible les fonds d'un
 * jeton dont on ne veut plus. Regenerer un code, c'est annuler puis emettre :
 * rien dans le contrat ne dit qu'une nouvelle emission annulerait la
 * precedente, et l'inventer aurait ete ecrire une regle que le back n'a pas.
 *
 * C'est ce qui protege le salarie qui se trompe de montant trois fois de
 * suite : chaque annulation rend la reservation, le disponible ne fond pas.
 */

import { erreur, identite, sansContenu } from "@/mocks/enveloppe";
import { annulerJeton, libererJetonsExpires, trouverJetonParJti } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

interface ParametresRoute {
  params: Promise<{ jti: string }>;
}

export async function DELETE(
  requete: Request,
  { params }: ParametresRoute,
): Promise<Response> {
  const maintenant = Date.now();
  libererJetonsExpires(maintenant);

  const { jti } = await params;
  const employeeId = identite(requete, "X-Mock-Employe", "SAL-001");

  const jeton = trouverJetonParJti(jti);
  /* Un jeton qui appartient a quelqu'un d'autre est traite comme inconnu :
     l'espace `/me` ne revele jamais l'existence du jeton d'un tiers. */
  if (!jeton || jeton.employeeId !== employeeId) {
    return erreur(404, "TOKEN_NOT_FOUND", "Ce jeton est introuvable.");
  }
  if (jeton.statut !== "active") {
    return erreur(404, "TOKEN_NOT_FOUND", "Ce jeton n'est plus actif.");
  }

  annulerJeton(jti, maintenant);
  return sansContenu();
}
