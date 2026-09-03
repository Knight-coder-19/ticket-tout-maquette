/**
 * `GET /api/v1/admin/employees/{id}` — la fiche d'un bénéficiaire.
 *
 * ⚠ DE NOTRE FAIT, comme la liste. Voir `../route.ts` pour le détail : le
 * répertoire existe en base et dans `core/src/directory/`, aucune route du
 * contrat ne le lit.
 *
 * ─── Les trois soldes, servis ensemble ───
 *
 * `settled`, `held` et `available` sont les trois champs de leur
 * `BalanceResponse` (`data-dictionary.md:374-380`), aux mêmes noms. Ils ne
 * sont pas interchangeables et la route les sert tous les trois plutôt que le
 * seul disponible : un agent qui voit un disponible bas doit pouvoir savoir
 * si c'est parce que le compte est vide ou parce qu'un paiement est en cours.
 *
 * `held` n'est pas stocké ici : il est recalculé depuis les jetons actifs
 * (invariant I4). Le back, lui, tient `accounts.balance_held` à jour.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import {
  jetonsActifsDe,
  nomComplet,
  soldeDe,
  trouverAdministrateur,
  trouverEmployeur,
  trouverSalarie,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function GET(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const { id } = await contexte.params;
  const salarie = trouverSalarie(id);
  if (!salarie) {
    return erreur(404, "NOT_FOUND", "Ce bénéficiaire n'existe pas.");
  }

  const maintenant = Date.now();
  const solde = soldeDe(salarie.id, maintenant);
  const employeur = trouverEmployeur(salarie.employeurId);
  const jetons = jetonsActifsDe(salarie.id, maintenant);

  return succes({
    id: salarie.id,
    last_name: salarie.nom,
    first_name: salarie.prenom,
    display_name: nomComplet(salarie),
    phone: salarie.telephone,
    status: salarie.statut,
    employer:
      employeur === undefined
        ? null
        : { id: employeur.id, legal_name: employeur.legalName, ifu: employeur.ifu },
    employer_ref: salarie.matricule,
    started_at: salarie.entreLe,
    /* Les trois, jamais un seul. */
    balance: {
      settled: euros(solde?.settledCentimes ?? 0),
      held: euros(solde?.heldCentimes ?? 0),
      available: euros(solde?.disponibleCentimes ?? 0),
    },
    /*
      Ce qui EXPLIQUE la réservation.
      Un montant réservé sans rien qui dise pourquoi se lit comme de l'argent
      disparu. Le décompte des jetons en cours donne à l'agent de quoi
      répondre au salarié qui appelle.
    */
    active_tokens: jetons.length,
  });
}
