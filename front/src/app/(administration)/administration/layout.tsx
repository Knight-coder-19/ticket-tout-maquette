import "@/styles/espace.css";
import "@/styles/primitives.css";

import { BandeauSimulation } from "@/components/simulation/BandeauSimulation";
import { RailAdministration } from "./RailAdministration";

/**
 * La coquille de l'espace d'administration.
 *
 * Trois pieces et rien d'autre : la mention de simulation, le rail, le
 * contenu. Aucun ecran n'est code ici — les dix pages restent ce qu'elles
 * sont.
 *
 * La coquille et le rail viennent de `styles/espace.css`, partages avec
 * l'espace partenaire ; les etats et les boutons de `styles/primitives.css`.
 *
 * L'element qui porte `container-type` est cette `div` : c'est par rapport a
 * SA largeur que le rail bascule entre barre horizontale et colonne, et non
 * par rapport a la fenetre. Le layout se comporte donc pareil dans un cadre
 * d'appareil, un panneau lateral ou un plein ecran.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="espace">
      <BandeauSimulation />
      <div className="espace__grille">
        <RailAdministration />
        <main className="espace__contenu">{children}</main>
      </div>
    </div>
  );
}
