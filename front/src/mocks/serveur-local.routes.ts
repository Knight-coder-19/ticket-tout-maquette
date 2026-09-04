// FICHIER GÉNÉRÉ — ne pas éditer à la main. Voir scratchpad/gen-routes.mjs.
// Table des routes /api servies côté navigateur pour la maquette statique.
/* eslint-disable */

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;
export interface RouteLocale {
  motif: RegExp;
  params: string[];
  handlers: Partial<Record<string, Handler>>;
}

import * as r0 from "./api/v1/partner/payment-tokens/[reference]/route";
import * as r1 from "./api/v1/admin/topup-batches/[id]/validate/route";
import * as r2 from "./api/v1/admin/employees/[id]/adjustments/route";
import * as r3 from "./api/v1/admin/employees/[id]/reinstate/route";
import * as r4 from "./api/v1/admin/partners/[id]/reinstate/route";
import * as r5 from "./api/v1/admin/employees/[id]/suspend/route";
import * as r6 from "./api/v1/admin/partners/[id]/approve/route";
import * as r7 from "./api/v1/admin/partners/[id]/suspend/route";
import * as r8 from "./api/v1/admin/claims/[id]/messages/route";
import * as r9 from "./api/v1/admin/partners/[id]/reject/route";
import * as r10 from "./api/v1/admin/partners/[id]/close/route";
import * as r11 from "./api/v1/admin/highlights/reorder/route";
import * as r12 from "./api/v1/public/featured-partners/route";
import * as r13 from "./api/v1/admin/claims/[id]/close/route";
import * as r14 from "./api/v1/me/payment-tokens/[jti]/route";
import * as r15 from "./api/v1/admin/partner-accounts/route";
import * as r16 from "./api/v1/admin/highlights/[id]/route";
import * as r17 from "./api/v1/partner/daily-revenue/route";
import * as r18 from "./api/v1/admin/employees/[id]/route";
import * as r19 from "./api/v1/admin/ledger-entries/route";
import * as r20 from "./api/v1/partner/transactions/route";
import * as r21 from "./api/v1/admin/compensations/route";
import * as r22 from "./api/v1/admin/topup-batches/route";
import * as r23 from "./api/v1/admin/audit/verify/route";
import * as r24 from "./api/v1/admin/transactions/route";
import * as r25 from "./api/v1/admin/claims/[id]/route";
import * as r26 from "./api/v1/me/minister-picks/route";
import * as r27 from "./api/v1/me/payment-tokens/route";
import * as r28 from "./api/v1/admin/highlights/route";
import * as r29 from "./api/v1/partner/payments/route";
import * as r30 from "./api/v1/admin/dashboard/route";
import * as r31 from "./api/v1/admin/employees/route";
import * as r32 from "./api/v1/admin/employers/route";
import * as r33 from "./api/v1/me/transactions/route";
import * as r34 from "./api/v1/partner/account/route";
import * as r35 from "./api/v1/partner/summary/route";
import * as r36 from "./api/v1/admin/partners/route";
import * as r37 from "./api/v1/admin/claims/route";
import * as r38 from "./api/v1/admin/topups/route";
import * as r39 from "./api/v1/admin/audit/route";
import * as r40 from "./api/v1/categories/route";
import * as r41 from "./api/v1/me/balance/route";
import * as r42 from "./api/v1/catalog/route";
import * as r43 from "./api/v1/cities/route";

