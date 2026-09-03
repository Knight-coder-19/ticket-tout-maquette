import { CreditCard } from "lucide-react";

/**
 * Bloc-marque CartePro. Charte : placé en haut à gauche, jamais sur une photo,
 * zone de protection = au moins l'espace `p-1` autour (les conteneurs qui
 * l'utilisent gardent une marge). Marianne plafonne à 700 → `font-bold`.
 */
export function Logo({ size = "md", onDark = false }: { size?: "sm" | "md"; onDark?: boolean }) {
  const text = size === "sm" ? "text-[17px]" : "text-lg";
  const icon = size === "sm" ? 22 : 24;
  return (
    <span className="inline-flex items-center gap-2 p-1">
      <CreditCard
        size={icon}
        aria-hidden
        className={onDark ? "text-white" : "text-brand-700"}
      />
      <span className={`font-display font-bold ${text} ${onDark ? "text-white" : "text-brand-700"}`}>
        Carte
        <span className={onDark ? "text-gold-500" : "text-gold-700"}>Pro</span>
      </span>
    </span>
  );
}
