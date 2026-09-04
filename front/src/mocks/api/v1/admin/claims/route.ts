/**
 * `GET /api/v1/admin/claims?status=&cursor=&limit=` — la file des réclamations.
 *
 * ════════════════════════════════════════════════════════════════════════
 * ⚠⚠ CETTE ROUTE, ET LES TROIS AUTRES DE `admin/claims/`, SONT ENTIÈREMENT
 * DE NOTRE FAIT.
 * ════════════════════════════════════════════════════════════════════════
 *
 * Aucune route, aucune table, aucun module ne couvre ce domaine côté back —
 * vérifié dans l'audit initial (`front/docs/contrat-api.md:376`) et jamais
 * contredit depuis. Le modèle est posé une fois dans `types/domaine.ts`
 * (`Reclamation`) ; les noms de champs suivent malgré tout la convention du
 * reste du contrat, anglais et `snake_case`.
 *
 * ─── SANS FILTRE, LES DOSSIERS CLOS N'APPARAISSENT PAS ───
 *
 * « La file » est un espace de travail — les dossiers `close` n'y ont pas
 * leur place par défaut, exactement comme `Validations` ne montre que les
 * demandes `pending`. `FiltreStatut` permet de choisir explicitement
 * `status=closed` pour relire un dossier tranché.
 *
 * ─── LA PLUS ANCIENNE OUVERTE EN PREMIER ───
 *
 * Triée sur la date d'OUVERTURE du dossier, pas celle du dernier message :
 * un dossier qui attend depuis trois semaines reste le plus urgent même si
 * un autre, ouvert hier, a reçu une réponse ce matin.
 *
 * ─── L'EXTRAIT, PAS LE FIL ───
 *
 * Chaque ligne porte `last_message_excerpt` — le texte du DERNIER message,
 * tronqué — et pas le fil complet : transférer chaque message de chaque
 * dossier pour n'en montrer qu'un extrait serait disproportionné pour une
 * file qui peut compter des dizaines de dossiers.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite } from "@/mocks/curseur";
import {
  listerReclamations,
  nomComplet,
  trouverAdministrateur,
  trouverSalarie,
  type ReclamationMagasin,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const STATUTS = { open: "ouverte", in_progress: "en_cours", closed: "close" } as const;
type StatutWire = keyof typeof STATUTS;

function estStatutWire(valeur: string): valeur is StatutWire {
  return valeur === "open" || valeur === "in_progress" || valeur === "closed";
}

const LONGUEUR_EXTRAIT = 96;

/** Tronque sur un espace proche de la limite plutôt qu'au milieu d'un mot. */
function extrait(texte: string): string {
  if (texte.length <= LONGUEUR_EXTRAIT) return texte;
  const coupe = texte.slice(0, LONGUEUR_EXTRAIT);
  const dernierEspace = coupe.lastIndexOf(" ");
  return `${coupe.slice(0, dernierEspace > 40 ? dernierEspace : LONGUEUR_EXTRAIT)}…`;
}

function enListItem(r: ReclamationMagasin): Record<string, unknown> | null {
  const salarie = trouverSalarie(r.salarieId);
  if (!salarie) return null;
  const dernier = r.messages.at(-1);
  return {
    id: r.id,
    employee_id: r.salarieId,
    employee_name: nomComplet(salarie),
    status: (Object.keys(STATUTS) as StatutWire[]).find((k) => STATUTS[k] === r.statut) ?? "open",
    last_message_excerpt: dernier ? extrait(dernier.texte) : "",
    last_message_author: dernier?.auteur === "agent" ? "agent" : "employee",
    opened_at: r.ouverteLe,
  };
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

  const statutBrut = parametres.get("status");
  if (statutBrut !== null && statutBrut !== "" && !estStatutWire(statutBrut)) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre status n'est pas un statut connu.");
  }

  const liste = listerReclamations(
    statutBrut !== null && statutBrut !== "" && estStatutWire(statutBrut)
      ? STATUTS[statutBrut]
      : undefined,
  );

  /* La liste avance sur (ouverteLe, id) -- pas la seule date. Deux dossiers
     ouverts a la meme milliseconde, deux fois vu ce genre de defaut ailleurs
     dans ce projet (catalogue, repertoire), ne se departageraient pas sans
     l'identifiant : la pagination repeterait une ligne, ou en sauterait une. */
  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    const repereDate = curseur.valeurDeTri;
    const position = liste.findIndex(
      (r) => r.ouverteLe > repereDate || (r.ouverteLe === repereDate && r.id > curseur.id),
    );
    debut = position === -1 ? liste.length : position;
  }

  const page = liste.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < liste.length;

  return succes({
    items: page.map(enListItem).filter((item): item is Record<string, unknown> => item !== null),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({ valeurDeTri: dernier.ouverteLe, id: dernier.id })
        : null,
  });
}
