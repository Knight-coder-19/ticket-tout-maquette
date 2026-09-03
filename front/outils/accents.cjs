/**
 * Vérificateur d'accents.
 *
 *     npm run verif:accents
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QU'IL FAIT
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il cherche du français non accentué dans ce qu'un humain LIT à l'écran :
 * « Categorie », « Deposee le », « Oueme », « aucune valeur reelle ». C'est la
 * règle de `front/CLAUDE.md` : un dispositif de l'État ne montre pas
 * « Categorie » à l'écran, données de démonstration comprises.
 *
 * Il ne regarde que deux choses dans les fichiers `.ts` et `.tsx` :
 *   - les chaînes de caractères — "…", '…', `…` ;
 *   - le texte JSX, celui qui se trouve entre deux balises.
 *
 * Sortie : `0` si tout est propre, `1` en listant fichier, ligne et chaîne.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QU'IL NE FAIT PAS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il ne touche à rien : il lit, il signale. Aucune correction automatique —
 * une substitution sur « e » ferait des dégâts, et distinguer un libellé d'un
 * identifiant demande de lire.
 *
 * Il écarte volontairement, parce que ce n'est jamais du texte affiché :
 *   - les commentaires, neutralisés avant l'analyse ;
 *   - les identifiants, clés d'objet et noms de variables ;
 *   - les codes d'erreur et valeurs d'union — `"acceptee"`, `"deja_tranchee"`
 *     sont des codes, ils restent sans accent ;
 *   - les chemins d'URL et les adresses de courriel ;
 *   - les listes de classes CSS — `minuteur minuteur--expire`.
 *
 * Une exception assumée : dans `src/mocks/`, un mot seul en minuscules EST
 * vérifié. Ailleurs c'est un code ; là-bas, « sante » ou « mobilite » sont des
 * libellés de catégorie qui s'affichent tels quels.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SA LIMITE, À CONNAÎTRE AVANT DE LUI FAIRE CONFIANCE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * **C'est une liste de vocabulaire, pas un dictionnaire.** Il ne connaît que
 * les mots énumérés dans `MOTS` ci-dessous : ceux qui apparaissent dans cette
 * application, plus quelques classiques. Un mot français non accentué qui n'y
 * figure pas passera sans être vu.
 *
 * Un `npm run verif:accents` vert veut donc dire « aucune régression connue »,
 * pas « le français est parfait ». La relecture reste le contrôle qui décide.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AJOUTER UN MOT
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Ajoutez la forme SANS accent, en minuscules, dans l'alternance de `MOTS`.
 * La comparaison est insensible à la casse : « sante » attrape aussi
 * « Sante » et « SANTE ». Pour couvrir le pluriel ou le féminin, mettez la
 * partie variable entre parenthèses optionnelles, comme les entrées
 * existantes : `deposees?`, `etablissements?`, `expirees?`.
 *
 * Deux précautions avant d'ajouter :
 *   1. le mot ne doit pas être un identifiant ou une valeur de code utilisée
 *      ailleurs — sinon vous ajoutez du bruit, pas un contrôle ;
 *   2. relancez `npm run verif:accents` : s'il remonte des faux positifs, ils
 *      masqueront les vraies régressions le jour où il y en aura.
 *
 * Pour éprouver le contrôle, cassez volontairement un accent quelque part et
 * vérifiez qu'il sort `1`, puis remettez.
 */

const fs = require("node:fs");
const path = require("node:path");

