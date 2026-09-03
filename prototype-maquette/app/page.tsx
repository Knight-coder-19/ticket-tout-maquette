import Link from "next/link";
import { Splash } from "@/components/layout/Splash";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { buttonStyles } from "@/components/ui/Button";
import { CardVisual } from "@/components/ui/CardVisual";
import { SimulationNotice } from "@/components/ui/SimulationNotice";
import { partnerCategories } from "@/data/categories";
import {
  type LucideIcon,
  Wallet,
  Store,
  Landmark,
  UtensilsCrossed,
  BookOpen,
  Ticket,
  ShoppingBag,
  MapPin,
  ShieldCheck,
  Zap,
} from "lucide-react";

const spaces = [
  {
    icon: Wallet,
    title: "Espace employé",
    body:
      "Solde à jour à la seconde, historique des transactions, QR code de paiement à présenter en magasin et recherche des partenaires à proximité.",
  },
  {
    icon: Store,
    title: "Espace partenaire",
    body:
      "Encaissement par scan ou saisie, suivi de l'activité, et référencement au réseau national après validation du Ministère.",
  },
  {
    icon: Landmark,
    title: "Espace Ministère",
    body:
      "Validation des partenaires sur pièces, gestion des comptes, recharges des employeurs et tableau de bord national.",
  },
];

const steps = [
  {
    title: "L'employeur crédite le compte",
    body: "Le rechargement apparaît immédiatement dans l'espace employé.",
  },
  {
    title: "L'employé génère un QR au moment de payer",
    body: "Signé côté serveur, à usage unique, valable 5 minutes maximum.",
  },
  {
    title: "Le partenaire scanne et valide",
    body: "La transaction est enregistrée de façon intègre et irréversible.",
  },
];

const categoryIcon: Record<string, LucideIcon> = {
  restauration: UtensilsCrossed,
  culture: BookOpen,
  loisirs: Ticket,
  "vie-quotidienne": ShoppingBag,
};

