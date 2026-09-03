/**
 * `GET /api/v1/catalog?city=&service_mode=&q=&cursor=` — le réseau des agréés.
 *
 * ✅ CELLE-CI EST LEUR ROUTE. `CatalogItem` est servi champ pour champ, les
 * neuf du contrat (`docs/data-dictionary.md:470-481`), dans l'enveloppe
 * `Paginated<T>` qu'il annote explicitement (:481).
 *
 * Trois règles viennent de `core/src/partners/catalog.rs:1-3`, et les trois
 * sont tenues ici :
 *
 *   1. `status = 'approved'` — SEULS LES AGRÉÉS y figurent. Un dossier en
 *      attente, refusé, suspendu ou fermé n'est pas dans le réseau, et un
 *      commerçant ne doit pas pouvoir déduire du catalogue qu'un concurrent
 *      a été refusé.
 *   2. Keyset sur `(trade_name, id)`, jamais `OFFSET`.
 *   3. Amendement A1 : « an online partner comes back whatever the city filter
 *      says ». Un commerce en ligne n'a pas de ville — le filtrer par ville le
 *      ferait disparaître alors qu'il sert justement tout le monde.
 *
 * ⚠ UN FILTRE DE PLUS, MARQUÉ COMME NÔTRE : `category`. Le contrat n'en a pas
 * — ses quatre filtres sont `city`, `service_mode`, `q` et `cursor` — alors que
 * `category` est servi sur chaque fiche. Sans lui, « qui fait quoi » se cherche
 * à la main dans la recherche texte. Le nom suit celui du champ.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite } from "@/mocks/curseur";
import {
  comparerParEnseigne,
  comptesPartenaires,
  trouverPartenaire,
  trouverVille,
  type ModeService,
  type PartenaireMagasin,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const MODES: readonly ModeService[] = ["physical", "online", "both"];

function estMode(valeur: string): valeur is ModeService {
  return MODES.some((m) => m === valeur);
}

function enCatalogItem(partenaire: PartenaireMagasin): Record<string, unknown> {
  const ville = partenaire.cityId === null ? undefined : trouverVille(partenaire.cityId);
  return {
    id: partenaire.id,
    trade_name: partenaire.tradeName,
    category: partenaire.category,
    service_mode: partenaire.serviceMode,
    /* `null` si le commerce est exclusivement en ligne (:475). */
    city:
      ville === undefined
        ? null
        : { id: ville.id, name: ville.name, department: ville.department },
    district: partenaire.district,
    address_line: partenaire.addressLine,
    website_url: partenaire.websiteUrl,
    /* Amendement A4 : dérivé de `status === "approved"`, jamais stocké (:670).
       Le catalogue ne servant que des agréés, il vaut toujours `true` — mais on
       le dérive quand même plutôt que d'écrire la constante, pour que le jour
       où le filtre change, le champ suive. */
    is_official_partner: partenaire.statut === "approved",
  };
}

export async function GET(requete: Request): Promise<Response> {
  /* « open to any authenticated user » (`routes/catalog.rs:2`) : un partenaire
     comme un salarié. On vérifie qu'il y a bien quelqu'un, pas qui. */
  const partenaireId = identite(requete, "X-Mock-Partenaire", "PRT-001");
  if (!trouverPartenaire(partenaireId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;

  const limite = lireLimite(parametres.get("limit"));
  if (limite === null) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre limit doit être un entier positif.");
  }

  const mode = parametres.get("service_mode");
  if (mode !== null && mode !== "" && !estMode(mode)) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre service_mode n'est pas un mode connu.");
  }

  const texte = (nom: string): string | undefined => {
    const valeur = parametres.get(nom);
    return valeur !== null && valeur.trim() !== "" ? valeur.trim() : undefined;
  };

  /* Seuls les agréés : c'est la règle 1, et elle n'est pas un filtre que
     l'appelant pourrait lever. */
  let liste = comptesPartenaires({
    statut: "approved",
    ...(texte("category") !== undefined ? { categorie: texte("category") as string } : {}),
    ...(texte("q") !== undefined ? { recherche: texte("q") as string } : {}),
  });

  /*
   * Le filtre ville, avec l'exception A1.
   *
   * Il n'est PAS délégué à `comptesPartenaires` : celui-ci écarte tout ce qui
   * n'est pas dans la ville, commerces en ligne compris. Or un partenaire
   * `online` doit remonter quel que soit le filtre ville — il sert toute la
   * population, pas une commune.
   */
  const ville = texte("city");
  if (ville !== undefined) {
    const sansAccent = (t: string): string =>
      t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    liste = liste.filter((partenaire) => {
      if (partenaire.serviceMode === "online") return true;
      const nom = partenaire.cityId === null ? null : trouverVille(partenaire.cityId)?.name;
      return nom !== undefined && nom !== null && sansAccent(nom).includes(sansAccent(ville));
    });
  }

  if (mode !== null && mode !== "" && estMode(mode)) {
    liste = liste.filter((partenaire) => partenaire.serviceMode === mode);
  }

  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    /* Le MÊME ordre que le tri, `comparerParEnseigne` : comparer avec `>` ici
       ferait boucler la pagination dès qu'une enseigne porte un accent. */
    const repere = { tradeName: curseur.valeurDeTri, id: curseur.id };
    const position = liste.findIndex((p) => comparerParEnseigne(p, repere) > 0);
    debut = position === -1 ? liste.length : position;
  }

  const page = liste.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < liste.length;

  return succes({
    items: page.map(enCatalogItem),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({ valeurDeTri: dernier.tradeName, id: dernier.id })
        : null,
  });
}
