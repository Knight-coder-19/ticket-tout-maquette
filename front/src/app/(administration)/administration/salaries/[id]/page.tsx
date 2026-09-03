import { FicheSalarie } from "./FicheSalarie";

export const metadata = { title: "Fiche bénéficiaire" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheSalarie id={id} />;
}