/**
 * Les formes sans accent à débusquer. Voir « AJOUTER UN MOT » ci-dessus.
 * Les gardes `(?:^|[^a-zà-ÿ])` et `(?![a-zà-ÿ])` tiennent lieu de frontières de
 * mot : `\b` ne les poserait pas au bon endroit sur des lettres accentuées.
 *
 * ⚠ Deux entrées sont ambiguës et peuvent donner un faux positif :
 *   - `affiche` — « affiché » prend l'accent, « il affiche » non ;
 *   - `marche` — « le Marché » prend l'accent, « ça marche » non.
 * Elles sont gardées parce que ces mots-là sont fréquents dans les libellés de
 * l'application. Si l'une d'elles vous signale un texte correct, la bonne
 * réponse est de la retirer d'ici, pas de tordre le libellé.
 *
 * À l'inverse, n'ajoutez jamais un mot qui s'écrit SANS accent en français :
 * « opposable », « obligatoire », « transaction ». Le contrôle se mettrait à
 * crier sur du texte juste, et on cesserait de l'écouter.
 *
 * Attention au `e?` optionnel : `retiree?s?` attrape aussi « retire », qui est
 * correct, et `inverse?e?` attrape « inverse », qui l'est aussi. Quand la forme
 * courte est un mot valide sans accent, exigez la forme longue —
 * `retirees?`, `inversees?` — ou renoncez à l'entrée.
 *
 * ─── LE MÊME PIÈGE, AU PRÉSENT ───
 *
 * Sept entrées ont été retirées pour cette raison : « accepte », « refuse »,
 * « expire », « marche », « decide », « libere », « precede ». Toutes sont des
 * formes verbales JUSTES sans accent — « il n'accepte plus », « le code
 * expire », « il refuse ». Elles avaient été ajoutées pour attraper les
 * participes (« accepté », « refusé ») ; elles attrapaient surtout des phrases
 * correctes.
 *
 * On perd la détection de « accepte » écrit pour « accepté ». C'est le bon
 * échange : un contrôle qui crie sur du texte juste finit par n'être plus lu,
 * et alors il ne détecte plus rien du tout.
 *
 * ─── LE PIÈGE S'ÉTAIT REGLISSÉ PAR LA PORTE À CÔTÉ ───
 *
 * `expire` a été retiré de la liste ci-dessus, mais `expiree?` — gardée pour
 * « expirée »/« expirées », très fréquent dans les messages de session — le
 * `e?` FINAL rendait aussi ce mot-là capable d'attraper « expire » tout court
 * : `expiree?` se lit « expir » + « e » + un `e` optionnel, donc « expire »
 * (une seule lettre e finale) matchait déjà. Corrigée en `expirees?` : le
 * second `e` est désormais OBLIGATOIRE, seul le `s` du pluriel reste
 * optionnel. Trouvée en lisant, comme le reste de cette section.
 */
const MOTS =
  /(?:^|[^a-zà-ÿ])(adhesion|decisions?|categories?|deposees?|reelles?|sante|mobilite|numerique|epicerie|republique|oueme|expirees?|deja|ete|etre|reessayer|caracteres|commercant|etablissements?|agree|parametres?|tranchees?|enregistrees?|repondu|collegue|passees|chargee|verifiez|amelie|reel|apres|tres|donnees|systeme|controle|precedent|premiere|derniere|encaisse|cree|verifie|reussi|echoue|demonstrateur|affichees?|affiches?|beneficiaires?|operations?|numero|reglement|emission|securisee?|necessaires?|evenement|resultat|selectionnee?|reserve|horodatee?|chaine|integre|integrite|verifiees?|ecritures?|references?|decheance|salaries?|retirees?|annulees?|inversees?|entete)(?![a-zà-ÿ])/i;

/** Chemins, courriels, identifiants composés : jamais du texte affiché. */
const NON_AFFICHE = /[@/]|^[a-z0-9]+(?:[_.:-]+[a-z0-9_-]+)+$/;

/** Un mot seul en minuscules : un code, sauf dans les données de simulation. */
const MOT_SEUL = /^[a-z0-9]+$/;

/**
 * Dans `src/mocks/`, des mots seuls qui NE SONT JAMAIS un libellé de
 * démonstration même s'ils tombent dans `MOTS` — ce sont des noms de colonne
 * d'un format d'échange (CSV, JSON) que le format impose sans accent, jamais
 * affichés, seulement comparés à l'en-tête d'un fichier importé.
 *
 * Liste volontairement courte : la bonne réponse, la plupart du temps, est de
 * corriger le texte plutôt que d'agrandir cette liste. Vérifiez en lisant
 * chaque ajout — même précaution que pour `MOTS`.
 *
 * `reference` : colonne du CSV de rechargement (`funding/csv.rs:1`,
 * `mocks/magasin.ts`, fonction `analyserCsv`).
 */
