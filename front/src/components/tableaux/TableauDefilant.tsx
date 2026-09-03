/**
 * La zone de défilement horizontal d'un tableau large.
 *
 * ─── Pourquoi elle est remontée ───
 *
 * Elle était écrite à l'identique dans le registre des écritures et dans le
 * journal du commerçant — mêmes classe, mêmes attributs, seul le libellé
 * changeait. La vue nationale en aurait été la troisième copie.
 *
 * Ce ne sont pas cinq lignes de balisage anodines : `tabIndex={0}` et
 * `role="region"` sont ce qui rend la zone atteignable au clavier. Sans eux,
 * les colonnes de droite ne sont pas consultables sans souris, et rien à
 * l'écran ne le signale. C'est exactement le genre d'attribut qu'une troisième
 * recopie finit par perdre.
 *
 * Le suffixe « défilement horizontal » est ajouté ici plutôt que répété dans
 * chaque appel : les trois tableaux annoncent désormais la même chose dans les
 * mêmes termes, et l'appelant ne nomme que son contenu.
 *
 * La forme (`.tableau-defilant`) est dans `primitives.css`, où elle était
 * déjà — c'est le balisage, et lui seul, qui manquait d'un lieu commun.
 */
export function TableauDefilant({
  /** Ce que la zone contient, au nominatif : « Registre des écritures ». */
  etiquette,
  children,
}: {
  etiquette: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="tableau-defilant"
      tabIndex={0}
      role="region"
      aria-label={`${etiquette}, défilement horizontal`}
    >
      {children}
    </div>
  );
}
