import type { Transaction } from "@/types/domaine";

/**
 * Historique de demonstration.
 * - "validee"        : operation normale, compte dans le solde.
 * - "annulee"        : operation reprise par une contre-ecriture.
 * - "contre_ecriture": la ligne de correction elle-meme (montant negatif).
 *
 * Une transaction validee n'est jamais modifiee ni supprimee : on ecrit une
 * contre-ecriture (T. Vignal, "c'est de la comptabilite, pas du CRUD").
 */
export const transactionsDemo: Transaction[] = [
  {
    id: "txn-009",
    date: "2026-09-01T12:41:00.000Z",
    partenaireNom: "Boulangerie du Marché",
    montant: 890,
    statut: "validee",
    transactionOrigineId: null,
  },
  {
    id: "txn-008",
    date: "2026-08-28T19:12:00.000Z",
    partenaireNom: "Cinéma Le Zola",
    montant: 950,
    statut: "validee",
    transactionOrigineId: null,
  },
  {
    id: "txn-007b",
    date: "2026-08-24T09:30:00.000Z",
    partenaireNom: "Le Comptoir des Halles",
    montant: -1240,
    statut: "contre_ecriture",
    transactionOrigineId: "txn-007",
  },
  {
    id: "txn-007",
    date: "2026-08-23T13:05:00.000Z",
    partenaireNom: "Le Comptoir des Halles",
    montant: 1240,
    statut: "annulee",
    transactionOrigineId: null,
  },
  {
    id: "txn-006",
    date: "2026-08-14T18:47:00.000Z",
    partenaireNom: "Épicerie Les Quatre Saisons",
    montant: 800,
    statut: "validee",
    transactionOrigineId: null,
  },
  {
    id: "txn-005",
    date: "2026-08-03T11:20:00.000Z",
    partenaireNom: "Librairie Gutenberg",
    montant: 620,
    statut: "validee",
    transactionOrigineId: null,
  },
  {
    id: "txn-004",
    date: "2026-07-22T12:55:00.000Z",
    partenaireNom: "Boulangerie du Marché",
    montant: 430,
    statut: "validee",
    transactionOrigineId: null,
  },
  {
    id: "txn-003",
    date: "2026-07-11T20:03:00.000Z",
    partenaireNom: "Le Comptoir des Halles",
    montant: 1560,
    statut: "validee",
    transactionOrigineId: null,
  },
  {
    id: "txn-002",
    date: "2026-06-30T13:38:00.000Z",
    partenaireNom: "Épicerie Les Quatre Saisons",
    montant: 640,
    statut: "validee",
    transactionOrigineId: null,
  },
  {
    id: "txn-001",
    date: "2026-06-18T12:10:00.000Z",
    partenaireNom: "Cinéma Le Zola",
    montant: 900,
    statut: "validee",
    transactionOrigineId: null,
  },
];
