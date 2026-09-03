/**
 * `GET /api/v1/admin/transactions?from=&to=&partner=&city=&category=&cursor=&limit=`
 *
 * L'activité nationale : qui a encaissé, où, combien, dans quelle catégorie.
 *
 * ========================================================================
 * CETTE ROUTE EST DE NOTRE FAIT
 * ========================================================================
 *
 * Le contrat n'expose, pour l'administration côté transactions, que des
 * AGRÉGATS : `GET /admin/dashboard` (`data-dictionary.md:561-573`) rend
 * `total_volume`, `transaction_count`, un `by_city` et un bloc
 * `online_partners`. Aucune ligne. La seule autre route d'audit,
 * `GET /admin/audit/verify` (:575-580), rend un booléen et deux compteurs.
 *
 * Un tableau de bord répond « combien » ; il ne répond pas « lesquelles ». Un
 * agent qui voit un volume anormal sur une ville n'a, avec le contrat seul,
 * aucun moyen de descendre aux opérations qui le composent.
 *
 * ─── Pourquoi pas `/admin/ledger-entries`, qui existe déjà ───
 *
 * Parce que ce n'est pas le même objet. Le registre sert des ÉCRITURES : deux
 * par opération, un débit et un crédit, avec leur empreinte et leur rang dans
 * la chaîne. C'est la vue comptable, et son ordre est `seq` — celui que le
 * hachage fige.
 *
 * Ici on sert des TRANSACTIONS : une ligne par paiement, enrichie de la ville
 * et de la catégorie du partenaire, que le registre ne connaît pas et n'a pas
 * à connaître — un compte de registre ne porte qu'un propriétaire. Faire
 * porter les deux vues à une seule route obligerait l'écran à replier les
 * écritures deux par deux et à joindre lui-même le magasin des partenaires,
 * c'est-à-dire à refaire côté client le travail que cette route fait une fois.
 *
 * ─── L'enveloppe porte un total, et c'est un ajout assumé ───
 *
 * `Paginated<T>` (:319-322) ne porte que `items` et `next_cursor`. Cette route
 * ajoute `totals`. La raison est une exigence de l'écran : le total en tête
 * doit valoir pour le FILTRE COURANT, pas pour la page affichée.
 *
 * Les deux autres voies étaient pires. Calculer le total à partir d'`items`
 * donnerait le total d'une page de vingt lignes en le présentant comme un
 * total national — un chiffre faux, affiché avec assurance. Ouvrir une seconde
 * route laisserait les deux réponses diverger dès qu'un filtre serait transmis
 * à l'une et pas à l'autre. Le total voyage donc avec les lignes qu'il résume,
 * calculé sur l'ensemble filtré AVANT découpage.
 *
 * ─── Les annulations sont comptées à part ───
 *
 * `total_volume` est NET : une opération annulée n'y figure pas. Mais elle
 * reste comptée dans `transaction_count` et dénombrée dans `cancelled_count`,
 * parce qu'elle a bien eu lieu et que l'agent doit la voir. Un volume qui
 * inclurait les annulations surestimerait l'activité ; un décompte qui les
 * cacherait ferait disparaître des opérations du registre.
 *
 * `cancelled_count` est notre ajout, comme `status` sur la route du journal
 * partenaire : le contrat ne porte aucun état sur une transaction.
 *
 * ─── Le filtre par ville EXCLUT les commerces en ligne, et c'est leur règle ───
 *
 * Le contrat traite les partenaires en ligne à part dans le tableau de bord :
 * le bloc `online_partners` existe précisément parce qu'ils « n'appartiennent
 * à aucune ville », et la note d'A1 avertit que sans lui « la somme des
 * by_city ne vaut plus total_volume » (:573).
 *
 * ⚠ C'est l'INVERSE de la règle du catalogue, où un commerce en ligne remonte
 * quel que soit le filtre ville (A1). Les deux sont justes parce que les deux
 * questions diffèrent : le catalogue demande « qui peut me servir ici »,
 * auquel un commerce en ligne répond oui ; celui-ci demande « où l'activité a
 * eu lieu », à quoi il ne répond pas du tout. Les faire coïncider fausserait
 * l'un des deux.
 *
 * Pour les atteindre malgré tout, `city` accepte le mot `en-ligne` — les
 * identifiants de ville sont préfixés `VIL-`, la collision est impossible.
 * C'est le bloc `online_partners` du contrat, rendu atteignable depuis le même
 * menu déroulant plutôt que par un second écran.
 */

