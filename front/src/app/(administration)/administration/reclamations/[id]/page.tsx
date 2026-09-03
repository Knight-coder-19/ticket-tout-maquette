import { FilReclamation } from "./FilReclamation";

export const metadata = { title: "Réclamation" };

export default function Page() {
  return <FilReclamation />;
}

// Maquette statique : la vue detaillee est une ebauche, un seul parametre suffit.
export function generateStaticParams() {
  return [{ id: "exemple" }];
}
export const dynamicParams = false;
