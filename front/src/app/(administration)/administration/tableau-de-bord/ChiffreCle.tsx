/**
 * Une tuile de chiffre clé.
 *
 * Réexporte `TuileStat` (`components/graphiques/`) : le fichier
 * `ChiffreCle.tsx` existait déjà dans l'arborescence de cet écran, mais
 * l'objet qu'il nomme est partagé avec le tableau de bord du commerçant — et
 * un composant partagé par deux espaces vit dans `src/components/`, pas
 * recopié ici. Voir `TuileStat.tsx` pour l'implémentation et le raisonnement.
 */
export { TuileStat as ChiffreCle } from "@/components/graphiques/TuileStat";
