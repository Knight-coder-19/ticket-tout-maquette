import { formaterCentimes } from "@/lib/montant";
import { ChiffreCle } from "./ChiffreCle";
import type { ChiffresNationaux } from "@/types/domaine";

/**
 * Les cinq chiffres du tableau de bord national.
 *
 * ─── Cinq, à la limite haute — et c'est voulu ───
 *
 * « Une rangée de tuiles n'est pas un inventaire » — même règle qu'au tableau
 * de bord du commerçant, qui s'en tient à quatre. Ici, cinq : trois chiffres
 * d'ÉTAT (volume, transactions, salariés actifs) et deux qui appellent un
 * geste (partenaires actifs, partenaires EN ATTENTE — un chiffre qu'un
 * administrateur doit voir bouger vers zéro, pas seulement connaître).
 * Retirer l'un des cinq masquerait une des deux questions qu'un
 * administrateur se pose en ouvrant l'écran.
 *
 * Chaque tuile est un `ChiffreCle` (`./ChiffreCle.tsx`) : ce fichier ne fait
 * que choisir les cinq chiffres et leurs cinq libellés.
 */
export function TuilesNationales({ chiffres }: { chiffres: ChiffresNationaux }) {
  return (
    <section className="tuiles" aria-label="Chiffres nationaux">
      <ChiffreCle
        libelle="Volume encaissé"
        valeur={formaterCentimes(chiffres.volumeTotal)}
        periode="sur la période choisie"
      />
      <ChiffreCle
        libelle={chiffres.nombreTransactions === 1 ? "Transaction" : "Transactions"}
        valeur={String(chiffres.nombreTransactions)}
        periode="sur la période choisie"
      />
      <ChiffreCle
        libelle="Partenaires agréés"
        valeur={String(chiffres.partenairesActifs)}
        periode="à l'instant"
      />
      <ChiffreCle
        libelle={chiffres.partenairesEnAttente === 1 ? "Demande en attente" : "Demandes en attente"}
        valeur={String(chiffres.partenairesEnAttente)}
        periode="à traiter"
      />
      <ChiffreCle
        libelle="Salariés actifs"
        valeur={String(chiffres.salariesActifs)}
        periode="à l'instant"
      />
    </section>
  );
}
