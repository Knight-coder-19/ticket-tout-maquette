import type { Metadata } from "next";
import { Spectral } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Titres - Marianne, police officielle de l'État (charte graphique
// ministérielle, mail Sellami). Fichiers en local pour l'exécution hors-ligne.
const marianne = localFont({
  variable: "--font-marianne",
  display: "swap",
  src: [
    { path: "./fonts/Marianne-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Marianne-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Marianne-Bold.woff2", weight: "700", style: "normal" },
  ],
});

// Corps de texte - Spectral. next/font self-héberge le fichier au build,
// donc aucune requête réseau à l'exécution.
const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "CartePro",
    template: "%s · CartePro",
  },
  description:
    "CartePro - le dispositif d'avantages salariés dématérialisés du Ministère du Job et Bonheur. Démonstrateur : simulation fonctionnelle, aucune transaction réelle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${marianne.variable} ${spectral.variable} h-full`}
    >
      <body className="min-h-full bg-surface font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
