import Link from "next/link";

/**
 * Les reversements — et pourquoi cet écran n'en montre aucun.
 *
 * ═══ DEUX OPTIONS, UNE TRANCHÉE ═══
 *
 * Il fallait choisir entre servir un état « pas encore disponible » et mocker
 * une liste marquée comme telle. C'est la première, et le motif n'est pas la
 * paresse : une liste inventée ici contredirait une décision écrite du back.
 *
 * 1. LE DISPOSITIF A DÉCIDÉ QU'UN PARTENAIRE N'A PAS DE SOLDE.
 *    `total_received` est un cumul encaissé, et la section 3 le dit deux fois
 *    plutôt qu'une : « côté partenaire : `total_received`, jamais "solde" »
 *    (:208), et « pas un solde : ce n'est pas dépensable (décision 9) »
 *    (:658). Un reversement suppose exactement le contraire — une somme due,
 *    qui décroît quand on la verse. Mocker une liste, ce serait exposer au
 *    jury un mécanisme que le back a explicitement écarté.
 *
 * 2. RIEN NE PERMET DE L'ÉCRIRE SANS TOUT INVENTER.
 *    Aucune occurrence de reversement, versement ou virement dans les docs ni
 *    dans les crates. Aucune coordonnée bancaire nulle part dans le schéma :
 *    ni IBAN, ni RIB, ni compte de destination. Aucune des vingt-huit routes
 *    de la section 4. La cadence, le seuil, les frais, qui déclenche : tout
 *    serait de mon fait, et chaque nombre affiché deviendrait une
 *    spécification que quelqu'un croirait lire.
 *
 * 3. LE REGISTRE REFUSERAIT L'ÉCRITURE.
 *    Le journal est à partie double et ses invariants sont vérifiés à l'écran
 *    du registre. Un reversement demande un compte de contrepartie qui
 *    n'existe pas. Il faudrait soit inventer ce compte, soit écrire une
 *    opération déséquilibrée — c'est-à-dire casser l'invariant que l'écran
 *    voisin sert justement à démontrer.
 *
 * Un état honnête ne coûte rien de faux. Une liste inventée coûterait la
 * crédibilité des écrans qui, eux, disent vrai.
 *
 * ─── Il reste utile ───
 *
 * Il ne se contente pas de dire non : il dit ce qui existe aujourd'hui — le
 * cumul encaissé, consultable — et où le lire. Une page qui annonce une
 * absence sans indiquer la suite renvoie le commerçant chercher tout seul.
 */
export function Reversements() {
  return (
    <section aria-labelledby="reversements-titre">
      <h2 className="fiche__titre" id="reversements-titre">
        Reversements
      </h2>

      <div className="etat etat--vide">
        <p>
          <strong>
            Les reversements ne sont pas encore ouverts dans le dispositif.
          </strong>
        </p>
        <p>
          Le mécanisme n&apos;est pas arrêté : ni la cadence, ni le seuil, ni le
          compte de destination. Aucune de ces informations n&apos;existe
          aujourd&apos;hui, et cet écran préfère le dire plutôt que d&apos;en
          afficher d&apos;inventées.
        </p>
        <p>
          Ce qui est disponible dès à présent, c&apos;est le détail de ce que
          vous avez encaissé : chaque règlement, sa date et son montant.{" "}
          <Link href="/partenaire/transactions">
            Consulter le journal des encaissements
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
