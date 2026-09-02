/**
 * `GET /api/v1/admin/audit?entity_type=partner&entity_id=...` -- le journal des
 * decisions.
 *
 * ========================================================================
 * LA ROUTE EST DE NOTRE FAIT. LE JOURNAL, NON.
 * ========================================================================
 *
 * Le journal existe bel et bien dans leur schema : la table `audit_log`
 * (`0001_schema.sql:265-274`), en ajout seul, protegee par les declencheurs
 * `forbid_mutation()` (:279-288) et par l'invariant I8
 * (`data-model.md:132-140`). `review.rs:1-2` impose que `approve` et `reject`
 * y ecrivent, et `audit/mod.rs:1-2` decrit la fonction `log(...)` qui le fait.
 * Mieux : `data-dictionary.md:300` dit le journal « consulte par
 * l'administration ». La consultation est donc prevue.
 *
 * Mais AUCUNE ROUTE NE L'EXPOSE. La section 4.7 (:487-580) n'en contient pas.
 * La seule route d'audit du contrat est `GET /api/v1/admin/audit/verify`
 * (:575-580), qui rend la verification de la chaine de hachage -- un booleen
 * et un compteur, pas des lignes de journal. Ce n'est pas la meme chose.
 *
 * Le chemin, les noms de champs, le tri et la pagination ci-dessous sont donc
 * NOTRE PROPOSITION, a confirmer par l'equipe back. Ils suivent d'aussi pres
 * que possible ce qui est ecrit ailleurs : les colonnes sont celles de la
 * table, en `snake_case`, et l'enveloppe est le `Paginated<T>` du contrat
 * (:319-322).
 *
 * Sans cette route, la file de validation ne peut afficher NI qui a decide, NI
 * quand, NI pourquoi : le DTO `PartnerReviewItem` ne porte ni `reviewed_by`,
 * ni `reviewed_at`, ni `review_reason` (voir la contradiction signalee dans
 * `admin/partners/route.ts`). Le journal est aujourd'hui la seule source de
 * ces trois informations.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite, type Curseur } from "@/mocks/curseur";
import { lireJournal, trouverAdministrateur, type EntreeJournal } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

/** Les colonnes d'`audit_log`, en snake_case (`data-dictionary.md:304`). */
function enLigneJournal(entree: EntreeJournal): Record<string, unknown> {
  return {
    id: entree.id,
    actor_id: entree.actorId,
    action: entree.action,
    entity_type: entree.entityType,
    entity_id: entree.entityId,
    payload: entree.payload,
    ip_address: entree.ipAddress,
    created_at: entree.createdAt,
  };
}

/**
 * Le journal se lit du plus recent au plus ancien : le curseur avance donc
 * vers le passe, `created_at` decroissant, `id` decroissant a egalite.
 */
function apresLeCurseur(liste: EntreeJournal[], curseur: Curseur): number {
  return liste.findIndex(
    (e) =>
      e.createdAt < curseur.valeurDeTri ||
      (e.createdAt === curseur.valeurDeTri && e.id < curseur.id),
  );
}

export async function GET(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;
  const limite = lireLimite(parametres.get("limit"));
  if (limite === null) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre limit doit être un entier positif.");
  }

  const entityType = parametres.get("entity_type");
  const entityId = parametres.get("entity_id");
  const liste = lireJournal({
    ...(entityType !== null && entityType !== "" ? { entityType } : {}),
    ...(entityId !== null && entityId !== "" ? { entityId } : {}),
  });

  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    const position = apresLeCurseur(liste, curseur);
    debut = position === -1 ? liste.length : position;
  }

  const page = liste.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < liste.length;

  return succes({
    items: page.map(enLigneJournal),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({ valeurDeTri: dernier.createdAt, id: dernier.id })
        : null,
  });
}
