import { FilDemande } from "./FilDemande";

export const metadata = { title: "Demande" };

export default function Page() {
  return <FilDemande />;
}

// Maquette statique : la vue detaillee est une ebauche, un seul parametre suffit.
export function generateStaticParams() {
  return [{ id: "exemple" }];
}
export const dynamicParams = false;
