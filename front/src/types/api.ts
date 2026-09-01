/**
 * Contrats d'echange avec le backend.
 * A synchroniser avec la specification OpenAPI de l'equipe backend.
 * Toute divergence entre ce fichier et la specification est un bug.
 */

export interface ReponsePaginee<T> {
  elements: T[];
  page: number;
  taillePage: number;
  total: number;
}

export interface ErreurApi {
  code: string;
  message: string;
  details?: Record<string, string>;
}
