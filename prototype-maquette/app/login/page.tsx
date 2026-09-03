import type { Metadata } from "next";
import { MapPin, ShieldCheck, Zap } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Se connecter" };

const points = [
  { icon: Zap, text: "Solde à jour à la seconde" },
  { icon: MapPin, text: "Partenaires référencés près de chez vous" },
  { icon: ShieldCheck, text: "Transactions intègres et irréversibles" },
];

export default function LoginPage() {
  return (
    <AuthShell
      aside={
        <div>
          <p className="text-balance font-display text-[26px] font-bold leading-snug text-white xl:text-[30px]">
            Votre espace CartePro, en un geste
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-[14px] text-brand-100">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <p.icon size={17} className="text-white" aria-hidden />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <h1 className="font-display text-[27px] font-bold tracking-tight">Bon retour</h1>
      <p className="mt-2 text-[14px] text-ink-500">Choisissez votre profil pour vous connecter.</p>
      <LoginForm />
    </AuthShell>
  );
}
