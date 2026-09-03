import { FicheSalarie } from "./FicheSalarie";

export const metadata = { title: "Fiche salarié" };

export default function Page() {
  return <FicheSalarie />;
}

// Maquette statique : la vue detaillee est une ebauche, un seul parametre suffit.
export function generateStaticParams() {
  return [{ id: "exemple" }];
}
export const dynamicParams = false;
