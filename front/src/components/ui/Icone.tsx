import type { SVGProps } from "react";

/**
 * Jeu d'icones interne, trait de 1.6, 24x24, currentColor.
 * Aucune librairie d'icones tierce (contrainte de souverainete).
 */
export type NomIcone =
  | "solde"
  | "historique"
  | "paiement"
  | "partenaires"
  | "demandes"
  | "fleche"
  | "copier"
  | "actualiser"
  | "coche"
  | "recherche"
  | "filtre"
  | "info"
  | "deconnexion";

const chemins: Record<NomIcone, string> = {
  solde: "M3 7h18v10H3zM3 11h18M17 14h.01",
  historique: "M12 8v4l3 2M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  paiement: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v6M17 20h3",
  partenaires: "M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  demandes: "M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-6A8.4 8.4 0 1 1 21 11.5z",
  fleche: "M5 12h14M13 6l6 6-6 6",
  copier: "M9 9h11v11H9zM5 15H4V4h11v1",
  actualiser: "M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5",
  coche: "M20 6 9 17l-5-5",
  recherche: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  filtre: "M4 5h16M7 12h10M10 19h4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  deconnexion: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

export function Icone({
  nom,
  taille = 20,
  ...props
}: { nom: NomIcone; taille?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d={chemins[nom]} />
    </svg>
  );
}
