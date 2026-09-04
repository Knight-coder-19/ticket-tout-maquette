import { FilReclamation } from "./FilReclamation";

export const metadata = { title: "Réclamation" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FilReclamation id={id} />;
}

// Maquette statique : la file de réclamations est vide dans la démo.
export function generateStaticParams() {
  return [{ id: "exemple" }];
}
export const dynamicParams = false;
