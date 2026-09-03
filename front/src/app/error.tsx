"use client";

export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert">
      <h1>Une erreur est survenue</h1>
      <p>{error.message}</p>
      <button type="button" onClick={reset}>
        Réessayer
      </button>
    </section>
  );
}