import { erreur, euros, identite, succes } from "@/mocks/enveloppe";
import { decoderCurseur, encoderCurseur, lireLimite } from "@/mocks/curseur";
import { trouverAdministrateur, trouverPartenaire, trouverVille } from "@/mocks/magasin";
import {
  compensationDe,
  ecrituresDe,
  registre,
  type OperationRegistre,
} from "@/mocks/registre";

export const dynamic = "force-dynamic";

/** La valeur de `city` qui désigne les commerces sans ville. */
const SANS_VILLE = "en-ligne";

/** Une transaction nationale, avant mise en forme. */
interface Transaction {
  readonly operation: OperationRegistre;
  readonly partenaireId: string;
  readonly montantCentimes: number;
  readonly annulee: boolean;
  readonly motifAnnulation: string | null;
}

/**
 * Les paiements du registre, du plus récent au plus ancien.
 *
 * Une opération de nature `payment` porte deux écritures ; on retient celle
 * qui CRÉDITE le compte du partenaire — c'est elle qui dit qui a encaissé et
 * combien. Prendre les deux compterait chaque paiement deux fois.
 */
function paiements(): Transaction[] {
  const lignes: Transaction[] = [];

  for (const operation of registre.operations) {
    if (operation.kind !== "payment") continue;

    const credit = ecrituresDe(operation.id).find((e) => e.direction === "credit");
    if (credit === undefined) continue;

    const compte = registre.comptes.find((c) => c.id === credit.accountId);
    if (compte === undefined || compte.ownerType !== "partner" || compte.ownerId === null) {
      continue;
    }

    const compensation = compensationDe(operation.id);
    lignes.push({
      operation,
      partenaireId: compte.ownerId,
      montantCentimes: credit.amountCentimes,
      annulee: compensation !== undefined,
      motifAnnulation: compensation?.reason ?? null,
    });
  }

  /* Du plus récent au plus ancien, sur la date du FAIT (`occurred_at`), pas
     sur celle de l'enregistrement : c'est celle que l'agent lit et celle sur
     laquelle portent les bornes du filtre. L'identifiant départage les
     ex æquo, sans quoi la pagination par curseur ne serait pas déterministe. */
  return lignes.sort((a, b) => {
    const ecart = Date.parse(b.operation.occurredAt) - Date.parse(a.operation.occurredAt);
    return ecart !== 0 ? ecart : b.operation.id.localeCompare(a.operation.id);
  });
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

  for (const borne of ["from", "to"]) {
    const valeur = texte(borne);
    if (valeur !== undefined && !Number.isFinite(Date.parse(valeur))) {
      return erreur(422, "VALIDATION_FAILED", `Le paramètre ${borne} doit être une date ISO 8601.`);
    }
  }

  const depuis = texte("from");
  const jusqua = texte("to");
  const partenaire = texte("partner");
  const ville = texte("city");
  const categorie = texte("category");

  /* ── Le filtrage, sur l'ensemble et non sur une page ────────────────────
     C'est ici que se joue la justesse du total : `retenues` est TOUT ce qui
     répond au filtre. Le découpage vient après, et ne le touche pas. */
  const retenues = paiements().filter((ligne) => {
    const quand = Date.parse(ligne.operation.occurredAt);
    if (depuis !== undefined && quand < Date.parse(depuis)) return false;
    if (jusqua !== undefined && quand > Date.parse(jusqua)) return false;
    if (partenaire !== undefined && ligne.partenaireId !== partenaire) return false;

    const fiche = trouverPartenaire(ligne.partenaireId);
    if (fiche === undefined) return false;

    if (categorie !== undefined && fiche.category !== categorie) return false;

    if (ville !== undefined) {
      /* Sans ville : les commerces en ligne, le bloc `online_partners` du
         tableau de bord. Voir l'en-tête — ce n'est PAS la règle A1 du
         catalogue, et c'est délibéré. */
      if (ville === SANS_VILLE) return fiche.cityId === null;
      if (fiche.cityId !== ville) return false;
    }

    return true;
  });

  /* ── Le total, sur l'ensemble filtré ──────────────────────────────────── */
  const totaux = retenues.reduce(
    (acc, ligne) => ({
      transaction_count: acc.transaction_count + 1,
      cancelled_count: acc.cancelled_count + (ligne.annulee ? 1 : 0),
      volume_centimes: acc.volume_centimes + (ligne.annulee ? 0 : ligne.montantCentimes),
    }),
    { transaction_count: 0, cancelled_count: 0, volume_centimes: 0 },
  );

  /* ── Le découpage keyset ───────────────────────────────────────────────
     Le repère est le couple (occurred_at, id), l'ordre exact du tri. Un
     curseur sur la seule date recouvrirait ou sauterait des lignes dès que
     deux paiements portent le même horodatage. */
  let debut = 0;
  const curseurBrut = parametres.get("cursor");
  if (curseurBrut !== null && curseurBrut !== "") {
    const curseur = decoderCurseur(curseurBrut);
    if (curseur === null) {
      return erreur(422, "VALIDATION_FAILED", "Curseur illisible.");
    }
    const repere = Date.parse(curseur.valeurDeTri);
    const position = retenues.findIndex((ligne) => {
      const quand = Date.parse(ligne.operation.occurredAt);
      if (quand !== repere) return quand < repere;
      return ligne.operation.id.localeCompare(curseur.id) < 0;
    });
    debut = position === -1 ? retenues.length : position;
  }

  const page = retenues.slice(debut, debut + limite);
  const dernier = page.at(-1);
  const resteApres = debut + page.length < retenues.length;

  return succes({
    items: page.map((ligne) => {
      const fiche = trouverPartenaire(ligne.partenaireId);
      const villeDuPartenaire =
        fiche === undefined || fiche.cityId === null ? undefined : trouverVille(fiche.cityId);

      return {
        id: ligne.operation.id,
        occurred_at: ligne.operation.occurredAt,
        amount: euros(ligne.montantCentimes),
        /* La fiche du partenaire, jointe ici : un identifiant seul
           n'apprendrait rien à l'agent, et le faire joindre par l'écran
           reviendrait à lui donner accès à tout le référentiel. */
        partner: {
          id: ligne.partenaireId,
          trade_name: fiche?.tradeName ?? null,
          category: fiche?.category ?? null,
          city:
            villeDuPartenaire === undefined
              ? null
              : {
                  id: villeDuPartenaire.id,
                  name: villeDuPartenaire.name,
                  department: villeDuPartenaire.department,
                },
        },
        /* ⚠ NOTRE AJOUT : le contrat ne porte aucun état sur une transaction. */
        status: ligne.annulee ? "cancelled" : "settled",
        compensation_reason: ligne.motifAnnulation,
      };
    }),
    next_cursor:
      resteApres && dernier !== undefined
        ? encoderCurseur({
            valeurDeTri: dernier.operation.occurredAt,
            id: dernier.operation.id,
          })
        : null,
    /* ⚠ NOTRE AJOUT à `Paginated<T>`. Calculé sur `retenues`, jamais sur
       `page` : c'est ce qui fait que le total ne ment pas. */
    totals: {
      transaction_count: totaux.transaction_count,
      cancelled_count: totaux.cancelled_count,
      total_volume: euros(totaux.volume_centimes),
    },
  });
}
