/**
 * Client HTTP unique.
 * Aucun composant n'appelle fetch directement : tout passe par ici,
 * puis par un service. C'est ce qui permet de changer de backend,
 * de brancher les mocks, ou d'ajouter un entete d'authentification
 * a un seul endroit.
 */


export class ErreurReseau extends Error {
  constructor(
    message: string,
    public readonly statut: number,
  ) {
    super(message);
    this.name = "ErreurReseau";
  }
}

export async function appelApi<T>(
  chemin: string,
  options: RequestInit = {},
): Promise<T> {
  // TODO: gestion du jeton de session, entete d'idempotence sur les
  // ecritures, journalisation des erreurs.
  throw new Error("Non implemente");
}
