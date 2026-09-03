import { CarteVisuelle } from "@/components/marque/CarteVisuelle";
import { Bouton } from "@/components/ui/Bouton";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { ComptesDemonstration } from "@/app/(auth)/connexion/ComptesDemonstration";
import { categoriesDemo } from "@/mocks/fixtures/categories";
import "@/styles/accueil.css";
import "@/styles/connexion.css";

const espaces: { icone: NomIcone; titre: string; corps: string }[] = [
  {
    icone: "solde",
    titre: "Espace salarié",
    corps:
      "Solde à jour à la seconde, historique des transactions, code de paiement à usage unique à présenter en magasin, recherche des partenaires à proximité.",
  },
  {
    icone: "paiement",
    titre: "Espace partenaire",
    corps:
      "Encaissement par scan ou saisie, suivi de l'activité, référencement au réseau national après validation du Ministère.",
  },
  {
    icone: "coche",
    titre: "Espace administration",
    corps:
      "Validation des partenaires sur pièces, gestion des comptes, recharges des employeurs, tableau de bord national.",
  },
];

const etapes = [
  { titre: "L'employeur crédite le compte", corps: "Le rechargement apparaît immédiatement dans l'espace salarié." },
  { titre: "Le salarié génère un code au moment de payer", corps: "Signé côté serveur, à usage unique, valable 5 minutes maximum." },
  { titre: "Le partenaire scanne et valide", corps: "La transaction est enregistrée de façon intègre et irréversible." },
];

export function Accueil() {
  return (
    <>
      <section className="acc__hero">
        <div className="acc__hero-in">
          <div>
            <span className="acc__badge">
              Ministère du Job et Bonheur · Direction du Numérique et de l&apos;Innovation
            </span>
            <h1 className="acc__h1">
              Le pouvoir d&apos;achat de vos équipes, chez les commerces qui comptent
            </h1>
            <p className="acc__lead">
              Ticket Tout crédite vos salariés en quelques secondes et leur ouvre un
              réseau de partenaires locaux référencés par le Ministère, sans papier
              ni friction.
            </p>
            <div className="acc__hero-actions">
              <Bouton href="/connexion" variante="primaire">Entrer dans la démo</Bouton>
              <Bouton href="/inscription" variante="secondaire">Créer un compte</Bouton>
            </div>
          </div>
          <div className="acc__carte-wrap">
            <CarteVisuelle entete={<span>Carte salarié</span>}>
              <p className="acc__solde-l">Solde disponible</p>
              <p className="acc__solde-v">52,10 € · sim.</p>
              <p className="acc__solde-n">À dépenser chez vos partenaires référencés.</p>
            </CarteVisuelle>
          </div>
        </div>
      </section>

      <section className="acc__section" id="dispositif">
        <h2 className="acc__h2">Le dispositif Ticket Tout</h2>
        <p className="acc__p">
          Ticket Tout modernise et généralise le principe des avantages salariés
          dématérialisés. Les employeurs dotent leurs salariés de crédits,
          utilisables auprès d&apos;un réseau de partenaires référencés : commerces
          de proximité, culture, restauration, loisirs.
        </p>
        <p className="hall__note" style={{ marginBottom: "var(--espace-8)" }}>
          Démonstrateur : simulation fonctionnelle. Aucune transaction financière
          réelle n&apos;est effectuée, aucune valeur monétaire réelle ne circule.
        </p>
        <div className="acc__grille-3">
          {espaces.map((e) => (
            <div key={e.titre} className="acc__tuile">
              <span className="acc__tuile-ic"><Icone nom={e.icone} taille={24} /></span>
              <h3 className="acc__tuile-t">{e.titre}</h3>
              <p className="acc__tuile-b">{e.corps}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="acc__section--bord">
        <div className="acc__section" id="fonctionnement">
          <h2 className="acc__h2">Comment ça marche</h2>
          <ol className="acc__etapes">
            {etapes.map((s, i) => (
              <li key={s.titre}>
                <span className="acc__etape-n">{i + 1}</span>
                <span className="acc__etape-t">{s.titre}</span>
                <span className="acc__etape-b">{s.corps}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="acc__section" id="partenaires">
        <h2 className="acc__h2">Des partenaires près de chez vous</h2>
        <p className="acc__p">
          Le réseau est organisé par catégories. Il évolue régulièrement : de
          nouvelles catégories et de nouveaux partenaires s&apos;ajoutent sans
          changement de l&apos;interface.
        </p>
        <ul className="acc__cats">
          {[...categoriesDemo].sort((a, b) => a.ordre - b.ordre).map((cat) => (
            <li key={cat.id} className="acc__cat">
              <span className="acc__cat-ic"><Icone nom="partenaires" taille={20} /></span>
              <p className="acc__cat-t">{cat.libelle}</p>
              <p className="acc__cat-c">Partenaires validés par le Ministère</p>
            </li>
          ))}
        </ul>
        <ul className="acc__feats">
          <li className="acc__feat"><Icone nom="recherche" taille={18} /> Recherche par ville et à proximité</li>
          <li className="acc__feat"><Icone nom="coche" taille={18} /> Partenaires validés par le Ministère</li>
          <li className="acc__feat"><Icone nom="paiement" taille={18} /> Paiement en moins de trois secondes</li>
        </ul>
      </section>

      <section className="acc__section--bord">
        <div className="acc__section">
          <h2 className="acc__h2">Entrer dans la démo</h2>
          <p className="acc__p">
            Pas de mot de passe : choisissez un compte de démonstration pour
            visiter l&apos;espace correspondant.
          </p>
          <ComptesDemonstration />
        </div>
      </section>

      <footer className="acc__foot">
        <div className="acc__foot-in">
          <p style={{ maxWidth: "60ch", lineHeight: 1.5 }}>
            <strong>Ticket Tout</strong> n&apos;est pas un service de paiement au sens
            réglementaire dans le cadre de ce démonstrateur. Il s&apos;agit d&apos;une
            simulation fonctionnelle. Aucune transaction financière réelle n&apos;est
            effectuée.
          </p>
          <p>© Ministère du Job et Bonheur · JEB/DNI/2026-002</p>
        </div>
      </footer>
    </>
  );
}
