/**
 * `GET /api/v1/admin/dashboard?from=&to=` — le tableau de bord national.
 *
 * ✅ ROUTE DU CONTRAT (`data-dictionary.md:561-573`). `Dashboard` : un volume
 * et un décompte sur la période, trois compteurs d'état, une ventilation par
 * ville, et le bloc `online_partners` — **indispensable**, l'amendement A1 le
 * dit noir sur blanc : sans lui, « la somme des `by_city` ne vaut plus
 * `total_volume` », les commerces en ligne n'appartenant à aucune ville.
 *
 * ─── LES TROIS COMPTEURS D'ÉTAT NE SONT PAS FENÊTRÉS ───
 *
 * `active_partners`, `pending_partners`, `active_employees` répondent à
 * « combien MAINTENANT », pas « combien sur la période » : le DTO les pose à
 * côté des agrégats fenêtrés sans leur donner de borne propre. Un partenaire
 * agréé la semaine dernière reste compté aujourd'hui même si `from`/`to`
 * cible une période plus ancienne.
 *
 * ════════════════════════════════════════════════════════════════════════
 * ⚠⚠ DEUX AJOUTS, POUR LES DEUX ÉCRANS QUE LE DTO NE PERMET PAS DE SERVIR
 * ════════════════════════════════════════════════════════════════════════
 *
 * `by_category` — même raison que le référentiel de catégories du catalogue :
 * sans lui, une répartition par catégorie devrait soit être écrite en dur
 * (interdit, B. Sellami), soit dérivée de `by_city` (impossible, la ville et
 * la catégorie sont deux dimensions indépendantes).
 *
 * `weekly` — le DTO agrège sur TOUTE la période, un seul nombre. Aucune route
 * du contrat ne donne de série temporelle nationale ; la seule qui existe,
 * `GET /partner/daily-revenue`, est elle-même de notre fait et scopée à UN
 * partenaire. `VolumeHebdomadaire` (l'écran) a besoin d'un point par semaine,
 * pas d'un total.
 *
 * Les deux suivent la forme de `by_city` : `volume`, `transaction_count`, en
 * plus de leur propre dimension.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import {
  magasin,
  paiementsNationaux,
  partenairesParStatut,
  trouverAdministrateur,
  trouverPartenaire,
  trouverVille,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

/** Fenêtre par défaut : huit semaines pleines, faute de `from`/`to`. */
const JOURS_PAR_DEFAUT = 56;
const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

/** Le lundi de la semaine ISO contenant `iso`, en `YYYY-MM-DD`. */
function lundiDe(iso: string): string {
  const instant = new Date(iso);
  const jourSemaine = instant.getUTCDay();
  /* `getUTCDay()` rend 0 pour dimanche : on recule de 6 jours ce jour-là,
     sinon de `jourSemaine - 1`, pour retomber sur le lundi ISO. */
  const decalage = jourSemaine === 0 ? 6 : jourSemaine - 1;
  const lundi = new Date(instant);
  lundi.setUTCDate(instant.getUTCDate() - decalage);
  return lundi.toISOString().slice(0, 10);
}

