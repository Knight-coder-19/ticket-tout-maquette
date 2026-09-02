import "@/styles/globals.css";

export const metadata = {
  title: {
    default: "CartePro (simulation) — Ministère du Job et Bonheur",
    template: "%s — CartePro (simulation)",
  },
  description:
    "Démonstrateur du dispositif CartePro. Simulation fonctionnelle : aucune valeur réelle ne circule.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
