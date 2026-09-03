import type { MiseEnAvant } from "@/types/domaine";

/**
 * La carte d'une mise en avant active : l'aperçu de ce que la vitrine montre.
 *
 * ─── Pourquoi une carte, et pas une ligne de tableau ───
 *
 * C'est un APERÇU, pas un registre à comparer colonne par colonne : c'est
 * exactement ce que `PublicPartner` sert, dans la forme où un visiteur va le
 * lire — une enseigne, un mot, un lien. Le même raisonnement que le
 * catalogue, où une fiche de commerce est une carte et non une ligne.
 *
 * ─── Le mot du ministre paraît TEL QUEL ───
 *
 * Aucune troncature, aucun habillage de guillemets qui suggérerait une
 * citation rapportée : c'est le texte qui part sur la vitrine publique, au
 * mot près. Une carte qui le recadrerait donnerait à l'administrateur un
 * aperçu qui ne correspond pas à ce que le public verra.
 *
 * ─── Ce qu'elle ne montre PAS ───
 *
 * Rien que `PublicPartner` ne serve : ni identifiant fiscal, ni raison
 * sociale, ni contact. La carte est fidèle aux neuf champs de cette surface
 * (huit du contrat, plus `note` — voir `types/api.ts`), pas au dossier complet
 * du partenaire que l'administration voit ailleurs.
 */
export function CarteMiseEnAvant({
  miseEnAvant,
  rang,
  total,
  enCours,
  onMonter,
  onDescendre,
  onRetirer,
}: {
  miseEnAvant: MiseEnAvant;
  /** Position dans la liste affichée, 1-indexée — pour l'annonce et les libellés. */
  rang: number;
  total: number;
  enCours: boolean;
  onMonter: () => void;
  onDescendre: () => void;
  onRetirer: () => void;
}) {
  return (
    <article className="carte-vitrine" aria-label={`${miseEnAvant.enseigne}, position ${rang} sur ${total}`}>
      <div className="carte-vitrine__ordre">
        <button
          type="button"
          className="bouton bouton--discret"
          disabled={enCours || rang === 1}
          onClick={onMonter}
          aria-label={`Monter ${miseEnAvant.enseigne}`}
        >
          ▲
        </button>
        <span className="carte-vitrine__position">{rang}</span>
        <button
          type="button"
          className="bouton bouton--discret"
          disabled={enCours || rang === total}
          onClick={onDescendre}
          aria-label={`Descendre ${miseEnAvant.enseigne}`}
        >
          ▼
        </button>
      </div>

      <div className="carte-vitrine__corps">
        <p className="carte-vitrine__enseigne">{miseEnAvant.enseigne}</p>
        <p className="carte-vitrine__categorie">{miseEnAvant.categorie}</p>

        {miseEnAvant.mot !== null && (
          <blockquote className="carte-vitrine__mot">
            <p>{miseEnAvant.mot}</p>
            <cite>— le Ministre</cite>
          </blockquote>
        )}

        {miseEnAvant.mot === null && (
          <p className="carte-vitrine__sans-mot">Sans mot du Ministre.</p>
        )}
      </div>

      <div className="actions">
        <button
          type="button"
          className="bouton bouton--refus"
          disabled={enCours}
          onClick={onRetirer}
        >
          Retirer de la vitrine
        </button>
      </div>
    </article>
  );
}
