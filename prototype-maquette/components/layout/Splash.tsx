"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";

type Phase = "hidden" | "visible" | "fading";

/**
 * One-time animated intro shown over the landing page on a visitor's first
 * load this session. The landing content underneath is already rendered -
 * this is a progressive-enhancement overlay, not a route gate, so it never
 * blocks SEO, no-JS, or a direct link to another page.
 */
export function Splash() {
  const [phase, setPhase] = useState<Phase>("hidden");

  // Effect 1: decide ONCE per session whether to show it at all. Kept
  // separate from the timers below on purpose - React (Strict Mode in
  // dev, Fast Refresh) can mount an effect, clean it up, and mount it
  // again; if the sessionStorage gate and the fade timers lived in the
  // same effect, that second mount would see the flag already set and
  // skip re-scheduling the timers, leaving the overlay stuck forever.
  useEffect(() => {
    if (sessionStorage.getItem("cartepro-splash-seen")) return;
    sessionStorage.setItem("cartepro-splash-seen", "1");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage only exists client-side, so this can't be decided during SSR/first paint.
    setPhase("visible");
  }, []);

  // Effect 2: drive the fade/unmount timers off `phase`, so a StrictMode
  // remount just cleans up and reschedules - it can't get stuck.
  useEffect(() => {
    if (phase !== "visible") return;
    const fadeTimer = setTimeout(() => setPhase("fading"), 1300);
    const removeTimer = setTimeout(() => setPhase("hidden"), 1700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 transition-opacity duration-[400ms] ${
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative flex h-[104px] w-[104px] items-center justify-center">
        <svg width="104" height="104" viewBox="0 0 104 104" className="absolute inset-0 animate-[spin_1.4s_ease-in-out_1]">
          <circle cx="52" cy="52" r="42" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
          <circle
            cx="52"
            cy="52"
            r="42"
            fill="none"
            stroke="var(--gold-500)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="264"
            strokeDashoffset="40"
            transform="rotate(-90 52 52)"
          />
        </svg>
        <CreditCard size={46} aria-hidden className="text-white" />
      </div>
      <div className="font-display text-[30px] font-bold text-white">
        Carte<span className="text-gold-500">Pro</span>
      </div>
      <div className="text-sm font-medium text-white/85">Le pouvoir d&apos;achat, partout où ça compte</div>
    </div>
  );
}
