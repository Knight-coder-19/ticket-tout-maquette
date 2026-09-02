/**
 * `POST /api/v1/admin/partners/{id}/approve` -- acceptation d'une adhesion.
 *
 * Contrat : `docs/data-dictionary.md:507`, annote explicitement `-> 204`.
 * Logique : `review.rs:1-2` -- remplir `reviewed_by`, `reviewed_at` et
 * `review_reason`, et ecrire dans `audit_log`. Les trois champs et le journal
 * sont poses ensemble, en une seule operation.
 *
 * NOTRE CHOIX, la ou le contrat se tait : le code et le statut d'un dossier
 * DEJA TRANCHE. Aucune ligne de la table des erreurs (:629-643) ne couvre le
 * cas. Retenu : `409 PARTNER_ALREADY_REVIEWED`. Le 409 parce que c'est un
 * conflit d'etat et non un probleme de format ; le code parce qu'il faut bien
 * en nommer un, et que les codes de cette table sont annonces stables a vie --
 * celui-ci demande donc a etre valide par l'equipe back avant d'y entrer.
 *
 * Pourquoi refuser plutot que reecrire : l'invariant I9 (`data-model.md:142-150`)
 * pose que rien ne s'efface. Une decision est un fait, pas un champ modifiable.
 *
 * `review.rs:2-3` demande aussi de verifier qu'aucune mise en avant n'existe
 * pour un partenaire qui deviendrait ineligible. Le magasin ne porte pas encore
 * les mises en avant (table `partner_highlights`, A2) : la verification serait
 * vide, elle n'est donc pas ecrite plutot que simulee.
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
  /* Une acceptation n'a pas de motif obligatoire : `review_reason` reste nul.
     Le contrat ne prevoit d'ailleurs aucun corps pour cette route (:507). */
  const resultat = trancherAdhesion(id, "approved", administrateurId, null, maintenant);

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
        /* Inatteignable pour une acceptation, mais l'union est exhaustive. */
        return erreur(422, "VALIDATION_FAILED", "Motif manquant.");
    }
  }

  return sansContenu();
}
