/**
 * `POST /api/v1/admin/partners/{id}/suspend` — suspension d'un compte agréé.
 *
 * ⚠ CETTE ROUTE EST DE NOTRE FAIT, mais pas son intention. `routes/admin.rs:1`
 * demande de câbler « account suspension » et `dto/admin.rs:1` de définir le
 * DTO d'« account suspension » : le back la veut. Elle n'est simplement
 * spécifiée NULLE PART — la section 4.7 du dictionnaire (:487-580) ne la
 * contient pas. C'est l'ambiguïté A8 de `front/docs/contrat-api.md`.
 *
 * Le chemin, le corps et les statuts suivent donc la forme d'`approve` et
 * `reject`, qui sont les deux seules décisions d'administration spécifiées :
 * `POST /admin/partners/{id}/<verbe>`, corps `{ reason }`, réponse `204`.
 *
 * LE MOTIF EST OBLIGATOIRE, et refusé ici, pas seulement à l'écran. Une
 * suspension coupe les encaissements d'un commerçant : sans motif enregistré,
 * il ne peut ni comprendre ni contester. Une chaîne vide ou blanche est
 * traitée comme absente.
 *
 * ⚠ Le motif écrase `partners.review_reason`, seule colonne de motif du schéma
 * (:117). Voir `changerStatutPartenaire` dans le magasin : la base ne garde que
 * la dernière décision, seul `audit_log` conserve la suite.
 *
 * Transition permise : `approved` → `suspended`, et elle seule. Une demande
 * `pending` se refuse, elle ne se suspend pas.
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
    "suspended",
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
          "Seul un compte agréé peut être suspendu.",
        );
      case "motif_manquant":
        return erreur(
          422,
          "VALIDATION_FAILED",
          "Le champ reason est obligatoire : une suspension sans motif enregistré n'est pas opposable.",
        );
    }
  }

  return sansContenu();
}
