/**
 * Chemins de l'API backend, centralises.
 * Une route qui change se corrige ici et nulle part ailleurs.
 */

export const routesApi = {
  salarie: {
    solde: (id: string) => `/api/v1/employees/${id}/balance`,
    transactions: (id: string) => `/api/v1/employees/${id}/transactions`,
    codePaiement: (id: string) => `/api/v1/employees/${id}/payment-code`,
  },
  partenaires: {
    catalogue: "/api/v1/partners",
    detail: (id: string) => `/api/v1/partners/${id}`,
    inscription: "/api/v1/partners",
  },
  categories: {
    liste: "/api/v1/categories",
  },
  administration: {
    demandes: "/api/v1/admin/partner-requests",
    decision: (id: string) => `/api/v1/admin/partner-requests/${id}/decision`,
  },
} as const;