export const routesLocales: RouteLocale[] = [
  { motif: new RegExp("^/api/v1/partner/payment-tokens/([^/]+)/?$"), params: ["reference"], handlers: { GET: (r0 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/topup-batches/([^/]+)/validate/?$"), params: ["id"], handlers: { POST: (r1 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/employees/([^/]+)/adjustments/?$"), params: ["id"], handlers: { POST: (r2 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/employees/([^/]+)/reinstate/?$"), params: ["id"], handlers: { POST: (r3 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/partners/([^/]+)/reinstate/?$"), params: ["id"], handlers: { POST: (r4 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/employees/([^/]+)/suspend/?$"), params: ["id"], handlers: { POST: (r5 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/partners/([^/]+)/approve/?$"), params: ["id"], handlers: { POST: (r6 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/partners/([^/]+)/suspend/?$"), params: ["id"], handlers: { POST: (r7 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/claims/([^/]+)/messages/?$"), params: ["id"], handlers: { POST: (r8 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/partners/([^/]+)/reject/?$"), params: ["id"], handlers: { POST: (r9 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/partners/([^/]+)/close/?$"), params: ["id"], handlers: { POST: (r10 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/highlights/reorder/?$"), params: [], handlers: { PUT: (r11 as any).PUT } },
  { motif: new RegExp("^/api/v1/public/featured-partners/?$"), params: [], handlers: { GET: (r12 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/claims/([^/]+)/close/?$"), params: ["id"], handlers: { POST: (r13 as any).POST } },
  { motif: new RegExp("^/api/v1/me/payment-tokens/([^/]+)/?$"), params: ["jti"], handlers: { DELETE: (r14 as any).DELETE } },
  { motif: new RegExp("^/api/v1/admin/partner-accounts/?$"), params: [], handlers: { GET: (r15 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/highlights/([^/]+)/?$"), params: ["id"], handlers: { DELETE: (r16 as any).DELETE } },
  { motif: new RegExp("^/api/v1/partner/daily-revenue/?$"), params: [], handlers: { GET: (r17 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/employees/([^/]+)/?$"), params: ["id"], handlers: { GET: (r18 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/ledger-entries/?$"), params: [], handlers: { GET: (r19 as any).GET } },
  { motif: new RegExp("^/api/v1/partner/transactions/?$"), params: [], handlers: { GET: (r20 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/compensations/?$"), params: [], handlers: { POST: (r21 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/topup-batches/?$"), params: [], handlers: { POST: (r22 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/audit/verify/?$"), params: [], handlers: { GET: (r23 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/transactions/?$"), params: [], handlers: { GET: (r24 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/claims/([^/]+)/?$"), params: ["id"], handlers: { GET: (r25 as any).GET } },
  { motif: new RegExp("^/api/v1/me/minister-picks/?$"), params: [], handlers: { GET: (r26 as any).GET } },
  { motif: new RegExp("^/api/v1/me/payment-tokens/?$"), params: [], handlers: { POST: (r27 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/highlights/?$"), params: [], handlers: { GET: (r28 as any).GET, POST: (r28 as any).POST } },
  { motif: new RegExp("^/api/v1/partner/payments/?$"), params: [], handlers: { POST: (r29 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/dashboard/?$"), params: [], handlers: { GET: (r30 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/employees/?$"), params: [], handlers: { GET: (r31 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/employers/?$"), params: [], handlers: { GET: (r32 as any).GET } },
  { motif: new RegExp("^/api/v1/me/transactions/?$"), params: [], handlers: { GET: (r33 as any).GET } },
  { motif: new RegExp("^/api/v1/partner/account/?$"), params: [], handlers: { GET: (r34 as any).GET } },
  { motif: new RegExp("^/api/v1/partner/summary/?$"), params: [], handlers: { GET: (r35 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/partners/?$"), params: [], handlers: { GET: (r36 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/claims/?$"), params: [], handlers: { GET: (r37 as any).GET } },
  { motif: new RegExp("^/api/v1/admin/topups/?$"), params: [], handlers: { POST: (r38 as any).POST } },
  { motif: new RegExp("^/api/v1/admin/audit/?$"), params: [], handlers: { GET: (r39 as any).GET } },
  { motif: new RegExp("^/api/v1/categories/?$"), params: [], handlers: { GET: (r40 as any).GET } },
  { motif: new RegExp("^/api/v1/me/balance/?$"), params: [], handlers: { GET: (r41 as any).GET } },
  { motif: new RegExp("^/api/v1/catalog/?$"), params: [], handlers: { GET: (r42 as any).GET } },
  { motif: new RegExp("^/api/v1/cities/?$"), params: [], handlers: { GET: (r43 as any).GET } },
];
