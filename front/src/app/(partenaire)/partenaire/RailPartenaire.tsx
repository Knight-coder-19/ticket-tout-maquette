"use client";

import { Rail, type EntreeRail } from "@/components/layout/Rail";

/**
 * Les cinq sections de l'espace partenaire.
 *
 * L'ordre suit la journée d'un commerçant : la vue d'ensemble, puis le geste
 * qu'il fait vingt fois par jour — encaisser — puis ce qu'il consulte après
 * coup. « Mon compte » ferme la liste : on y va rarement, et rarement dans
 * l'urgence.
 *
 * Encaisser est en deuxième position et non en première : le tableau de bord
 * est la racine de l'espace, c'est là qu'on arrive. Mais il porte le raccourci
 * vers l'encaissement, qui reste à un geste.
 *
 * La mécanique du rail vit dans `components/layout/Rail`, partagée avec
 * l'administration. Ce fichier ne porte que des données.
 */
const ENTREES: readonly EntreeRail[] = [
  { href: "/partenaire", libelle: "Tableau de bord" },
  { href: "/partenaire/encaissement", libelle: "Encaisser" },
  { href: "/partenaire/transactions", libelle: "Transactions" },
  { href: "/partenaire/catalogue", libelle: "Catalogue" },
  { href: "/partenaire/compte", libelle: "Mon compte" },
];

export function RailPartenaire() {
  return (
    <Rail
      titre="Espace partenaire"
      nomAccessible="Sections de l'espace partenaire"
      racine="/partenaire"
      entrees={ENTREES}
      identifiantTitre="rail-partenaire"
    />
  );
}
