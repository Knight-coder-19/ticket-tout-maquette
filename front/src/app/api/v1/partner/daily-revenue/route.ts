/**
 * `GET /api/v1/partner/daily-revenue?to=&days=` — les recettes jour par jour.
 *
 * ========================================================================
 * CETTE ROUTE EST DE NOTRE FAIT
 * ========================================================================
 *
 * `GET /api/v1/partner/summary` (`data-dictionary.md:418-425`) rend quatre
 * agrégats sur UNE période : un cumul, un compte, deux bornes. Elle ne donne
 * aucune série journalière, et aucune autre route du contrat n'en donne — la
 * §4.5 en compte quatre en tout, et le tableau de bord national (:561-573)
 * agrège par ville, pas par jour.
 *
 * Un commerçant qui ouvre son espace le matin veut voir son rythme : quatorze
 * appels à `summary`, un par jour, seraient absurdes. D'où cette route.
 *
 * Les noms suivent ceux du contrat : `total_received` et `transaction_count`
 * sont ceux de `PartnerSummary`, repris par jour. `day` est en `YYYY-MM-DD`,
 * le type `DATE` du dictionnaire (:41).
 *
 * ⚠ LES JOURS SANS RECETTE SONT SERVIS, à zéro. Sauter les journées vides
 * laisserait croire à quatorze jours d'activité là où il y en a eu six : c'est
 * au graphique de montrer les creux, pas à la route de les cacher.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { trouverPartenaire } from "@/mocks/magasin";
import { serieJournaliere } from "@/mocks/recettes";

export const dynamic = "force-dynamic";

/** Bornes de la fenêtre. Quatorze jours par défaut : deux semaines pleines. */
const JOURS_PAR_DEFAUT = 14;
const JOURS_MAXIMUM = 92;

export async function GET(requete: Request): Promise<Response> {
  const partenaireId = identite(requete, "X-Mock-Partenaire", "PRT-001");
  if (!trouverPartenaire(partenaireId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;

  const brutJours = parametres.get("days");
  let jours = JOURS_PAR_DEFAUT;
  if (brutJours !== null && brutJours !== "") {
    const valeur = Number(brutJours);
    if (!Number.isInteger(valeur) || valeur < 1 || valeur > JOURS_MAXIMUM) {
      return erreur(
        422,
        "VALIDATION_FAILED",
        `Le paramètre days doit être un entier entre 1 et ${JOURS_MAXIMUM}.`,
      );
    }
    jours = valeur;
  }

  const brutFin = parametres.get("to");
  const fin = brutFin === null || brutFin === "" ? new Date(Date.now()).toISOString() : brutFin;
  if (!Number.isFinite(Date.parse(fin))) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre to doit être une date ISO 8601.");
  }

  const serie = serieJournaliere(partenaireId, fin, jours);

  return succes({
    days: serie.map((journee) => ({
      day: journee.jour,
      total_received: euros(journee.totalCentimes),
      transaction_count: journee.nombre,
    })),
  });
}
