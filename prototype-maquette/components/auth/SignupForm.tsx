"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { TextField, PasswordField, SelectField, CheckboxField } from "@/components/ui/FormField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { partnerCategories } from "@/data/categories";
import { isValidEmail, isValidSiren, isValidFrPhone } from "@/lib/validation";

const roles = ["Partenaire", "Employeur"] as const;
type Role = (typeof roles)[number];

type Errors = Record<string, string>;

export function SignupForm() {
  const [role, setRole] = useState<Role>("Partenaire");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  function switchRole(next: Role) {
    setRole(next);
    setErrors({});
    setStatus("idle");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();

    const next: Errors = {};
    if (!get("name")) next.name = role === "Partenaire" ? "Nom du commerce requis." : "Raison sociale requise.";
    if (!isValidSiren(get("siren"))) next.siren = "SIREN invalide (9 chiffres, clé de contrôle).";
    if (!isValidEmail(get("email"))) next.email = "Adresse e-mail invalide.";

    if (role === "Partenaire") {
      if (!get("city")) next.city = "Ville requise.";
      if (!get("address")) next.address = "Adresse requise.";
      if (!isValidFrPhone(get("phone"))) next.phone = "Numéro de téléphone invalide.";
      if (get("password").length < 8) next.password = "8 caractères minimum.";
      if (!data.get("cgu")) next.cgu = "Vous devez accepter les conditions générales.";
    } else {
      if (!get("employeeCount") || Number(get("employeeCount")) < 1) next.employeeCount = "Nombre de salariés requis.";
      if (!isValidFrPhone(get("phone"))) next.phone = "Numéro de téléphone invalide.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Prototype front : pas d'API d'inscription sur cette branche. On simule
    // l'envoi, puis on affiche l'accusé de réception (validation manuelle
    // obligatoire côté Ministère pour un partenaire).
    setStatus("loading");
    window.setTimeout(() => setStatus("done"), 800);
  }

  if (status === "done") {
    const partner = role === "Partenaire";
    return (
      <div className="rounded-2xl border border-line bg-white p-6">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${partner ? "bg-gold-100" : "bg-brand-50"}`}
        >
          {partner ? (
            <Clock size={22} className="text-gold-700" aria-hidden />
          ) : (
            <CheckCircle2 size={22} className="text-brand-700" aria-hidden />
          )}
        </div>
        <h2 className="mt-4 font-display text-lg font-bold">
          {partner ? "Demande envoyée" : "Merci de votre intérêt"}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-700">
          {partner
            ? "Votre demande d'inscription part en file de validation. Un agent du Ministère l'examine sur pièces (SIREN, objet social) avant toute activation du compte."
            : "Un conseiller du Ministère vous recontactera pour organiser le déploiement de CartePro auprès de vos équipes."}
        </p>
        <Link href="/login" className="mt-4 inline-flex text-[13px] font-semibold text-brand-700 hover:text-brand-900">
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <>
      <SegmentedControl
        label="Type de compte"
        options={roles}
        value={role}
        onChange={switchRole}
        className="mt-6 max-w-[320px]"
      />

      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {role === "Partenaire" ? (
          <div key="partenaire" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              className="sm:col-span-2"
              label="Nom du commerce"
              name="name"
              placeholder="Ex. Boulangerie du Marché"
              error={errors.name}
              required
            />
            <TextField
              label="Numéro SIREN"
              name="siren"
              inputMode="numeric"
              maxLength={9}
              placeholder="9 chiffres"
              hint="Vérifié dans sa forme à l'inscription."
              error={errors.siren}
              required
            />
            <SelectField label="Objet social" name="objetSocial" defaultValue={partnerCategories[0]?.label} error={errors.objetSocial}>
              {partnerCategories.map((c) => (
                <option key={c.slug}>{c.label}</option>
              ))}
              <option>Autre</option>
            </SelectField>
            <TextField label="Ville" name="city" placeholder="Ex. Lyon" error={errors.city} required />
            <TextField label="Adresse" name="address" placeholder="Numéro et rue" error={errors.address} required />
            <TextField
              label="E-mail professionnel"
              name="email"
              type="email"
              placeholder="contact@commerce.fr"
              error={errors.email}
              required
            />
            <TextField
              label="Téléphone"
              name="phone"
              type="tel"
              placeholder="06 12 34 56 78"
              error={errors.phone}
              required
            />
            <PasswordField
              className="sm:col-span-2"
              label="Mot de passe"
              name="password"
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              error={errors.password}
              required
            />
          </div>
        ) : (
          <div key="employeur" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              className="sm:col-span-2"
              label="Raison sociale"
              name="name"
              placeholder="Ex. Groupe Atlantique RH"
              error={errors.name}
              required
            />
            <TextField
              label="Numéro SIREN"
              name="siren"
              inputMode="numeric"
              maxLength={9}
              placeholder="9 chiffres"
              error={errors.siren}
              required
            />
            <TextField
              label="Salariés estimés"
              name="employeeCount"
              type="number"
              min={1}
              placeholder="Ex. 180"
              error={errors.employeeCount}
              required
            />
            <TextField
              label="E-mail du service RH"
              name="email"
              type="email"
              placeholder="rh@entreprise.fr"
              error={errors.email}
              required
            />
            <TextField
              label="Téléphone"
              name="phone"
              type="tel"
              placeholder="06 12 34 56 78"
              error={errors.phone}
              required
            />
          </div>
        )}

        {role === "Partenaire" ? (
          <CheckboxField
            name="cgu"
            error={errors.cgu}
            label={
              <>
                J&apos;accepte les{" "}
                <Link href="/signup" className="font-semibold text-brand-700 underline">
                  conditions générales
                </Link>{" "}
                et la charte des partenaires CartePro.
              </>
            }
          />
        ) : null}

        <button
          type="submit"
          className={buttonStyles("primary", "lg", "mt-1 w-full")}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Envoi…" : role === "Partenaire" ? "Envoyer ma demande" : "Être recontacté"}
        </button>

        <p className="rounded-xl bg-gold-100 p-3.5 text-[12.5px] leading-relaxed text-gold-700">
          {role === "Partenaire"
            ? "L'inscription partenaire passe obligatoirement par une validation manuelle du Ministère avant activation."
            : "Les identifiants des salariés sont créés par l'employeur : ils n'ont pas de compte à créer eux-mêmes."}
        </p>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-500">
        Déjà inscrit ?{" "}
        <Link href="/login" className="font-bold text-brand-700">
          Se connecter
        </Link>
      </p>
    </>
  );
}
