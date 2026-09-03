import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";
import styles from "./ui.module.css";

type Variante = "primaire" | "secondaire" | "discret";

type Proprietes = {
  variante?: Variante;
  pleine?: boolean;
  children: ReactNode;
  className?: string;
  /** Rend un <Link> au lieu d'un <button>. */
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  "aria-label"?: string;
};

/**
 * Bouton d'action, ou lien style en bouton quand `href` est fourni
 * (un <button> dans un <a> est du HTML invalide).
 */
export function Bouton({
  variante = "primaire",
  pleine = false,
  href,
  className,
  children,
  onClick,
  disabled,
  type = "button",
  ...reste
}: Proprietes) {
  const cls = [
    styles.bouton,
    styles[variante],
    pleine ? styles.pleine : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (href !== undefined) {
    return (
      <Link href={href} className={cls} {...reste}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} {...reste}>
      {children}
    </button>
  );
}
