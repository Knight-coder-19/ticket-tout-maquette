/**
 * `POST /api/v1/admin/partners/{id}/reinstate` — réactivation d'un compte
 * suspendu.
 *
 * ⚠ CETTE ROUTE EST ENTIÈREMENT DE NOTRE FAIT. Contrairement à la suspension,
 * que `routes/admin.rs:1` mentionne, la réactivation n'apparaît NULLE PART :
 * ni dans les fichiers Rust, ni dans le dictionnaire. Le seul indice qu'elle
 * doit exister est l'ENUM `partner_status`, qui distingue `suspended` de
 * `closed` (`0001_schema.sql:7`) : si une suspension était définitive, les deux
 * valeurs n'en feraient qu'une.
 *
 * LE MOTIF EST FACULTATIF, contrairement à la suspension et à la fermeture.
 *
 * C'est un revirement assumé : la version précédente l'exigeait, en suivant la
 * consigne « chaque changement de statut porte son motif ». Le contrat dit
 * l'inverse pour une décision favorable — `approve` répond `204` sans aucun
 * corps (:507), là où `reject` porte un `RejectRequest { reason }` obligatoire
 * (:509). Une décision défavorable doit pouvoir se contester, donc s'expliquer ;
 * une décision favorable n'a personne à qui rendre des comptes.
 *
 * Un motif reste accepté et consigné s'il est fourni.
 *
 * Transition permise : `suspended` → `approved`, et elle seule.
 */

import { erreur, identite, sansContenu } from "@/mocks/enveloppe";
import { changerStatutPartenaire, trouverAdministrateur } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

interface ParametresRoute {
  params: Promise<{ id: string }>;
}

/** Lit `reason` sans rien supposer de la forme du corps. */
async function lireMotif(requete: Request): Promise<string | null> {
  const donnees: unknown = await requete.json().catch(() => null);
  if (typeof donnees !== "object" || donnees === null) return null;
  const brut = (donnees as { reason?: unknown }).reason;
  return typeof brut === "string" ? brut : null;
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
  const resultat = changerStatutPartenaire(
    id,
    "approved",
    administrateurId,
    await lireMotif(requete),
    maintenant,
  );

  if ("echec" in resultat) {
    switch (resultat.echec) {
      case "introuvable":
        return erreur(404, "PARTNER_NOT_FOUND", "Ce compte est introuvable.");
      case "transition_refusee":
        return erreur(
          409,
          "PARTNER_STATUS_CONFLICT",
          "Seul un compte suspendu peut être réactivé.",
        );
      case "motif_manquant":
        /* Inatteignable : le motif est facultatif pour une réactivation.
           L'union est exhaustive, la branche reste pour le compilateur. */
        return erreur(422, "VALIDATION_FAILED", "Motif manquant.");
    }
  }

  return sansContenu();
}
