import { FilReclamation } from "./FilReclamation";

export const metadata = { title: "Réclamation" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FilReclamation id={id} />;
}
