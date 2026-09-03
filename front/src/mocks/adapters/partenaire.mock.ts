import type { ServicePartenaire } from "@/lib/services/partenaire.service";
import type { Categorie, Partenaire } from "@/types/domaine";
import { TAILLE_PAGE_CATALOGUE } from "@/lib/config/constantes";
import { categoriesDemo } from "../fixtures/categories";
import { partenairesDemo } from "../fixtures/partenaires";

function latence<T>(valeur: T, ms = 260): Promise<T> {
  return new Promise((resoudre) => setTimeout(() => resoudre(valeur), ms));
}

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export const partenaireMock: ServicePartenaire = {
  listerCategories() {
    const triees: Categorie[] = [...categoriesDemo].sort((a, b) => a.ordre - b.ordre);
    return latence(triees);
  },

  listerPartenaires({ page, categorieId, recherche }) {
    let resultats: Partenaire[] = partenairesDemo;
    if (categorieId) {
      resultats = resultats.filter((p) => p.categorieId === categorieId);
    }
    if (recherche && recherche.trim() !== "") {
      const q = normaliser(recherche);
      resultats = resultats.filter(
        (p) => normaliser(p.nom).includes(q) || normaliser(p.ville ?? "").includes(q),
      );
    }
    const taille = TAILLE_PAGE_CATALOGUE;
    const debut = (page - 1) * taille;
    return latence({
      elements: resultats.slice(debut, debut + taille),
      page,
      taillePage: taille,
      total: resultats.length,
    });
  },

  encaisser() {
    // Cote partenaire : hors perimetre de la branche "espace salarie".
    return Promise.reject(new Error("Encaissement non disponible dans l'espace salarié."));
  },
};
