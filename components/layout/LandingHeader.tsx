"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { buttonStyles } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, X } from "lucide-react";

// Ancres vers les sections de la page d'info. Les espaces (employé / partenaire
// / admin) et /login /signup sont livrés par d'autres branches ; on garde les
// liens, ils résoudront au merge.
const links = [
  { label: "Le dispositif", href: "#dispositif" },
  { label: "Fonctionnement", href: "#fonctionnement" },
  { label: "Partenaires", href: "#partenaires" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-line bg-white">
      {/* Logo en haut à gauche, marge = zone de protection (charte). */}
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 md:px-7">
        <Link href="/" aria-label="CartePro - accueil" className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          <Logo />
        </Link>

        <nav aria-label="Sections de la page" className="hidden items-center gap-9 lg:flex">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="text-[14.5px] font-semibold text-ink-700 hover:text-brand-700">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className={buttonStyles("secondary", "md")}>
            Se connecter
          </Link>
          <Link href="/signup" className={buttonStyles("primary", "md")}>
            S&apos;inscrire
          </Link>
        </div>

        <IconButton
          label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          className="md:hidden"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </IconButton>
      </div>

      {open ? (
        <div className="flex flex-col gap-1 border-t border-line px-4 py-4 md:hidden">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-lg px-2 py-2.5 text-[15px] font-semibold text-ink-700 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2.5">
            <Link href="/login" className={buttonStyles("secondary", "md", "w-full")} onClick={() => setOpen(false)}>
              Se connecter
            </Link>
            <Link href="/signup" className={buttonStyles("primary", "md", "w-full")} onClick={() => setOpen(false)}>
              S&apos;inscrire
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
