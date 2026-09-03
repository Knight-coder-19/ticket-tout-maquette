import "@/styles/globals.css";

export const metadata = {
  title: {
    default: "Ticket Tout (simulation) · Ministère du Job et Bonheur",
    template: "%s · Ticket Tout (simulation)",
  },
  description:
    "Démonstrateur du dispositif Ticket Tout. Simulation fonctionnelle : aucune valeur réelle ne circule.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
