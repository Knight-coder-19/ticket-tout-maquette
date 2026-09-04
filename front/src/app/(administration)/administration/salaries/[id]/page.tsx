import { FicheSalarie } from "./FicheSalarie";

export const metadata = { title: "Fiche bénéficiaire" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheSalarie id={id} />;
}

// Maquette statique : une page par bénéficiaire du jeu de démonstration.
export function generateStaticParams() {
  return ["SAL-001", "SAL-002", "SAL-003", "SAL-004", "SAL-005"].map((id) => ({ id }));
}
export const dynamicParams = false;
