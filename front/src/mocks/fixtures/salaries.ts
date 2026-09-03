import type { Salarie } from "@/types/domaine";

/**
 * Salarie de demonstration. Tant que le service d'auth n'est pas branche,
 * les ecrans de l'espace salarie travaillent avec ce profil.
 */
export const salariePrincipal: Salarie = {
  id: "sal-001",
  nom: "Awa Traoré",
  employeur: "Groupe Atlantique RH",
};

export const salariesDemo: Salarie[] = [salariePrincipal];

/** Montant total crédité par l'employeur sur la période (centimes). */
export const CREDIT_PERIODE_CENTIMES = 12000;
