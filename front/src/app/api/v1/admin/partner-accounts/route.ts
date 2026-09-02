/**
 * `GET /api/v1/admin/partner-accounts?status=&category=&city=&q=&cursor=&limit=`
 *
 * La liste des comptes partenaires, pour la gestion des etablissements deja
 * agrees -- a distinguer de la file de validation, qui ne traite que les
 * demandes `pending`.
 *
 * ========================================================================
 * CETTE ROUTE EST DE NOTRE FAIT
 * ========================================================================
 *
 * Le contrat n'a qu'une route de liste de partenaires,
 * `GET /api/v1/admin/partners?status=&cursor=` (`data-dictionary.md:490`), et
 * elle sert `PartnerReviewItem` : treize champs, aucun volume d'activite,
 * aucun filtre autre que le statut.
 *
 * Nous ne l'avons PAS elargie, pour deux raisons : elle est servie telle
 * quelle a l'ecran de validation, et lui ajouter des champs hors contrat
 * effacerait la seule route conforme que nous ayons. Celle-ci est donc
 * separee, et tout ce qu'elle ajoute est explicite :
 *
 *   - LES FILTRES `category`, `city` et `q`. Absents du contrat. Les noms sont
 *     repris du catalogue, `GET /api/v1/catalog?city=&service_mode=&q=&cursor=`
 *     (:469), seule route du contrat a filtrer ainsi. `q` cherche dans
 *     l'enseigne, la raison sociale et la ville, sans accent ni casse.
 *
 *   - L'ACTIVITE, `total_received` et `transaction_count`. Absente de tout DTO
 *     d'administration. Les noms viennent de `PartnerSummary` (:419-421), que
 *     le contrat definit pour l'espace PARTENAIRE. Les reutiliser ici donne au
 *     back un nom deja ecrit s'il adopte la route.
 *
 *     Pourquoi les servir : un agent qui suspend un compte doit voir ce qu'il
 *     suspend. Suspendre un etablissement a 1 284,50 EUR encaisses sur 106
 *     reglements et suspendre un compte a 18,00 EUR sur 3 ne sont pas le meme
 *     geste, et rien dans le contrat ne permet aujourd'hui de les distinguer.
 *
 *   - LE TRI, `(trade_name, id)`, comme `catalog.rs:2`. Un annuaire se lit par
 *     nom ; une file d'attente se lit par anciennete. Ce n'est pas la meme
 *     liste que celle des validations, elle n'a pas le meme ordre.
 *
 * L'enveloppe, elle, est celle du contrat : `Paginated<T>` (:319-322), keyset,
 * curseur opaque, limite plafonnee a 100 (`extractors/pagination.rs:1-3`).
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite, type Curseur } from "@/mocks/curseur";
import {
  activiteDe,
  comparerParEnseigne,
  comptesPartenaires,
  trouverAdministrateur,
  trouverVille,
  type FiltreComptes,
  type PartenaireMagasin,
  type StatutPartenaire,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const STATUTS: readonly StatutPartenaire[] = [
  "pending",
  "approved",
  "rejected",
  "suspended",
  "closed",
];

function estStatut(valeur: string): valeur is StatutPartenaire {
  return STATUTS.some((statut) => statut === valeur);
}

function enCompte(partenaire: PartenaireMagasin): Record<string, unknown> {
  const ville = partenaire.cityId === null ? undefined : trouverVille(partenaire.cityId);
  const activite = activiteDe(partenaire.id);
  return {
    /* Les champs du contrat, aux memes noms que `PartnerReviewItem`. */
    id: partenaire.id,
    legal_name: partenaire.legalName,
    trade_name: partenaire.tradeName,
    category: partenaire.category,
    ifu: partenaire.ifu,
    service_mode: partenaire.serviceMode,
    city:
      ville === undefined
        ? null
        : { id: ville.id, name: ville.name, department: ville.department },
    district: partenaire.district,
    address_line: partenaire.addressLine,
    website_url: partenaire.websiteUrl,
    contact_email: partenaire.contactEmail,
    status: partenaire.statut,
    submitted_at: partenaire.submittedAt,

    /* Ce que le contrat n'expose pas. Voir l'en-tete du fichier. */
    reviewed_by: partenaire.reviewedBy,
    reviewed_at: partenaire.reviewedAt,
    review_reason: partenaire.reviewReason,
    total_received: euros(activite.totalRecuCentimes),
    transaction_count: activite.nombreTransactions,
  };
}

/**
 * Position du premier compte strictement apres le curseur.
 *
 * La comparaison passe par `comparerParEnseigne`, le MEME ordre que celui du
 * tri. Comparer avec `>` ici -- ce que fait la file de validation, ou les
 * horodatages ISO 8601 sont en ASCII et ou les deux ordres coincident -- casse
 * des qu'une enseigne porte un accent : « Épicerie » se range avant
 * « Librairie » en francais, apres en unites de code. Le curseur sautait alors
 * des lignes et bouclait.
 */
function apresLeCurseur(liste: PartenaireMagasin[], curseur: Curseur): number {
  const repere = { tradeName: curseur.valeurDeTri, id: curseur.id };
  return liste.findIndex((p) => comparerParEnseigne(p, repere) > 0);
}

export async function GET(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;

  const statutBrut = parametres.get("status");
  if (statutBrut !== null && statutBrut !== "" && !estStatut(statutBrut)) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre status n'est pas un statut connu.");
  }

  const limite = lireLimite(parametres.get("limit"));
  if (limite === null) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre limit doit être un entier positif.");
  }

  const texte = (nom: string): string | undefined => {
    const valeur = parametres.get(nom);
    return valeur !== null && valeur.trim() !== "" ? valeur : undefined;
  };

  /* Sans `status`, la liste porte TOUS les statuts : c'est un annuaire des
     comptes, pas une file. Le filtre est un choix de l'agent. */
  const filtre: FiltreComptes = {
    ...(statutBrut !== null && statutBrut !== "" && estStatut(statutBrut)
      ? { statut: statutBrut }
      : {}),
    ...(texte("category") !== undefined ? { categorie: texte("category") as string } : {}),
    ...(texte("city") !== undefined ? { ville: texte("city") as string } : {}),
    ...(texte("q") !== undefined ? { recherche: texte("q") as string } : {}),
  };

  const liste = comptesPartenaires(filtre);

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
    items: page.map(enCompte),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({ valeurDeTri: dernier.tradeName, id: dernier.id })
        : null,
  });
}
