/**
 * `GET /api/v1/admin/audit/verify` — vérification d'intégrité de la chaîne.
 *
 * ✅ CELLE-CI EST LEUR ROUTE, et sa forme est respectée à la lettre :
 * `ChainVerification { valid, checked_entries, first_invalid_seq }`
 * (`docs/data-dictionary.md:575-580`). Trois champs, ces noms-là, ce
 * `snake_case`-là. Rien n'est ajouté.
 *
 * Logique : `verify_chain(from_seq)` de `ledger/balance.rs:1-2`, « returning
 * the first inconsistent seq ». Le paramètre `from_seq` n'apparaît pas dans le
 * contrat de la route, seulement dans la signature Rust ; il est accepté ici
 * sous le nom `from_seq`, et c'est NOTRE ajout — sans lui la route ne sait pas
 * reprendre une vérification partielle sur un long journal.
 *
 * `valid: false` n'est PAS une erreur HTTP. La route a fonctionné ; c'est le
 * journal qui est en défaut. Répondre 500 masquerait la différence entre
 * « le service est tombé » et « quelqu'un a touché au registre » — la seconde
 * demande une enquête, pas un redémarrage.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { trouverAdministrateur } from "@/mocks/magasin";
import { verifierChaine } from "@/mocks/registre";

export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const brut = new URL(requete.url).searchParams.get("from_seq");
  let depuis = 1;
  if (brut !== null && brut !== "") {
    const valeur = Number(brut);
    if (!Number.isInteger(valeur) || valeur < 1) {
      return erreur(422, "VALIDATION_FAILED", "Le paramètre from_seq doit être un entier positif.");
    }
    depuis = valeur;
  }

  const resultat = verifierChaine(depuis);
  return succes({
    valid: resultat.valid,
    checked_entries: resultat.checkedEntries,
    first_invalid_seq: resultat.firstInvalidSeq,
  });
}
