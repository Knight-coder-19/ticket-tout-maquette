import { NextResponse, type NextRequest } from "next/server";

/* Garde de rôle (§3.1 : authentification multi-rôles). Tant que la session
   n'existe pas, tout passe — mais le point d'application existe déjà, branché
   sur les bons chemins. En Next 16 ce fichier remplace middleware.ts. */
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/salarie/:path*", "/partenaire/:path*", "/administration/:path*"],
};
