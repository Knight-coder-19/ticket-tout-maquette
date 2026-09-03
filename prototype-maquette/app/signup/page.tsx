import type { Metadata } from "next";
import { BadgeCheck, Clock, Wallet } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Rejoindre le réseau" };

const points = [
  { icon: Wallet, text: "Paiements reçus, suivi de l'activité" },
  { icon: BadgeCheck, text: "Badge « Partenaire du Ministère » sur votre fiche" },
  { icon: Clock, text: "Chaque demande est examinée avant activation" },
];

export default function SignupPage() {
  return (
    <AuthShell
      aside={
        <div>
          <p className="text-balance font-display text-[26px] font-bold leading-snug text-white xl:text-[30px]">
            Rejoignez le réseau référencé par le Ministère
          </p>
          <p className="mt-4 text-[13.5px] leading-relaxed text-brand-100">
            Un réseau de confiance : les partenaires sont validés sur pièces (SIREN, objet social)
            avant d&apos;apparaître au catalogue.
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
      <h1 className="font-display text-[27px] font-bold tracking-tight">Créer un compte</h1>
      <p className="mt-2 text-[14px] text-ink-500">
        Réservé aux commerces partenaires et aux employeurs. Les salariés reçoivent leurs
        identifiants de leur employeur.
      </p>
      <SignupForm />
    </AuthShell>
  );
}
