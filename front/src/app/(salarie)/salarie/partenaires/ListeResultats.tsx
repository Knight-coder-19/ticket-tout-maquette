import type { Categorie, Partenaire } from "@/types/domaine";
import { Pastille } from "@/components/ui/Pastille";
import { EtatVide } from "@/components/ui/EtatVide";
import styles from "../salarie.module.css";

export function ListeResultats({
  partenaires,
  categories,
}: {
  partenaires: Partenaire[];
  categories: Categorie[];
}) {
  if (partenaires.length === 0) {
    return (
      <EtatVide icone="partenaires" titre="Aucun partenaire ne correspond">
        Essayez une autre catégorie ou un autre mot-clé.
      </EtatVide>
    );
  }

  const libelleCategorie = (id: string) =>
    categories.find((c) => c.id === id)?.libelle ?? "Catégorie";

  return (
    <div className={styles.grillePartenaires}>
      {partenaires.map((p) => (
        <article key={p.id} className={styles.partenaire}>
          <p className={styles.partenaireNom}>{p.nom}</p>
          <p className={styles.partenaireMeta}>
            {libelleCategorie(p.categorieId)}
            {p.ville ? ` · ${p.ville}` : ""}
          </p>
          <div className={styles.partenaireTags}>
            {p.estOfficiel ? <Pastille ton="succes">Partenaire officiel</Pastille> : null}
            {p.estMisEnAvant ? <Pastille ton="attente">Coup de cœur</Pastille> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
