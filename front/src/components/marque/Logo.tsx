import styles from "./marque.module.css";

type Variante = "complet" | "marque";

/**
 * Logotype Ticket Tout.
 *
 * - `complet` : la marque (pictogramme ticket) + le mot « Ticket Tout ».
 * - `marque`  : le pictogramme seul (usage favicon, espaces reduits).
 * - `mono`    : version monochrome, tout en `currentColor` (impression,
 *               fonds contraints). Sinon le ticket est ambre.
 *
 * Le mot est en `currentColor` : blanc sur un fond primaire, primaire sur
 * fond clair. Zone de protection : au moins la hauteur du pictogramme
 * autour du logotype (les conteneurs gardent une marge).
 */
export function Logo({
  variante = "complet",
  mono = false,
  hauteur = 24,
}: {
  variante?: Variante;
  mono?: boolean;
  hauteur?: number;
}) {
  const largeur = Math.round((hauteur * 40) / 26);
  return (
    <span className={styles.logo}>
      <svg
        width={largeur}
        height={hauteur}
        viewBox="0 0 40 26"
        className={styles.pictogramme}
        role={variante === "marque" ? "img" : undefined}
        aria-label={variante === "marque" ? "Ticket Tout" : undefined}
        aria-hidden={variante === "complet" ? true : undefined}
      >
        {mono ? (
          <>
            <rect
              x="1.5"
              y="1.5"
              width="37"
              height="23"
              rx="4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1="13"
              y1="6"
              x2="13"
              y2="20"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="2 2.4"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <rect x="1" y="1" width="38" height="24" rx="4" fill="var(--couleur-accent-ambre)" />
            <line
              x1="13"
              y1="5"
              x2="13"
              y2="21"
              stroke="var(--couleur-primaire)"
              strokeWidth="2"
              strokeDasharray="2 2.4"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      {variante === "complet" ? <span className={styles.mot}>Ticket&nbsp;Tout</span> : null}
    </span>
  );
}
