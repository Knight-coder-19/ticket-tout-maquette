import { Logo } from "@/components/ui/Logo";

/**
 * Visuel de carte CartePro pour le hero. Illustration décorative : ce n'est pas
 * une vraie carte de paiement, aucun réseau bancaire, aucun numéro réel (seuls
 * 4 chiffres factices, masqués). Marquée « Simulation » (mail Pontaillac : la
 * mention accompagne tout affichage d'un montant).
 */
export function CardVisual({ className = "" }: { className?: string }) {
  return (
    <figure className={className}>
      <div className="relative aspect-[1.586] overflow-hidden rounded-[18px] bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 text-white shadow-[0_30px_70px_-25px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-transform duration-300 lg:-rotate-2 lg:hover:rotate-0">
        {/* Motif d'ondes en fond. */}
        <svg
          aria-hidden
          viewBox="0 0 300 190"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full text-white/10"
          fill="none"
        >
          <path d="M-30 215C90 150 130 70 330 35" stroke="currentColor" strokeWidth="16" />
          <path d="M-30 240C100 175 165 95 330 65" stroke="currentColor" strokeWidth="11" />
          <path d="M-10 262C130 205 195 125 350 105" stroke="currentColor" strokeWidth="8" />
        </svg>
        {/* Reflet diagonal. */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.18),transparent_45%)]" />

        <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <Logo onDark size="sm" />
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white">
              Simulation
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Puce. */}
            <svg aria-hidden width="42" height="33" viewBox="0 0 42 33" className="shrink-0">
              <rect x="0.75" y="0.75" width="40.5" height="31.5" rx="5" fill="url(#cardvisual-chip)" />
              <g stroke="rgba(0,0,0,0.28)" strokeWidth="1.3" fill="none">
                <rect x="12" y="9" width="18" height="15" rx="2.5" />
                <path d="M17 9V1M25 9V1M17 24v8M25 24v8M12 14H1M12 19H1M30 14h11M30 19h11" />
              </g>
              <defs>
                <linearGradient id="cardvisual-chip" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#eacd86" />
                  <stop offset="1" stopColor="#b58e35" />
                </linearGradient>
              </defs>
            </svg>
            {/* Sans contact. */}
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-white/80">
              <path
                d="M9 6.5c2.6 3 2.6 8 0 11M12.7 4c4 4.4 4 11.6 0 16M16.4 1.5c5.4 5.8 5.4 15.2 0 21"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Solde disponible
            </div>
            <div className="mt-0.5 font-display text-[26px] font-bold sm:text-[28px]">87,40&nbsp;€</div>
          </div>

          <div className="flex items-end justify-between">
            <span className="font-mono text-[13px] tracking-[0.12em] text-white/90">
              •••• •••• •••• 2431
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              Exp. 09/28
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[12px] text-brand-200">
        Carte de démonstration : aucune valeur réelle, hors réseau bancaire.
      </figcaption>
    </figure>
  );
}
