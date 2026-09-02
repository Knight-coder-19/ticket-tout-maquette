/**
 * `GET /api/v1/admin/partners?status=pending&cursor=` -- la file de validation.
 *
 * Contrat : `docs/data-dictionary.md:490-505`. Le DTO `PartnerReviewItem` est
 * servi champ pour champ, dans l'ordre du contrat.
 *
 * DEUX POINTS OU LE CONTRAT NE DIT RIEN, ET OU NOUS AVONS CHOISI
 *
 * 1. L'ENVELOPPE. La route accepte un `cursor` (:490) mais sa reponse n'est
 *    PAS annotee `Paginated<T>`, contrairement a `/me/transactions` (:392) et
 *    `/catalog` (:481). Liste nue ou enveloppe ? Le dictionnaire se tait.
 *    NOTRE CHOIX : `Paginated<T>`, soit `{ items, next_cursor }`. Un curseur
 *    en entree sans curseur en sortie ne se poursuit pas, et `Paginated<T>`
 *    est la seule enveloppe de pagination que le contrat definisse (:319-322).
 *    Ambiguite A7 de `front/docs/contrat-api.md`.
 *
 * 2. LE TRI. Rien n'est ecrit. NOTRE CHOIX : du plus ancien depot au plus
 *    recent, sur `(submitted_at, id)`. C'est une file d'attente : on traite
 *    d'abord ce qui attend depuis le plus longtemps. `catalog.rs:2` pagine sur
 *    `(trade_name, id)`, mais c'est un catalogue, pas une file.
 *
 * UNE CONTRADICTION DANS LEUR DOCUMENTATION, SIGNALEE SANS ETRE TRANCHEE
 *
 * La section 3.6 marque `reviewed_by` et `reviewed_at` comme exposes a
 * l'administration (:156-157) et `review_reason` comme visible du partenaire
 * (:158). Le DTO `PartnerReviewItem` de la section 4.7 ne porte AUCUN des
 * trois. Or la section 4 se declare seule autorite pour le front (:310).
 * Nous servons donc le DTO de la section 4, sans ces trois champs -- mais la
 * file de validation ne peut alors pas afficher qui a decide quoi. C'est le
 * journal (`/api/v1/admin/audit`) qui comble le trou, faute de mieux.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite, type Curseur } from "@/mocks/curseur";
import {
  partenairesParStatut,
  trouverAdministrateur,
  trouverVille,
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

/** `PartnerReviewItem`, `data-dictionary.md:491-505`. */
function enReviewItem(partenaire: PartenaireMagasin): Record<string, unknown> {
  const ville = partenaire.cityId === null ? undefined : trouverVille(partenaire.cityId);
  return {
    id: partenaire.id,
    legal_name: partenaire.legalName,
    trade_name: partenaire.tradeName,
    category: partenaire.category,
    ifu: partenaire.ifu,
    service_mode: partenaire.serviceMode,
    /* `null` si le partenaire est exclusivement en ligne (:498). */
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
  };
}

/** Position du premier element strictement apres le curseur. */
function apresLeCurseur(liste: PartenaireMagasin[], curseur: Curseur): number {
  return liste.findIndex(
    (p) =>
      p.submittedAt > curseur.valeurDeTri ||
      (p.submittedAt === curseur.valeurDeTri && p.id > curseur.id),
  );
}

export async function GET(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expiree.");
  }

  const parametres = new URL(requete.url).searchParams;

  const statutBrut = parametres.get("status") ?? "pending";
  if (!estStatut(statutBrut)) {
    return erreur(422, "VALIDATION_FAILED", "Le parametre status n'est pas un statut connu.");
  }

  const limite = lireLimite(parametres.get("limit"));
  if (limite === null) {
    return erreur(422, "VALIDATION_FAILED", "Le parametre limit doit etre un entier positif.");
  }

  const liste = partenairesParStatut(statutBrut);

  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    const position = apresLeCurseur(liste, curseur);
    /* Un curseur au-dela de la fin rend une page vide, pas une erreur : la
       liste a pu se vider entre deux appels, ce n'est pas une faute du client. */
    debut = position === -1 ? liste.length : position;
  }

  const page = liste.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < liste.length;

  return succes({
    items: page.map(enReviewItem),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({ valeurDeTri: dernier.submittedAt, id: dernier.id })
        : null,
  });
}
