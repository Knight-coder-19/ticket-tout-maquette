import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

/**
 * Gabarit des pages d'authentification : panneau de marque bleu à gauche
 * (lg+), colonne de formulaire à droite. Pas de header de site ici — le
 * bloc-marque du panneau tient ce rôle (et un logo de repli sur mobile).
 */
export function AuthShell({
  aside,
  children,
}: {
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      <a href="#formulaire" className="skip-link">
        Aller au formulaire
      </a>

      {/* Panneau de marque — lg+ */}
      <aside className="relative hidden w-[42%] max-w-[560px] shrink-0 overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 lg:flex">
        <svg
          aria-hidden
          viewBox="0 0 400 800"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full text-white/[0.06]"
          fill="none"
        >
          <rect x="230" y="-60" width="260" height="260" rx="52" transform="rotate(18 360 70)" fill="currentColor" />
          <circle cx="60" cy="640" r="150" stroke="currentColor" strokeWidth="26" />
          <circle cx="60" cy="640" r="230" stroke="currentColor" strokeWidth="18" />
        </svg>

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link
            href="/"
            aria-label="CartePro, accueil"
            className="w-fit rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Logo onDark size="sm" />
          </Link>

          <div className="max-w-[380px]">{aside}</div>

          <p className="text-[12px] leading-relaxed text-white/55">
            Démonstrateur CartePro : simulation fonctionnelle, aucune donnée ni transaction réelle.
          </p>
        </div>
      </aside>

      {/* Colonne formulaire */}
      <main
        id="formulaire"
        className="flex flex-1 flex-col items-center overflow-y-auto px-5 py-8 sm:px-8"
      >
        <div className="my-auto w-full max-w-[440px] py-6">
          <Link href="/" className="mb-6 inline-flex lg:hidden" aria-label="CartePro, accueil">
            <Logo size="sm" />
          </Link>

          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-brand-700"
          >
            <ArrowLeft size={15} aria-hidden />
            Retour au site
          </Link>

          {children}
        </div>
      </main>
    </div>
  );
}
