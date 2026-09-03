import { Carte } from "@/components/ui/Carte";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import styles from "../salarie.module.css";

export function ActionsRapides() {
  return (
    <Carte titre="Actions rapides">
      <div className={styles.actions}>
        <Bouton href="/salarie/paiement" variante="primaire">
          <Icone nom="paiement" taille={18} />
          Payer chez un partenaire
        </Bouton>
        <Bouton href="/salarie/historique" variante="secondaire">
          <Icone nom="historique" taille={18} />
          Voir l&apos;historique
        </Bouton>
        <Bouton href="/salarie/partenaires" variante="secondaire">
          <Icone nom="partenaires" taille={18} />
          Trouver un partenaire
        </Bouton>
      </div>
    </Carte>
  );
}
