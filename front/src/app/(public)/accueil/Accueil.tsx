import Link from "next/link";
import { CarteVisuelle } from "@/components/marque/CarteVisuelle";
import { Bouton } from "@/components/ui/Bouton";
import styles from "./accueil.module.css";

// Page d'accueil de la maquette. Point d'entrée vers les quatre espaces du
// dispositif. L'espace salarié est fonctionnel (données simulées) ; les
// autres sont des ébauches d'arborescence.
const espaces = [
  {
    href: "/salarie",
    nom: "Espace salarié",
    texte:
      "Solde à la seconde, code de paiement (QR à usage unique, 5 min), réseau de partenaires, historique des opérations, demandes.",
    pret: true,
  },
  {
    href: "/partenaire",
    nom: "Espace partenaire",
    texte:
      "Encaissement d'un code, journal des transactions, catalogue du réseau, compte et sceau officiel.",
    pret: false,
  },
  {
    href: "/administration",
    nom: "Espace administration",
    texte:
      "Tableau de bord national, validation des adhésions, registres des comptes et des écritures, réclamations.",
    pret: false,
  },
  {
    href: "/connexion",
    nom: "Connexion / inscription",
    texte:
      "Écrans d'authentification et de création de compte, sur la charte ministérielle.",
    pret: false,
  },
];

export function Accueil() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Ministère du Job et Bonheur</p>
          <h1 className={styles.titre}>
            Ticket Tout&nbsp;: le pouvoir d&apos;achat des équipes, dans une
            carte.
          </h1>
          <p className={styles.chapo}>
            Le dispositif d&apos;avantages salariés dématérialisé. Un salarié
            paie chez un commerce partenaire en trois secondes, avec un code à
            usage unique.
          </p>
          <div className={styles.actions}>
            <Bouton href="/salarie" variante="primaire">
              Ouvrir l&apos;espace salarié
            </Bouton>
            <Bouton href="/salarie/paiement" variante="secondaire">
              Voir le paiement
            </Bouton>
          </div>
        </div>
        <div className={styles.carteWrap}>
          <CarteVisuelle entete={<span>Carte salarié</span>}>
            <p className={styles.soldeLabel}>Solde disponible</p>
            <p className={styles.soldeValeur}>52,10 € · sim.</p>
            <p className={styles.soldeNote}>
              À dépenser chez vos partenaires référencés.
            </p>
          </CarteVisuelle>
        </div>
      </section>

      <h2 className={styles.sectionTitre}>Les quatre espaces</h2>
      <div className={styles.grille}>
        {espaces.map((e) => (
          <Link key={e.href} href={e.href} className={`${styles.espace} ${e.pret ? styles.espacePret : ""}`}>
            <span
              className={`${styles.etiquette} ${e.pret ? styles.etiquettePret : styles.etiquetteEbauche}`}
            >
              {e.pret ? "fonctionnel" : "ébauche"}
            </span>
            <p className={styles.espaceNom}>{e.nom}</p>
            <p className={styles.espaceTexte}>{e.texte}</p>
          </Link>
        ))}
      </div>

      <h2 className={styles.sectionTitre}>Aller plus loin</h2>
      <div className={styles.liens}>
        <Link href="/partenaires">Le réseau de partenaires</Link>
        <Link href="/mentions-legales">Mentions légales</Link>
        <Link href="/accessibilite">Accessibilité</Link>
        <Link href="/cgu">Conditions d&apos;utilisation</Link>
      </div>

      <p className={styles.note}>
        Démonstrateur : simulation fonctionnelle. Aucune valeur réelle ne
        circule, aucune transaction financière n&apos;est effectuée. Les données
        affichées sont fictives.
      </p>
    </div>
  );
}
