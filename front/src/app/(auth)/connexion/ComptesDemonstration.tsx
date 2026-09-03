import Link from "next/link";
import "@/styles/connexion.css";

// Pas de backend : la « connexion » se résume à choisir l'espace à visiter.
// Chaque carte ouvre un espace avec un jeu de données simulées.
const comptes = [
  {
    href: "/salarie",
    role: "Salarié",
    nom: "Awa Traoré",
    detail:
      "Solde, code de paiement à usage unique, réseau de partenaires, historique, demandes.",
  },
  {
    href: "/partenaire",
    role: "Partenaire",
    nom: "Boulangerie du Marché",
    detail:
      "Encaissement d'un code, journal des transactions, tableau de bord, catalogue du réseau.",
  },
  {
    href: "/administration",
    role: "Administration",
    nom: "Ministère du Job et Bonheur",
    detail:
      "Tableau de bord national, validation des adhésions, registres, réclamations.",
  },
];

export function ComptesDemonstration() {
  return (
    <div className="hall__grille">
      {comptes.map((c) => (
        <Link key={c.href} href={c.href} className="compte">
          <p className="compte__role">{c.role}</p>
          <p className="compte__nom">{c.nom}</p>
          <p className="compte__detail">{c.detail}</p>
          <p className="compte__entrer">Entrer dans l&apos;espace →</p>
        </Link>
      ))}
    </div>
  );
}
