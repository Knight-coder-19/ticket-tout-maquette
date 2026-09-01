import { MENTION_SIMULATION } from "@/lib/config/constantes";

/**
 * Mention obligatoire partout ou une valeur monetaire apparait.
 *
 * Elle est encapsulee dans un composant, et non recopiee ecran par ecran,
 * pour une raison precise : une mention recopiee finit par etre oubliee
 * quelque part, et c'est exactement ce que F. Pontaillac demande d'eviter.
 */
export function MentionSimulation() {
  return <p>{MENTION_SIMULATION}</p>;
}