export default function InfoPage() {
  return (
    <>
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <Splash />
      <LandingHeader />

      <main id="contenu">
        {/* Hero : aplat bleu institutionnel, texte en blanc. Pas de photo sous
            le bloc-marque (charte). */}
        <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-12 px-5 py-14 md:px-8 lg:flex-row lg:gap-16 lg:py-24">
            <div className="max-w-xl text-center lg:text-left">
              <span className="inline-block rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-white">
                Ministère du Job et Bonheur · Direction du Numérique et de l&apos;Innovation
              </span>
              <h1 className="mt-5 text-balance font-display text-[32px] font-bold leading-[1.15] tracking-tight text-white md:text-[40px] lg:text-[46px]">
                Le pouvoir d&apos;achat de vos équipes, chez les commerces qui comptent
              </h1>
              <p className="mt-5 text-[16px] leading-relaxed text-brand-100 lg:text-[17px]">
                CartePro crédite vos salariés en quelques secondes et leur ouvre un réseau de
                partenaires locaux référencés par le Ministère, sans papier ni friction.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link href="/signup" className={buttonStyles("primary", "lg", "w-full sm:w-auto")}>
                  S&apos;inscrire
                </Link>
                <Link href="/login" className={buttonStyles("secondary", "lg", "w-full sm:w-auto")}>
                  Se connecter
                </Link>
              </div>
            </div>

            {/* Visuel de carte pour un visiteur non connecté : illustration
                décorative, non branchée sur des données réelles. La mention de
                simulation accompagne le montant (mail Pontaillac). */}
            <CardVisual className="w-full max-w-[380px] shrink-0" />
          </div>
        </section>

        {/* Le dispositif + les 3 espaces */}
        <section id="dispositif" className="mx-auto max-w-[1200px] px-5 py-16 md:px-8 lg:py-20">
          <h2 className="font-display text-[26px] font-bold tracking-tight md:text-[30px]">
            Le dispositif CartePro
          </h2>
          <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-ink-700">
            CartePro modernise et généralise le principe des avantages salariés dématérialisés.
            Les employeurs dotent leurs salariés de crédits, utilisables auprès d&apos;un réseau
            de partenaires référencés : commerces de proximité, culture, restauration, loisirs.
          </p>
          <div className="mt-5">
            <SimulationNotice>
              Démonstrateur : simulation fonctionnelle. Aucune transaction financière réelle
              n&apos;est effectuée, aucune valeur monétaire réelle ne circule.
            </SimulationNotice>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {spaces.map((s) => (
              <div key={s.title} className="rounded-2xl border border-line bg-white p-7">
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-brand-50">
                  <s.icon size={24} className="text-brand-700" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-700">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comment ça marche */}
        <section
          id="fonctionnement"
          className="border-y border-line bg-white"
        >
          <div className="mx-auto max-w-[1200px] px-5 py-16 md:px-8 lg:py-20">
            <h2 className="font-display text-[26px] font-bold tracking-tight md:text-[30px]">
              Comment ça marche
            </h2>
            <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[16px] font-bold">{step.title}</span>
                  <span className="text-[14px] leading-relaxed text-ink-700">{step.body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Partenaires : catégories neutres, pilotées par les données */}
        <section id="partenaires" className="mx-auto max-w-[1200px] px-5 py-16 md:px-8 lg:py-20">
          <h2 className="font-display text-[26px] font-bold tracking-tight md:text-[30px]">
            Des partenaires près de chez vous
          </h2>
          <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-ink-700">
            Le réseau est organisé par catégories. Il évolue régulièrement : de nouvelles
            catégories et de nouveaux partenaires s&apos;ajoutent sans changement de l&apos;interface.
          </p>

          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {partnerCategories.map((cat) => {
              const Icon = categoryIcon[cat.slug] ?? MapPin;
              return (
                <li key={cat.slug} className="flex flex-col rounded-2xl border border-line bg-white p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-100">
                    <Icon size={20} className="text-gold-700" aria-hidden />
                  </div>
                  <h3 className="mt-3.5 font-display text-base font-bold">{cat.label}</h3>
                  <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-ink-500">{cat.blurb}</p>
                  <p className="mt-3 text-[12.5px] font-semibold text-brand-700">
                    {cat.partnerCount > 0
                      ? `${cat.partnerCount} partenaire${cat.partnerCount > 1 ? "s" : ""} référencé${cat.partnerCount > 1 ? "s" : ""}`
                      : "Bientôt disponible"}
                  </p>
                </li>
              );
            })}
          </ul>

          <ul className="mt-10 grid grid-cols-1 divide-y divide-brand-200 overflow-hidden rounded-2xl bg-brand-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <li className="flex items-center justify-center gap-2.5 px-5 py-4 text-center text-[14px] font-semibold text-brand-700">
              <MapPin size={18} aria-hidden className="shrink-0" />
              Recherche par ville et à proximité
            </li>
            <li className="flex items-center justify-center gap-2.5 px-5 py-4 text-center text-[14px] font-semibold text-brand-700">
              <ShieldCheck size={18} aria-hidden className="shrink-0" />
              Partenaires validés par le Ministère
            </li>
            <li className="flex items-center justify-center gap-2.5 px-5 py-4 text-center text-[14px] font-semibold text-brand-700">
              <Zap size={18} aria-hidden className="shrink-0" />
              Paiement en moins de 3 secondes
            </li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-8 text-[12.5px] text-ink-500 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="max-w-2xl leading-relaxed">
            <strong className="font-semibold text-ink-700">CartePro</strong> n&apos;est pas un
            service de paiement au sens réglementaire dans le cadre de ce démonstrateur. Il
            s&apos;agit d&apos;une simulation fonctionnelle. Aucune transaction financière réelle
            n&apos;est effectuée.
          </p>
          <p className="whitespace-nowrap">© Ministère du Job et Bonheur · JEB/DNI/2026-002</p>
        </div>
      </footer>
    </>
  );
}
