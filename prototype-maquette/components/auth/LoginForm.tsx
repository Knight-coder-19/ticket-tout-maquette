"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, ShieldCheck } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { TextField, PasswordField, CheckboxField } from "@/components/ui/FormField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { isValidEmail } from "@/lib/validation";

const roles = ["Employé", "Partenaire", "Ministère"] as const;
type Role = (typeof roles)[number];

const helperByRole: Record<Role, string> = {
  Employé:
    "Vos identifiants vous sont fournis par votre employeur. Aucune inscription n'est nécessaire.",
  Partenaire: "Utilisez l'e-mail et le mot de passe du compte partenaire validé par le Ministère.",
  Ministère: "Accès réservé aux agents habilités du Ministère du Job et Bonheur.",
};

type Errors = Partial<Record<"email" | "password", string>>;

export function LoginForm() {
  const [role, setRole] = useState<Role>("Employé");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    const next: Errors = {};
    if (!isValidEmail(email)) next.email = "Adresse e-mail invalide.";
    if (password.length < 1) next.password = "Saisissez votre mot de passe.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Prototype front : pas d'API d'authentification sur cette branche.
    // On simule l'aller-retour réseau puis on affiche l'état connecté.
    setStatus("loading");
    window.setTimeout(() => setStatus("done"), 700);
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
          <ShieldCheck size={22} className="text-brand-700" aria-hidden />
        </div>
        <h2 className="mt-4 font-display text-lg font-bold">Connexion simulée</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-700">
          Profil <strong>{role}</strong> authentifié. L&apos;espace correspondant sera accessible
          une fois les branches fusionnées.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-[13px] font-semibold text-brand-700 hover:text-brand-900"
        >
          Retour au formulaire
        </button>
      </div>
    );
  }

  return (
    <>
      <SegmentedControl
        label="Choisir un profil"
        options={roles}
        value={role}
        onChange={setRole}
        className="mt-6"
      />

      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <TextField
          label="Adresse e-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="prenom.nom@entreprise.fr"
          error={errors.email}
          required
        />
        <PasswordField
          label="Mot de passe"
          name="password"
          autoComplete="current-password"
          placeholder="Votre mot de passe"
          error={errors.password}
          required
        />

        <div className="flex items-center justify-between gap-3">
          <CheckboxField label="Se souvenir de moi" name="remember" />
          <Link href="/login" className="shrink-0 text-[13px] font-semibold text-brand-700">
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          type="submit"
          className={buttonStyles("primary", "lg", "mt-1 w-full")}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Connexion…" : "Se connecter"}
        </button>

        <p className="flex items-start gap-2.5 rounded-xl bg-brand-50 p-3.5 text-[12.5px] leading-relaxed text-brand-700">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          {helperByRole[role]}
        </p>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-500">
        Vous représentez un commerce ?{" "}
        <Link href="/signup" className="font-bold text-brand-700">
          Créer un compte partenaire
        </Link>
      </p>
    </>
  );
}
