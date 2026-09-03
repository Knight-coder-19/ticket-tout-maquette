"use client";

import { useRef } from "react";

/**
 * Sélecteur segmenté accessible. Sémantique `radiogroup` (et non `tablist` :
 * il n'y a pas de panneau associé, juste un choix), navigation aux flèches et
 * tabindex mobile — conforme WAI-ARIA (RGAA).
 *
 * L'indicateur blanc est un élément unique qui glisse d'une option à l'autre
 * (translateX), au lieu d'un fond qui saute de bouton en bouton.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(0, options.indexOf(value));
  const gap = 0.25; // rem, doit suivre `gap-1`

  function handleKey(e: React.KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next]);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-line bg-surface p-1 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-xl bg-white shadow-[0_1px_4px_rgba(14,21,38,0.12)] transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.5rem - ${(options.length - 1) * gap}rem) / ${options.length})`,
          transform: `translateX(calc(${activeIndex} * (100% + ${gap}rem)))`,
        }}
      />
      {options.map((option, index) => {
        const selected = option === value;
        return (
          <button
            key={option}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(e) => handleKey(e, index)}
            className={`relative z-10 h-11 rounded-xl px-3 text-[13.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${
              selected ? "text-brand-700" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
