/**
 * `GET /api/v1/admin/employees?q=&status=&employer=&cursor=&limit=`
 *
 * Le répertoire des bénéficiaires.
 *
 * ========================================================================
 * CETTE ROUTE EST DE NOTRE FAIT — LE RÉPERTOIRE EXISTE, RIEN NE L'EXPOSE
 * ========================================================================
 *
 * Les tables sont là : `employees` (`0001_schema.sql:71-78`), `employers`
 * (`:37-45`), `employment_links` (`:80-96`), avec leurs index
 * `uq_active_employment` et `uq_employer_ref`. Le module aussi :
 * `directory/employees.rs`, `employment.rs`, `employers.rs`, `repo.rs`.
 *
 * Mais la section 4 du contrat n'a AUCUNE route qui les lise. Les seules
 * lectures d'un salarié sont `GET /me/balance` et `GET /me/transactions` — le
 * salarié pour lui-même — et `GET /integration/employees/{employer_ref}/balance`,
 * réservée au SIRH d'un employeur, qui rend un solde et rien d'autre.
 *
 * `directory/employees.rs:2` nomme d'ailleurs `resolve_by_employer_ref` comme
 * servant « the SIRH API and the CSV import » : le répertoire est écrit pour
 * être ALIMENTÉ, pas pour être consulté. L'administration n'a aucun moyen de
 * voir qui elle administre.
 *
 * Les noms de champs sont ceux des colonnes, en `snake_case` comme le reste du
 * contrat. L'enveloppe est leur `Paginated<T>` (:319-322).
 *
 * ─── Ce qu'elle joint, et pourquoi ───
 *
 * L'employeur et le matricule ne sont PAS sur `employees` : ils sont sur le
 * lien d'emploi actif. Les faire joindre par l'écran l'obligerait à charger
 * tout le référentiel des employeurs pour afficher une colonne.
 *
 * Le solde vient du REGISTRE, jamais d'un champ : `soldeDe` le recalcule
 * depuis les écritures (invariant I2). C'est `available` qui est servi en
 * colonne — « c'est CE nombre qu'on affiche en grand » (:378). Les trois
 * soldes sont sur la fiche : un répertoire n'est pas l'endroit où expliquer
 * une réservation.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite } from "@/mocks/curseur";
import {
  magasin,
  nomComplet,
  sansAccent,
  soldeDe,
  trouverAdministrateur,
  trouverEmployeur,
  type SalarieMagasin,
  type StatutSalarie,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const STATUTS: readonly StatutSalarie[] = ["actif", "suspendu", "ferme"];

function estStatut(valeur: string): valeur is StatutSalarie {
  return STATUTS.some((s) => s === valeur);
}

/**
 * La clé de tri d'un salarié : `(last_name, first_name, id)`.
 *
 * L'identifiant ferme l'ordre. Deux homonymes complets sans lui rendraient la
 * pagination par curseur non déterministe — c'est le défaut qui avait fait
 * boucler le catalogue.
 *
 * ⚠ Comparaison de points de code, PAS `localeCompare`. Le curseur avance avec
 * `>` ; trier dans un ordre et avancer dans un autre fait répéter des lignes
 * et n'arrive jamais au bout. Le repliage des accents fait le travail que
 * `localeCompare` aurait fait, sans en changer l'ordre.
 *
 * ⚠ LE SÉPARATEUR EST `\u001f`, ET SÛREMENT PAS `\u0000`. Ce dernier est celui
 * de `encoderCurseur`/`decoderCurseur` (`mocks/curseur.ts`) : une clé qui le
 * contiendrait serait recoupée au décodage, et le repère ne porterait plus que
 * le nom de famille. Chaque page répétait alors sa dernière ligne — le défaut
 * a été trouvé au banc, pas à la lecture.
 */
const SEPARATEUR = "\u001f";

function cleDeTri(salarie: SalarieMagasin): string {
  return [sansAccent(salarie.nom), sansAccent(salarie.prenom), salarie.id].join(SEPARATEUR);
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

  const texte = (nom: string): string | undefined => {
    const valeur = parametres.get(nom);
    return valeur !== null && valeur.trim() !== "" ? valeur.trim() : undefined;
  };

  const statut = texte("status");
  if (statut !== undefined && !estStatut(statut)) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre status n'est pas un statut connu.");
  }

  const recherche = texte("q");
  const employeur = texte("employer");
  const maintenant = Date.now();

  const retenus = magasin.salaries
    .filter((salarie) => {
      if (statut !== undefined && salarie.statut !== statut) return false;
      if (employeur !== undefined && salarie.employeurId !== employeur) return false;
      if (recherche !== undefined) {
        /* Le nom, le prénom ET le matricule : un agent qui a un matricule sous
           les yeux ne devrait pas avoir à deviner le nom qui va avec. */
        const foin = sansAccent(`${salarie.prenom} ${salarie.nom} ${salarie.matricule}`);
        if (!foin.includes(sansAccent(recherche))) return false;
      }
      return true;
    })
    .sort((a, b) => (cleDeTri(a) < cleDeTri(b) ? -1 : cleDeTri(a) > cleDeTri(b) ? 1 : 0));

  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    /* Le repère est reconstruit dans le format EXACT de `cleDeTri` : le
       curseur transporte le couple (nom, prénom) d'un côté et l'identifiant de
       l'autre, parce que `decoderCurseur` les sépare ainsi. */
    const repere = `${curseur.valeurDeTri}${SEPARATEUR}${curseur.id}`;
    const position = retenus.findIndex((salarie) => cleDeTri(salarie) > repere);
    debut = position === -1 ? retenus.length : position;
  }

  const page = retenus.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < retenus.length;

  return succes({
    items: page.map((salarie) => {
      const solde = soldeDe(salarie.id, maintenant);
      const employeurDuSalarie = trouverEmployeur(salarie.employeurId);
      return {
        id: salarie.id,
        last_name: salarie.nom,
        first_name: salarie.prenom,
        display_name: nomComplet(salarie),
        employer:
          employeurDuSalarie === undefined
            ? null
            : { id: employeurDuSalarie.id, legal_name: employeurDuSalarie.legalName },
        employer_ref: salarie.matricule,
        status: salarie.statut,
        available: euros(solde?.disponibleCentimes ?? 0),
      };
    }),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({
            valeurDeTri: [sansAccent(dernier.nom), sansAccent(dernier.prenom)].join(SEPARATEUR),
            id: dernier.id,
          })
        : null,
  });
}
