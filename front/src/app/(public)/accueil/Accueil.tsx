import { ComptesDemonstration } from "@/app/(auth)/connexion/ComptesDemonstration";
import "@/styles/connexion.css";

// Accueil provisoire : point d'entrée unique vers les trois espaces du
// démonstrateur. La page vitrine (bannière, « comment ça marche »…) reste à
// construire dans les composants voisins.
export function Accueil() {
  return (
    <div className="hall">
      <p className="hall__kicker">Ministère du Job et Bonheur</p>
      <h1 className="hall__titre">
        Ticket Tout : le pouvoir d&apos;achat des équipes, dans une carte
      </h1>
      <p className="hall__chapo">
        Démonstrateur du dispositif d&apos;avantages salariés. Les trois espaces
        sont réunis ici, avec des données simulées. Choisissez un compte pour
        entrer.
      </p>

      <ComptesDemonstration />

      <p className="hall__note">
        Simulation fonctionnelle : aucune valeur réelle ne circule, aucune
        transaction financière n&apos;est effectuée.
      </p>
    </div>
  );
}
