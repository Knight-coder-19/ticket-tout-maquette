import Link from "next/link";

import { formaterCentimes } from "@/lib/montant";
import type { FicheBeneficiaire } from "@/types/domaine";

/**
 * Le résumé du salarié, dans la marge du fil.
 *
 * Ce qu'il faut pour INSTRUIRE le dossier sans changer d'écran : le nom, le
 * statut du compte, le solde disponible, l'employeur et le matricule. Pas la
 * fiche entière — celle-ci répète `lireBeneficiaire` (déjà servie par
 * l'écran des bénéficiaires) et un lien y renvoie pour qui veut le détail
 * complet, ou régulariser un solde depuis là-bas.
 *
 * Composant de présentation : il reçoit une fiche déjà chargée par
 * `FilReclamation`, il ne charge rien lui-même.
 */
export function DossierBeneficiaire({ beneficiaire }: { beneficiaire: FicheBeneficiaire }) {
  return (
    <aside className="dossier-beneficiaire" aria-labelledby="dossier-titre">
      <h2 className="fil-reclamation__soustitre" id="dossier-titre">
        {beneficiaire.nomAffiche}
      </h2>

      <dl className="dossier-beneficiaire__faits">
        <dt>Employeur</dt>
        <dd>{beneficiaire.employeur ?? "Introuvable"}</dd>

        <dt>Matricule</dt>
        <dd>{beneficiaire.matricule}</dd>

        <dt>Statut du compte</dt>
        <dd>{beneficiaire.statut === "actif" ? "Actif" : beneficiaire.statut === "suspendu" ? "Suspendu" : "Fermé"}</dd>

        <dt>Solde disponible</dt>
        <dd className="dossier-beneficiaire__solde">
          {formaterCentimes(beneficiaire.soldes.disponible)}
        </dd>

        {beneficiaire.soldes.reserve > 0 && (
          <>
            <dt>Dont réservé</dt>
            <dd>{formaterCentimes(beneficiaire.soldes.reserve)}</dd>
          </>
        )}
      </dl>

      <p>
        <Link href={`/administration/salaries/${beneficiaire.id}`}>
          Voir la fiche complète
        </Link>
      </p>
    </aside>
  );
}
