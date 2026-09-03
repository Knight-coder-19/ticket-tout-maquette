import Link from "next/link";
import { ComptesDemonstration } from "./ComptesDemonstration";
import "@/styles/connexion.css";

export function Connexion() {
  return (
    <div className="hall">
      <p className="hall__kicker">Ticket Tout — démonstrateur</p>
      <h1 className="hall__titre">Choisissez un espace</h1>
      <p className="hall__chapo">
        Cette plateforme regroupe les trois espaces du dispositif. Aucun mot de
        passe : sélectionnez un compte de démonstration pour entrer. Les données
        sont simulées, aucune valeur réelle ne circule.
      </p>

      <ComptesDemonstration />

      <p className="hall__note">
        Pas encore de compte ? La création de compte (
        <Link href="/inscription">salarié ou partenaire</Link>) est en cours de
        construction. En attendant, les comptes ci-dessus donnent accès à tout.
      </p>
    </div>
  );
}
