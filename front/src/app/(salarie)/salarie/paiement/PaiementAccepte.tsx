import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import styles from "../salarie.module.css";

export function PaiementAccepte({ onNouveau }: { onNouveau: () => void }) {
  return (
    <div className={styles.accepte} role="status">
      <Icone nom="coche" taille={40} className={styles.accepteIcone} />
      <h2>Paiement accepté</h2>
      <p>
        L&apos;opération a été enregistrée. Elle est définitive : une transaction
        validée ne peut plus être modifiée.
      </p>
      <p className={styles.demo}>
        Simulation : aucun montant réel n&apos;a été débité.
      </p>
      <div className={styles.actions}>
        <Bouton href="/salarie" variante="primaire">
          Retour au budget
        </Bouton>
        <Bouton onClick={onNouveau} variante="secondaire">
          Nouveau paiement
        </Bouton>
      </div>
    </div>
  );
}
