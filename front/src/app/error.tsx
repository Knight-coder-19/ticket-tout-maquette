"use client";

export default function Erreur({ reset }: { reset: () => void }) {
  // TODO: message expliquant ce qui s'est passe et comment le corriger.
  return (
    <main>
      <h1>Une erreur est survenue</h1>
      <button onClick={reset}>Reessayer</button>
    </main>
  );
}
