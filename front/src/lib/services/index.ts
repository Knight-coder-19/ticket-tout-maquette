/**
 * Point d'entree des services.
 * Selon NEXT_PUBLIC_USE_MOCKS, l'application recoit soit l'implementation
 * reelle, soit l'implementation simulee. Les deux respectent la meme
 * interface, ce qui permet a l'equipe front d'avancer sans backend
 * sans construire une architecture differente de celle de production.
 */


// TODO: importer les implementations reelles et simulees, puis exporter
// l'une ou l'autre selon env.utiliserMocks.

export {};
