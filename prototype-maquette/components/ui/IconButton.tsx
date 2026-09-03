import type { ButtonHTMLAttributes } from "react";

/**
 * Icon-only button. Always requires an accessible label - there is no way
 * to render one without it, so screen readers never hit a silent control.
 */
export function IconButton({
  label,
  tone = "neutral",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "neutral" | "gold" | "garnet" | "brand";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white border border-line text-ink-700 hover:bg-slate-100",
    gold: "bg-gold-100 text-gold-700 hover:brightness-95",
    garnet: "bg-garnet-100 text-garnet-700 hover:brightness-95",
    brand: "bg-brand-600 text-white hover:bg-brand-700",
  };
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${tones[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
