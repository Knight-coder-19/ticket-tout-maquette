import { FilDemande } from "./FilDemande";

export const metadata = { title: "Demande" };

export default function Page() {
  return <FilDemande />;
}

// Maquette statique : l'historique des demandes est vide dans la démo.
export function generateStaticParams() {
  return [{ id: "exemple" }];
}
export const dynamicParams = false;
