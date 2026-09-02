import { useRef } from "react";

/**
 * Forge une clé d'idempotence.
 *
 * `crypto.randomUUID` n'existe que dans un contexte sécurisé : en https ou
 * sur localhost. Une démonstration ouverte depuis un téléphone sur
 * http://192.168.x.x n'y a pas droit, et l'écran planterait au moment
 * précis où il compte. D'où la solution de repli.
 */
export function nouvelleCle(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cle-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Rend la clé d'idempotence de CETTE tentative d'encaissement.
 *
 * ─── Pourquoi c'est un hook, et pourquoi ça doit le rester ───
 *
 * La garantie de la règle R3 n'est pas dans `nouvelleCle()` — n'importe qui
 * sait tirer un UUID. Elle est dans le `useRef` ci-dessous : la clé est forgée
 * une fois, à la caisse, pour cette tentative, et elle ne bouge plus tant que
 * le composant vit. C'est tout le mécanisme. Si le caissier double-clique, si
 * le réseau lâche après que le serveur a écrit, si la requête est rejouée
 * depuis la file hors ligne, le serveur reconnaît la même clé et renvoie la
 * transaction déjà écrite. Un seul débit.
 *
 * D'où l'avertissement, qui est la raison d'être de ce commentaire : **ne
 * remontez pas ce `useRef` dans un module.** Une clé rangée dans une variable
 * de module serait partagée par tous les encaissements de la session — deux
 * clients différents porteraient la même clé, et le second paiement serait
 * silencieusement reconnu comme un rejeu du premier. Jamais débité.
 *
 * La faute symétrique est aussi facile : régénérer la clé à chaque essai — la
 * mettre dans le corps du composant, ou dans un `useState` recalculé —
 * annulerait la protection dans l'autre sens. Deux clés différentes, deux
 * débits.
 *
 * La durée de vie de la clé est donc exactement celle du composant qui encaisse,
 * ni plus ni moins. Seul un hook peut exprimer cela.
 */
export function useCleIdempotence(): string {
  const ref = useRef<string | null>(null);
  if (ref.current === null) ref.current = nouvelleCle();
  return ref.current;
}
