"use client";

import { useId, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import styles from "../salarie.module.css";

export function FormulaireDemande({
  onEnvoye,
  onAnnuler,
}: {
  onEnvoye: () => void;
  onAnnuler: () => void;
}) {
  const sujetId = useId();
  const messageId = useId();
  const [erreur, setErreur] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (!String(data.get("sujet") ?? "").trim() || !String(data.get("message") ?? "").trim()) {
      setErreur("Renseignez un sujet et un message.");
      return;
    }
    // Prototype : pas d'API sur cette branche, on simule l'envoi.
    onEnvoye();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--espace-3)" }} noValidate>
      <div style={{ display: "grid", gap: "var(--espace-1)" }}>
        <label htmlFor={sujetId} style={{ fontSize: "var(--taille-sm)", fontWeight: 500 }}>
          Sujet
        </label>
        <input id={sujetId} name="sujet" className={styles.champ} required />
      </div>
      <div style={{ display: "grid", gap: "var(--espace-1)" }}>
        <label htmlFor={messageId} style={{ fontSize: "var(--taille-sm)", fontWeight: 500 }}>
          Message
        </label>
        <textarea
          id={messageId}
          name="message"
          rows={4}
          className={styles.champ}
          style={{ height: "auto", padding: "var(--espace-3)", fontFamily: "var(--police-corps)" }}
          required
        />
      </div>
      {erreur ? (
        <p role="alert" style={{ color: "var(--couleur-alerte)", fontSize: "var(--taille-sm)" }}>
          {erreur}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "var(--espace-2)" }}>
        <Bouton type="submit">Envoyer</Bouton>
        <Bouton variante="discret" onClick={onAnnuler}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
