/**
 * `POST /api/v1/admin/partners/{id}/close` — fermeture d'un compte.
 *
 * ⚠ CETTE ROUTE EST DE NOTRE FAIT. `closed` existe bien dans l'ENUM
 * `partner_status` (`0001_schema.sql:7`) et dans le dictionnaire (:57), mais
 * aucune route ne le pose.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * PEUT-ON REVENIR DE `closed` ? LA RÉPONSE EST EN DEUX TEMPS.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * DANS LE SCHÉMA : OUI, techniquement. `partners.status` est une colonne
 * `partner_status NOT NULL DEFAULT 'pending'` (:113), sans `CHECK` de
 * transition, sans déclencheur. Les trois `forbid_mutation()` ne portent que
 * sur `ledger_entries`, `ledger_operations` et `audit_log` (:286-315). Rien
 * n'empêcherait un `UPDATE` ramenant un partenaire de `closed` à `approved`.
 *
 * DANS LES FAITS : NON, passé un délai. La fermeture d'un compte déclenche une
 * mécanique qui, elle, est irréversible :
 *
 *   - `worker/src/main.rs:1` fait tourner un travail qui « forfeit[s] the
 *     balances of accounts closed past the grace » ;
 *   - le délai est `CLOSURE_GRACE_DAYS`, 30 jours (`backend/.env.example:32`),
 *     porté par `CoreConfig.closure_grace` (`core/src/config.rs:14`) ;
 *   - la déchéance s'écrit comme une opération `closure_forfeit` vers le compte
 *     système `CLOSURE_FORFEIT` (`data-dictionary.md:61`,
 *     `directory/employment.rs:2`) ;
 *   - le journal est en ajout seul (invariant I8, `data-model.md:132-140`) :
 *     cette opération ne s'annule pas, elle se compense.
 *
 * Donc : **rouvrir un compte fermé depuis moins de 30 jours ne perd rien ;
 * rouvrir un compte fermé au-delà rend un compte vidé, et remettre l'argent
 * demande une compensation, pas un changement de statut.**
 *
 * CE QUE NOUS AVONS RETENU, faute de règle écrite : `closed` n'a aucune sortie.
 * Le tableau `TRANSITIONS` du magasin ne lui en donne pas. C'est le choix
 * prudent — il ne détruit rien et se relâche facilement si l'équipe back
 * confirme qu'une réouverture dans le délai de grâce est prévue.
 *
 * ⚠ CONSÉQUENCE POUR L'ÉCRAN : la fermeture doit être annoncée comme
 * définitive AVANT le geste, et non après. Tant que la question n'est pas
 * tranchée avec l'équipe back, c'est la seule formulation honnête.
 *
 * Transitions permises : `approved` → `closed` et `suspended` → `closed`.
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
    "closed",
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
          "Seul un compte agréé ou suspendu peut être fermé. Une fermeture ne se défait pas.",
        );
      case "motif_manquant":
        return erreur(
          422,
          "VALIDATION_FAILED",
          "Le champ reason est obligatoire : une fermeture définitive se motive.",
        );
    }
  }

  return sansContenu();
}
