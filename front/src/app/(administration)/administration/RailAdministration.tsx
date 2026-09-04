"use client";

import Link from "next/link";
import { Rail, type EntreeRail } from "@/components/layout/Rail";
import { Icone } from "@/components/ui/Icone";

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
 * vit dans `components/layout/Rail`, partagée avec l'espace partenaire et
 * l'espace salarié. Ce fichier ne porte que des données.
 */
const ENTREES: readonly EntreeRail[] = [
  { href: "/administration", libelle: "Tableau de bord", icone: "solde" },
  { href: "/administration/validations", libelle: "Validations", icone: "coche" },
  { href: "/administration/mise-en-avant", libelle: "Sélection du Ministre", icone: "partenaires" },
  { href: "/administration/salaries", libelle: "Salariés", icone: "demandes" },
  { href: "/administration/reclamations", libelle: "Réclamations", icone: "info" },
  { href: "/administration/comptes", libelle: "Comptes partenaires", icone: "partenaires" },
  { href: "/administration/recharges", libelle: "Rechargements", icone: "actualiser" },
  { href: "/administration/registre", libelle: "Registre", icone: "historique" },
  { href: "/administration/transactions", libelle: "Transactions", icone: "paiement" },
  { href: "/administration/api", libelle: "API", icone: "copier" },
];

export function RailAdministration() {
  return (
    <Rail
      titre="Administration"
      nomAccessible="Sections de l'administration"
      racine="/administration"
      entrees={ENTREES}
      identifiantTitre="rail-administration"
      pied={
        <Link href="/connexion" className="rail__lien">
          <Icone nom="deconnexion" taille={18} />
          Se déconnecter
        </Link>
      }
    />
  );
}
