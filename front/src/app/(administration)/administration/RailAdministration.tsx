"use client";

import { Rail, type EntreeRail } from "@/components/layout/Rail";

/**
 * Les dix sections de l'espace d'administration.
 *
 * L'ordre est celui de la maquette et il porte du sens : on commence par la vue
 * d'ensemble, on poursuit par ce qui attend une décision humaine (validations,
 * sélection, salariés, réclamations), puis par la gestion courante, et on
 * termine par ce qui se consulte sans agir (registre, transactions, API). Ne pas
 * le réordonner sans raison.
 *
 * Les libellés sont ceux de l'interface, pas ceux du code : « Sélection du
 * Ministre » pour la mise en avant, « Comptes partenaires » pour les comptes.
 *
 * La mécanique du rail — entrée courante, `aria-current`, container queries —
 * vit dans `components/layout/Rail`, partagée avec l'espace partenaire. Ce
 * fichier ne porte que des données.
 */
const ENTREES: readonly EntreeRail[] = [
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
];

export function RailAdministration() {
  return (
    <Rail
      titre="Administration"
      nomAccessible="Sections de l'administration"
      racine="/administration"
      entrees={ENTREES}
      identifiantTitre="rail-administration"
    />
  );
}
