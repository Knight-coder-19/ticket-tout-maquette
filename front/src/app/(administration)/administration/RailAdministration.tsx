"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Les dix sections de l'espace d'administration.
 *
 * L'ordre est celui de la maquette et il porte du sens : on commence par la
 * vue d'ensemble, on poursuit par ce qui attend une decision humaine
 * (validations, selection, salaries, reclamations), puis par la gestion
 * courante, et on termine par ce qui se consulte sans agir (registre,
 * transactions, API). Ne pas le reordonner sans raison.
 *
 * Les libelles sont ceux de l'interface, pas ceux du code : « Selection du
 * Ministre » pour la mise en avant, « Comptes partenaires » pour les comptes.
 */
const ENTREES = [
  { href: "/administration", libelle: "Tableau de bord" },
  { href: "/administration/validations", libelle: "Validations" },
  { href: "/administration/mise-en-avant", libelle: "Sélection du Ministre" },
  { href: "/administration/salaries", libelle: "Salariés" },
  { href: "/administration/reclamations", libelle: "Réclamations" },
  { href: "/administration/comptes", libelle: "Comptes partenaires" },
  { href: "/administration/recharges", libelle: "Rechargements" },
  { href: "/administration/registre", libelle: "Registre" },
  { href: "/administration/transactions", libelle: "Transactions" },
  { href: "/administration/api", libelle: "API" },
] as const;

/**
 * Une entree est courante si elle mene a la page affichee, ou a l'une de ses
 * sous-pages.
 *
 * Le prefixe est indispensable : `/administration/salaries/SAL-001` doit
 * marquer « Salaries », sinon le caissier de l'administration perd sa position
 * des qu'il ouvre une fiche. Mais il se compare sur une frontiere de segment,
 * `${href}/`, sans quoi `/administration/recharges` marquerait aussi une
 * hypothetique `/administration/recharges-archivees`.
 *
 * Le tableau de bord est le seul cas exact : sa racine est le prefixe de
 * toutes les autres, et un prefixe l'allumerait sur les dix pages.
 */
function estCourante(href: string, chemin: string): boolean {
  if (href === "/administration") return chemin === "/administration";
  return chemin === href || chemin.startsWith(`${href}/`);
}

export function RailAdministration() {
  /* `usePathname` peut rendre `null` hors contexte de routage (rendu de test,
     erreur de montage). Le rail s'affiche alors sans entree courante plutot
     que de casser. */
  const chemin = usePathname() ?? "";

  return (
    <nav className="rail" aria-label="Sections de l'administration">
      <h2 className="rail__titre" id="rail-titre">
        Administration
      </h2>
      <ul className="rail__liste" aria-labelledby="rail-titre">
        {ENTREES.map(({ href, libelle }) => {
          const courante = estCourante(href, chemin);
          return (
            <li key={href}>
              {/*
               * `aria-current="page"` et non une simple couleur : un
               * utilisateur de lecteur d'ecran, ou qui ne percoit pas les
               * contrastes de teinte, doit savoir ou il est. La regle CSS de
               * l'etat actif porte d'ailleurs sur cet attribut, ce qui
               * interdit aux deux de diverger.
               */}
              <Link
                className="rail__lien"
                href={href}
                aria-current={courante ? "page" : undefined}
              >
                {libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
