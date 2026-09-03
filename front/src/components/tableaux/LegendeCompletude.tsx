/**
 * La légende qui dit si un tableau est complet.
 *
 * ─── C'est une règle du projet, pas une phrase d'habillage ───
 *
 * Elle est née d'un vrai défaut : le registre de l'administration affichait
 * vingt écritures sur vingt-deux, sans rien indiquer. Un agent qui lit « 20
 * écritures » croit avoir vu le tout. La règle est depuis acquise — un tableau
 * paginé DIT s'il est complet — et elle a été réécrite une deuxième fois pour
 * le journal du commerçant.
 *
 * Une règle qu'on réécrit à chaque écran est une règle qui finit par sauter sur
 * l'un d'eux. La voici une fois.
 *
 * ─── L'accord ───
 *
 * `feminin` n'est pas une coquetterie : « 20 écritures affichéES » et « 20
 * encaissements affichéS ». Le porter en paramètre est la seule façon d'avoir
 * une phrase juste dans les deux cas sans réécrire la phrase.
 *
 * ─── Le nombre affiché est celui des lignes REÇUES ───
 *
 * Ce composant compte ce que le tableau montre, jamais un total venu
 * d'ailleurs. Un écran qui doit afficher le total d'un ensemble filtré le fait
 * en tête, avec un chiffre calculé sur cet ensemble — pas dans cette légende,
 * qui décrirait alors autre chose que ce qu'on a sous les yeux.
 */
export function LegendeCompletude({
  nombre,
  resteAVenir,
  singulier,
  pluriel,
  feminin = false,
  suite,
}: {
  /** Le nombre de lignes réellement affichées. */
  nombre: number;
  /** Vrai s'il reste des lignes à charger au-delà de celles-ci. */
  resteAVenir: boolean;
  singulier: string;
  pluriel: string;
  /** Accord de « affiché(e)(s) » sur le nom employé. */
  feminin?: boolean;
  /** Ce qui ferme la phrase : « la plus récente d'abord. » */
  suite: string;
}) {
  const nom = nombre === 1 ? singulier : pluriel;
  const accord = `affiché${feminin ? "e" : ""}${nombre === 1 ? "" : "s"}`;

  return (
    <caption>
      {nombre} {nom}
      {resteAVenir ? ` ${accord}, d'autres restent à charger` : " au total"}
      {suite === "" ? "." : `, ${suite}`}
    </caption>
  );
}
