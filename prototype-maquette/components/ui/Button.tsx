import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

/* Charte : le bleu institutionnel n'est jamais un fond de bouton. L'action
   principale est portée par l'or (--gold-500, texte ink-900, contraste ~8:1). */
const variants: Record<Variant, string> = {
  primary:
    "bg-gold-500 text-ink-900 shadow-[0_10px_22px_-10px_rgba(227,164,0,0.7)] hover:bg-gold-600 hover:text-white",
  secondary:
    "bg-white text-brand-700 border border-brand-200 hover:bg-brand-50",
  ghost: "bg-transparent text-ink-700 hover:bg-slate-100",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[14.5px] rounded-xl",
  lg: "h-[52px] px-6 text-[15.5px] rounded-2xl",
};

/** Classe partagée bouton - à appliquer aussi sur un <Link> quand l'élément
 *  navigue (un <button> dans un <a> est du HTML invalide et un piège lecteur
 *  d'écran). */
export function buttonStyles(variant: Variant = "primary", size: Size = "md", className = "") {
  return `inline-flex min-h-11 items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${variants[variant]} ${sizes[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props 
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonStyles(variant, size, className)} {...props} />;
}
