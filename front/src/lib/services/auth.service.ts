import type { Role } from "@/lib/config/constantes";

export interface Session {
  utilisateurId: string;
  role: Role;
  nom: string;
}

export interface ServiceAuth {
  connecter(identifiant: string, motDePasse: string): Promise<Session>;
  deconnecter(): Promise<void>;
  sessionCourante(): Promise<Session | null>;
}