const IDENTIFIANTS_TECHNIQUES_MOCKS = new Set([
  "reference",
  /* `AuteurMessage` (`types/domaine.ts`, réclamations) : valeur d'union
     interne, jamais affichée telle quelle -- toujours traduite en « Salarié »
     ou « Vous » avant d'atteindre l'écran (voir `FileReclamations.tsx`,
     `FilMessages.tsx`). */
  "salarie",
]);

/**
 * Une liste de classes CSS : tous les jetons en minuscules, au moins un
 * composé. Aucune phrase française ne ressemble à cela.
 */
function estClasseCss(texte) {
  const jetons = texte.split(/\s+/).filter((jeton) => jeton !== "");
  /* Le `[-_]*` final couvre les gabarits dont l'interpolation vient d'etre
     blanchie : `controle__resultat--${etat}` laisse `controle__resultat--`. */
  return (
    jetons.length > 0 &&
    jetons.every((jeton) => /^[a-z0-9]+(?:[-_]+[a-z0-9]+)*[-_]*$/.test(jeton)) &&
    jetons.some((jeton) => /[-_]/.test(jeton))
  );
}

function fichiers(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      return entree.name === "node_modules" ? [] : fichiers(chemin);
    }
    return /\.tsx?$/.test(entree.name) ? [chemin] : [];
  });
}

/** Les morceaux d'une ligne qu'un humain pourrait lire à l'écran. */
function textesAffichables(ligne) {
  const morceaux = [];

  /* Chaînes "…", '…', `…`, échappements compris. */
  const chaines =
    /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  for (const trouve of ligne.matchAll(chaines)) {
    /* Les interpolations `${…}` d'un gabarit sont du CODE, pas du texte :
       `catégorie « ${categorie} »` afficherait sinon la variable `categorie`
       comme une faute d'accent. On les remplace par un espace. */
    morceaux.push((trouve[1] ?? trouve[2] ?? trouve[3] ?? "").replace(/\$\{[^}]*\}/g, " "));
  }

  /* Texte JSX : ce qui se trouve entre deux balises. */
  for (const trouve of ligne.matchAll(/>([^<>{}"']*[A-Za-zÀ-ÿ][^<>{}"']*)</g)) {
    morceaux.push(trouve[1]);
  }

  /* Texte JSX dont la balise ouvrante est à la ligne précédente. On exige un
     espace : sans lui, une ligne d'import comme « Categorie, » ressemblerait à
     une phrase. */
  const nue = ligne.trim();
  if (/^[A-ZÀ-Ÿ][^<>{}"'=]*\s[^<>{}"'=]*$/.test(nue)) morceaux.push(nue);

  return morceaux;
}

const racine = process.argv[2] ?? "src";
let trouves = 0;

for (const fichier of fichiers(racine)) {
  /* Les commentaires sont neutralisés en gardant les sauts de ligne, pour que
     les numéros de ligne signalés restent justes. */
  const source = fs
    .readFileSync(fichier, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (ligne) => " ".repeat(ligne.length));

  const dansMocks = fichier.includes(`${path.sep}mocks${path.sep}`);

  source.split("\n").forEach((ligne, index) => {
    for (const morceau of textesAffichables(ligne)) {
      const texte = morceau.trim();
      /* Un identifiant snake_case ou SCREAMING_SNAKE cite dans une phrase
         (`original_operation_id`, `OPERATION_NOT_FOUND`) est du code, pas du
         francais : on le blanchit avant de chercher un mot mal accentue. */
      const prose = texte.replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/gi, " ");
      if (!MOTS.test(prose)) continue;
      if (NON_AFFICHE.test(texte) || estClasseCss(prose)) continue;
      if (!dansMocks && MOT_SEUL.test(texte)) continue;
      if (dansMocks && IDENTIFIANTS_TECHNIQUES_MOCKS.has(texte.toLowerCase())) continue;
      console.log(`${fichier}:${index + 1}: ${texte}`);
      trouves += 1;
    }
  });
}

console.log(
  trouves === 0
    ? "\n\u2713 aucun francais non accentue dans du texte affiche"
    : `\n\u2717 ${trouves} chaine(s) a relire`,
);
process.exit(trouves === 0 ? 0 : 1);