export async function GET(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const parametres = new URL(requete.url).searchParams;
  const texte = (nom: string): string | undefined => {
    const valeur = parametres.get(nom);
    return valeur !== null && valeur.trim() !== "" ? valeur.trim() : undefined;
  };

  for (const borne of ["from", "to"]) {
    const valeur = texte(borne);
    if (valeur !== undefined && !Number.isFinite(Date.parse(valeur))) {
      return erreur(422, "VALIDATION_FAILED", `Le paramètre ${borne} doit être une date ISO 8601.`);
    }
  }

  const maintenant = Date.now();
  const to = texte("to") ?? new Date(maintenant).toISOString();
  const from =
    texte("from") ?? new Date(Date.parse(to) - JOURS_PAR_DEFAUT * MILLISECONDES_PAR_JOUR).toISOString();

  const retenus = paiementsNationaux().filter((ligne) => {
    const quand = ligne.operation.occurredAt;
    return quand >= from && quand <= to;
  });

  /* ── Le volume et le décompte, sur la période, NETS des annulations ────── */
  let totalVolumeCentimes = 0;
  let transactionCount = 0;
  for (const ligne of retenus) {
    transactionCount += 1;
    if (!ligne.annulee) totalVolumeCentimes += ligne.montantCentimes;
  }

  /* ── Par ville, et le bloc online_partners À PART (A1) ──────────────────── */
  const parVille = new Map<string, { volumeCentimes: number; count: number }>();
  let volumeEnLigneCentimes = 0;
  let countEnLigne = 0;
  const parCategorie = new Map<string, { volumeCentimes: number; count: number }>();
  const parSemaine = new Map<string, { volumeCentimes: number; count: number }>();

  for (const ligne of retenus) {
    const partenaire = trouverPartenaire(ligne.partenaireId);
    if (!partenaire) continue;
    const montant = ligne.annulee ? 0 : ligne.montantCentimes;

    if (partenaire.cityId === null) {
      volumeEnLigneCentimes += montant;
      countEnLigne += 1;
    } else {
      const courant = parVille.get(partenaire.cityId) ?? { volumeCentimes: 0, count: 0 };
      parVille.set(partenaire.cityId, {
        volumeCentimes: courant.volumeCentimes + montant,
        count: courant.count + 1,
      });
    }

    const courantCat = parCategorie.get(partenaire.category) ?? { volumeCentimes: 0, count: 0 };
    parCategorie.set(partenaire.category, {
      volumeCentimes: courantCat.volumeCentimes + montant,
      count: courantCat.count + 1,
    });

    const semaine = lundiDe(ligne.operation.occurredAt);
    const courantSem = parSemaine.get(semaine) ?? { volumeCentimes: 0, count: 0 };
    parSemaine.set(semaine, {
      volumeCentimes: courantSem.volumeCentimes + montant,
      count: courantSem.count + 1,
    });
  }

  /* Toutes les semaines de la fenêtre sont servies, même à zéro : sauter une
     semaine sans activité laisserait croire à un trou dans les données plutôt
     qu'à une semaine réellement calme -- même règle que
     `partner/daily-revenue`. */
  const semaines: string[] = [];
  for (let curseur = lundiDe(from); curseur <= lundiDe(to); ) {
    semaines.push(curseur);
    const suivante = new Date(`${curseur}T00:00:00.000Z`);
    suivante.setUTCDate(suivante.getUTCDate() + 7);
    curseur = suivante.toISOString().slice(0, 10);
  }

  return succes({
    total_volume: euros(totalVolumeCentimes),
    transaction_count: transactionCount,
    active_partners: partenairesParStatut("approved").length,
    pending_partners: partenairesParStatut("pending").length,
    active_employees: magasin.salaries.filter((s) => s.statut === "actif").length,
    by_city: [...parVille.entries()]
      .map(([cityId, agrege]) => {
        const ville = trouverVille(cityId);
        return ville === undefined
          ? null
          : {
              city: { id: ville.id, name: ville.name, department: ville.department },
              volume: euros(agrege.volumeCentimes),
              transaction_count: agrege.count,
            };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => b.volume - a.volume),
    online_partners: {
      volume: euros(volumeEnLigneCentimes),
      transaction_count: countEnLigne,
    },
    /* ⚠ Notre ajout. */
    by_category: [...parCategorie.entries()]
      .map(([category, agrege]) => ({
        category,
        volume: euros(agrege.volumeCentimes),
        transaction_count: agrege.count,
      }))
      .sort((a, b) => b.volume - a.volume),
    /* ⚠ Notre ajout. Chaque semaine de la fenêtre, même à zéro. */
    weekly: semaines.map((semaine) => {
      const agrege = parSemaine.get(semaine) ?? { volumeCentimes: 0, count: 0 };
      return {
        week_start: semaine,
        volume: euros(agrege.volumeCentimes),
        transaction_count: agrege.count,
      };
    }),
  });
}
