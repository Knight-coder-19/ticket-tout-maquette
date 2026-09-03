/**
 * `GET /api/v1/partner/account` — l'état du compte, vu par son titulaire.
 *
 * ========================================================================
 * CETTE ROUTE EST DE NOTRE FAIT, ET ELLE COMBLE UN MANQUE DU CONTRAT
 * ========================================================================
 *
 * La section 4.5 « Espace partenaire » (`docs/data-dictionary.md:415-462`)
 * expose quatre routes : `summary`, `transactions`, `payments` et
 * `payments/batch`. AUCUNE ne dit à un partenaire dans quel état est son
 * compte, ni pourquoi.
 *
 * L'intention, elle, existe : la section 3.6 marque `review_reason` d'un ✅ avec
 * la mention « visible du partenaire en cas de rejet » (:158). Le back veut donc
 * que le commerçant lise le motif de son refus — il n'a simplement pas de route
 * pour le lui servir.
 *
 * Le plus proche est `PartnerSummary.is_official_partner` (:424), un booléen
 * dérivé de `status === "approved"`. Il ne distingue ni un dossier en attente,
 * ni un refus, ni une suspension, ni une fermeture — quatre situations qui
 * appellent quatre messages différents. Un booléen ne peut pas porter cela.
 *
 * Les noms de champs sont ceux des colonnes de `partners`
 * (`0001_schema.sql:98-124`), en snake_case comme le reste du contrat.
 *
 * ⚠ Ce qu'elle N'expose PAS, et délibérément : `reviewed_by`. Un partenaire n'a
 * pas à savoir quel agent a tranché son dossier — la nommer exposerait une
 * personne à la contestation d'un commerçant mécontent, et cette identité ne
 * lui apprend rien sur sa situation.
 *
 * ─── `legal_name` et `ifu` : correction d'une lecture trop large ───
 *
 * Ces deux champs ont d'abord été écartés d'ici, au même titre que
 * `reviewed_by`, parce que la section 3.6 les marque ⚠️ « exposé uniquement à
 * l'administration ». C'était confondre deux choses.
 *
 * Le marqueur dit sur quelle SURFACE un champ paraît, pas qui en est le
 * propriétaire. Ce qu'il interdit est écrit en toutes lettres à la section 4.6
 * (:356) : `legal_name` et `ifu` sont proscrits du catalogue, avec les
 * montants, l'adresse précise et les contacts. Il protège un commerçant du
 * regard des AUTRES.
 *
 * Or le lecteur est ici le titulaire lui-même. Ce sont ses propres
 * déclarations d'adhésion, que `PartnerReviewItem` (:492-496) rend déjà telles
 * quelles à l'agent instructeur. Les lui cacher ne protégerait personne et lui
 * masquerait une éventuelle coquille dans son identifiant fiscal — la seule
 * chose qu'il puisse signaler.
 *
 * La route d'administration, elle, n'est pas touchée.
 */

import { erreur, identite, succes } from "@/mocks/enveloppe";
import { trouverPartenaire, trouverVille } from "@/mocks/magasin";

export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const partenaireId = identite(requete, "X-Mock-Partenaire", "PRT-001");
  const partenaire = trouverPartenaire(partenaireId);
  if (!partenaire) {
    return erreur(401, "UNAUTHORIZED", "Session absente ou expirée.");
  }

  const ville = partenaire.cityId === null ? undefined : trouverVille(partenaire.cityId);

  return succes({
    id: partenaire.id,
    trade_name: partenaire.tradeName,
    legal_name: partenaire.legalName,
    ifu: partenaire.ifu,
    category: partenaire.category,
    service_mode: partenaire.serviceMode,
    status: partenaire.statut,
    /* Le motif de la dernière décision. `null` tant qu'aucune n'a été prise. */
    review_reason: partenaire.reviewReason,
    reviewed_at: partenaire.reviewedAt,
    submitted_at: partenaire.submittedAt,
    contact_email: partenaire.contactEmail,
    city: ville === undefined ? null : { id: ville.id, name: ville.name, department: ville.department },
  });
}
