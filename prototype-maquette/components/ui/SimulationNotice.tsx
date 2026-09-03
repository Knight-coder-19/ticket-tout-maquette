import type { ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * Mention de simulation : visible et non dissimulée, à poser partout où une
 * valeur monétaire apparaît (mail Pontaillac, 01/09 : solde, historique, QR,
 * validation partenaire, tableaux de bord, messages d'erreur chiffrés, exports).
 * Composant partagé pour rester cohérent d'un écran à l'autre.
 */
export function SimulationNotice({
  children,
  variant = "banner",
}: {
  children: ReactNode;
  /** `banner` = bloc pleine largeur ; `inline` = puce compacte à côté d'un montant. */
  variant?: "banner" | "inline";
}) {
  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-gold-700">
        <Info size={13} aria-hidden />
        Simulation
        <span className="sr-only"> : {children}</span>
      </span>
    );
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-gold-500/40 bg-gold-100 px-4 py-3 text-[13.5px] leading-relaxed text-gold-700"
    >
      <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
      <p>
        <span className="font-bold uppercase tracking-wide">Simulation : </span>
        {children}
      </p>
    </div>
  );
}
