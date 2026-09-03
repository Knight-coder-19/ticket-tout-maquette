import Link from "next/link";

// Pied de page de la maquette publique.
export function PiedDePage() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--couleur-bordure)",
        padding: "var(--espace-8) var(--espace-6)",
        marginTop: "var(--espace-12)",
        color: "var(--couleur-texte-secondaire)",
        fontSize: "var(--taille-sm)",
        textAlign: "center",
      }}
    >
      <p style={{ margin: "0 0 var(--espace-2)" }}>
        <strong>Ticket Tout</strong> — un dispositif du Ministère du Job et
        Bonheur. Démonstrateur, aucune valeur réelle.
      </p>
      <p style={{ margin: 0, display: "flex", gap: "var(--espace-4)", justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/">Accueil</Link>
        <Link href="/salarie">Espace salarié</Link>
        <Link href="/mentions-legales">Mentions légales</Link>
        <Link href="/accessibilite">Accessibilité</Link>
      </p>
    </footer>
  );
}
