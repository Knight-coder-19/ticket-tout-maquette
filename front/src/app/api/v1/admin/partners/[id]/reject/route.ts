/**
 * `POST /api/v1/admin/partners/{id}/reject` -- refus d'une adhesion.
 *
 * Contrat : `docs/data-dictionary.md:508-509`. Corps : `RejectRequest { reason: string }`.
 * Logique : `review.rs:1-2`.
 *
 * LE MOTIF EST REFUSE ICI, PAS SEULEMENT A L'ECRAN. `reason` est declare
 * `string` non nullable (:509), et c'est ce qui rend le refus opposable : un
 * refus sans motif enregistre n'en est pas un. Une chaine vide ou blanche est
 * traitee comme absente -- accepter `"   "` reviendrait a laisser passer
 * exactement ce que la regle interdit.
 *
 * NOTRE CHOIX, la ou le contrat se tait :
 *
 *   - LE STATUT DE SUCCES. `approve` juste au-dessus est annote `-> 204`
 *     (:507) ; `reject` ne l'est pas et ne declare aucun type de reponse.
 *     Retenu : `204`, par symetrie avec `approve`. C'est la meme operation vue
 *     de l'autre cote, elle n'a pas de raison de rendre un corps quand l'autre
 *     n'en rend pas. Ambiguite A3 de `front/docs/contrat-api.md`.
 *
 *   - LE DOSSIER DEJA TRANCHE : `409 PARTNER_ALREADY_REVIEWED`, meme choix et
 *     meme reserve que dans la route d'acceptation.
 */

import { erreur, identite, sansContenu } from "@/mocks/enveloppe";
import { trancherAdhesion, trouverAdministrateur } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

interface ParametresRoute {
  params: Promise<{ id: string }>;
}

export async function POST(
  requete: Request,
  { params }: ParametresRoute,
): Promise<Response> {
  const maintenant = Date.now();
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const { id } = await params;
  const donnees: unknown = await requete.json().catch(() => null);
  const motifBrut =
    typeof donnees === "object" && donnees !== null
      ? (donnees as { reason?: unknown }).reason
      : undefined;
  const motif = typeof motifBrut === "string" ? motifBrut : null;

  const resultat = trancherAdhesion(id, "rejected", administrateurId, motif, maintenant);

  if ("echec" in resultat) {
    switch (resultat.echec) {
      case "introuvable":
        /* NOTRE CHOIX : la table des erreurs n'a pas de code generique
           d'introuvable, et `TOKEN_NOT_FOUND` designe un jeton de paiement
           (:635). Le detourner pour un partenaire serait mentir au front. */
        return erreur(404, "PARTNER_NOT_FOUND", "Cette demande est introuvable.");
      case "deja_tranchee":
        return erreur(409, "PARTNER_ALREADY_REVIEWED", "Cette demande a déjà été tranchée.");
      case "motif_manquant":
        return erreur(
          422,
          "VALIDATION_FAILED",
          "Le champ reason est obligatoire : un refus sans motif enregistré n'est pas opposable.",
        );
    }
  }

  return sansContenu();
}
