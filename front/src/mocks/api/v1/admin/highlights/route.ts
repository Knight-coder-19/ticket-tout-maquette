/**
 * `GET|POST /api/v1/admin/highlights` — la sélection du Ministre.
 *
 * ✅ CES QUATRE ROUTES SONT DU CONTRAT (`data-dictionary.md:513-534`), confirmées
 * par `front/docs/contrat-api.md:158-161` : `GET` filtre par `placement`,
 * `POST` crée, `DELETE /{id}` retire, `PUT /reorder` réordonne. Rien n'y
 * manque côté surface — ce fichier ne comble aucun trou de route, seulement
 * un trou de champ.
 *
 * ════════════════════════════════════════════════════════════════════════
 * ⚠⚠ `note` — LE MOT DU MINISTRE, UN CHAMP QUE LA TABLE NE PORTE PAS
 * ════════════════════════════════════════════════════════════════════════
 *
 * `partner_highlights` (`0001_schema.sql:128-138`) a sept colonnes : id,
 * partner_id, placement, position, created_by, created_at, removed_at. Aucun
 * texte. `HighlightItem` et `CreateHighlightRequest` (:513-527) n'en portent
 * pas davantage.
 *
 * L'écran le demande pourtant explicitement : un mot du ministre, facultatif,
 * qui paraît sur la vitrine publique tel quel. Sans colonne pour le recevoir,
 * il n'y a que deux issues honnêtes — l'inventer et le marquer, ou refuser de
 * construire ce que l'énoncé demande. La première est retenue ; elle est
 * documentée en détail dans `types/api.ts` (`HighlightItem.note`) et surtout
 * dans `types/api.ts`, `PublicPartner.note`, où le même champ traverse la
 * règle R9 — LA vraie décision de ce fichier est là-bas, pas ici.
 *
 * ─── L'ÉLIGIBILITÉ EST IMPOSÉE ICI, PAS SEULEMENT AU FILTRAGE ───
 *
 * `highlights.rs:1` dit « list joins on status = 'approved' » — seulement pour
 * la LECTURE. `data-dictionary.md:143` va plus loin : « seul un partenaire
 * approved est éligible » est une règle « portée par le code », pas seulement
 * par la requête de lecture. `ajouterMiseEnAvant` (`mocks/magasin.ts`) la fait
 * respecter à l'ÉCRITURE : un partenaire suspendu ne peut pas être ajouté,
 * quand bien même il figurerait encore dans une vieille liste côté client.
 * L'erreur `422 HIGHLIGHT_NOT_ELIGIBLE` est déjà nommée dans
 * `front/docs/contrat-api.md:230`.
 *
 * ─── LES DEUX STATUTS NON ÉCRITS ───
 *
 * `POST` « renvoie un corps » sans statut annoté (:522, ambiguïté A3 de
 * l'audit). NOTRE CHOIX : `201`, comme pour une régularisation — la route
 * crée une ressource.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import {
  ajouterMiseEnAvant,
  misesEnAvantActives,
  versHighlightItem,
  trouverAdministrateur,
  type EchecMiseEnAvant,
  type Emplacement,
} from "@/mocks/magasin";

export const dynamic = "force-dynamic";

const EMPLACEMENTS: readonly Emplacement[] = ["minister_pick", "public_featured"];

function estEmplacement(valeur: string): valeur is Emplacement {
  return EMPLACEMENTS.some((e) => e === valeur);
}


export async function GET(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const emplacementBrut = new URL(requete.url).searchParams.get("placement");
  if (emplacementBrut === null || !estEmplacement(emplacementBrut)) {
    return erreur(422, "VALIDATION_FAILED", "Le paramètre placement doit valoir minister_pick ou public_featured.");
  }

  return succes(
    misesEnAvantActives(emplacementBrut)
      .map(versHighlightItem)
      .filter((item): item is Record<string, unknown> => item !== null),
  );
}

const ECHECS: Record<EchecMiseEnAvant, { statut: number; code: string; message: string }> = {
  partenaire_introuvable: {
    statut: 404,
    code: "NOT_FOUND",
    message: "Ce partenaire n'existe pas.",
  },
  partenaire_non_agree: {
    statut: 422,
    code: "HIGHLIGHT_NOT_ELIGIBLE",
    message: "Seul un partenaire agréé peut être mis en avant.",
  },
  deja_en_avant: {
    statut: 409,
    code: "HIGHLIGHT_DUPLICATE",
    message: "Ce partenaire est déjà mis en avant sur cet emplacement.",
  },
};

export async function POST(requete: Request): Promise<Response> {
  const administrateurId = identite(requete, "X-Mock-Administrateur", "ADM-001");
  if (!trouverAdministrateur(administrateurId)) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return erreur(422, "VALIDATION_FAILED", "Le corps de la requête n'est pas du JSON.");
  }
  const donnees = (corps ?? {}) as Record<string, unknown>;

  const partenaireId = donnees["partner_id"];
  if (typeof partenaireId !== "string" || partenaireId.trim() === "") {
    return erreur(422, "VALIDATION_FAILED", "partner_id est requis.");
  }

  const emplacementBrut = donnees["placement"];
  if (typeof emplacementBrut !== "string" || !estEmplacement(emplacementBrut)) {
    return erreur(422, "VALIDATION_FAILED", "placement doit valoir minister_pick ou public_featured.");
  }

  const positionBrute = donnees["position"];
  if (positionBrute !== null && (typeof positionBrute !== "number" || !Number.isInteger(positionBrute) || positionBrute < 1)) {
    return erreur(422, "VALIDATION_FAILED", "position doit être un entier positif, ou null.");
  }

  const noteBrute = donnees["note"];
  if (noteBrute !== undefined && noteBrute !== null && typeof noteBrute !== "string") {
    return erreur(422, "VALIDATION_FAILED", "note doit être une chaîne, ou null.");
  }

  const issue = ajouterMiseEnAvant(
    partenaireId,
    emplacementBrut,
    positionBrute,
    typeof noteBrute === "string" ? noteBrute : null,
    administrateurId,
    Date.now(),
  );
  if ("echec" in issue) {
    const refus = ECHECS[issue.echec];
    return erreur(refus.statut, refus.code, refus.message);
  }

  const item = versHighlightItem(issue.miseEnAvant);
  if (item === null) {
    return erreur(404, "NOT_FOUND", "Ce partenaire n'existe pas.");
  }
  return succes(item, 201);
}
