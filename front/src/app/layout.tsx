import type { Metadata } from "next";
import "@/styles/globals.css";

/**
 * Le titre porte le nom affiche, jamais le nom de code interne.
 * Un nom de code dans un titre d'onglet est ce qui se retient d'un
 * passage televise (B. Sellami).
 */
export const metadata: Metadata = {
  title: "CartePro",
  description:
    "Dispositif d'avantages salaries du Ministere du Job et Bonheur. Demonstrateur, simulation fonctionnelle.",
};

export default function RacineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
