# CartePro devient Ticket Tout : Documentation Jour 3

## Contexte : l'arbitrage du Ministre (mail Sellami, 02/09)

Benjamin Sellami nous écrit : il a perdu l'arbitrage interne. Le Ministre impose le nom **« Ticket Tout »** à l'écran, sur la carte physique et dans la vidéo. Citation du Ministre : « CartePro ça fait imprimerie, Ticket Tout ça fait envie ». C'est cohérent avec le cahier des charges annoté du Jour 1, où JEB disait déjà « CartePro c'était le nom de travail, moi j'appelle ça le Ticket Tout ».

Point de vigilance sécurité (comme au Jour 2) : mail d'expéditeur externe, bandeaux d'avertissement automatiques. Rien à télécharger, aucune info bancaire par mail.

Deux choses en même temps, pour **demain 12h00** :

### 1. Un brand book « Ticket Tout » (PDF, 10 pages minimum)

- Logotype : version principale, monochrome, favicon. Zone de protection, tailles minimales.
- Palette dérivée du bleu institutionnel `#1B3A6B`, avec au moins 2 couleurs d'accentuation. Codes HEX obligatoires.
- Table de contrastes : pour chaque couple texte/fond réellement utilisé, le ratio mesuré et l'outil utilisé. Tout couple sous 4,5:1 signalé comme tel (RGAA AA, Florine).
- Visuel de la carte physique : recto, verso, en situation (main, portefeuille, terminal). Un mockup, pas un croquis.
- La carte dans l'interface : au repos et au moment du paiement. Ces deux pages sont des captures de l'appli qui tourne, pas des maquettes.
- Déclinaisons : bandeau web, visuel réseaux sociaux, gabarit d'affiche A3.
- Page « interdits » : au moins 3 tirés de notre propre interface.

### 2. L'interface s'aligne

- Palette dans le code, en variables nommées, dans un fichier unique. Changer une valeur là doit faire bouger toute l'interface.
- Logotype dans les 3 espaces (salarié, partenaire, admin) et sur la favicon.
- Le nom bascule partout : titres d'onglet, écran de connexion, pied de page, mails, pages d'erreur, jeux de données de démo, exports, README. Refaire le grep, dans l'autre sens.

### 3. La vidéo

Les prises où « CartePro » apparaît sont à refaire, ou reprendre le parcours entier une fois l'interface basculée.

### Priorités données par Sellami

- L'interface passe avant le PDF.
- Sacrifier les déclinaisons avant le logotype.
- Envoyer par écrit, avec le livrable, ce qui a été laissé de côté et pourquoi. Une page manquante et assumée se défend en réunion ; une page bâclée, non.

---

## Ce qui concerne le front-end

Tout, cette fois. Résumé de l'impact :

| Chantier | Détail |
|---|---|
| Renommage | `CartePro` vers `Ticket Tout` sur une dizaine de fichiers de `front/` (métadonnées, rail salarié, données de démo, README, `.env`, pages d'erreur). Grep de contrôle à refaire. |
| Palette | `src/styles/tokens.css` est déjà le « fichier unique de variables ». À enrichir : 2 accents dérivés du `#1B3A6B`, remplacer le vert d'action jugé trop administratif. |
| Logotype | À créer (aucun composant `Logo` dans le squelette aujourd'hui). Versions principale / monochrome / favicon. À poser dans le rail salarié et les futurs espaces partenaire et admin. |
| Favicon | Absente. À ajouter (`app/icon` ou `app/favicon.ico`). |
| Carte désirable | Aujourd'hui `CarteSolde` = rectangle bleu. À redessiner, états repos et paiement (ce sont les 2 captures demandées dans le book). |
| Contrastes | Vérifier chaque couple texte/fond réellement utilisé, noter l'outil, signaler tout ratio inférieur à 4,5:1. |
| Vidéo | Prises à refaire après bascule. |

La charte ministérielle reste applicable au reste de l'interface. Ticket Tout est une marque produit qui vit **à l'intérieur** de la charte : `#1B3A6B` reste la couleur primaire.

---

# Journal de bord, Jour 3

## Ce qu'on a fait aujourd'hui

### Décision d'architecture : on adopte le squelette `front-employee`

En attaquant la branche `employee`, on a découvert qu'elle contenait une **architecture front complète et différente** de celle des branches `front-info-page` / `front-login-register` : dossier `front/src/`, groupes de routes par rôle (`(salarie)`, `(partenaire)`, `(administration)`, `(auth)`, `(public)`), couche services et mocks, CSS pur avec `tokens.css`, noms français, couleur d'action verte. Environ 200 fichiers, la plupart des stubs vides, montés par un·e coéquipier·e.

Les deux architectures sont incompatibles. **On a tranché : on adopte le squelette `front-employee`.** Il est plus complet (les 3 espaces, les livrables juridiques dans `docs/`, un `ARCHITECTURE.md` avec des règles strictes), et son `tokens.css` répond déjà à la demande « palette dans un fichier unique ». Le travail des branches `front-info-page` et `front-login-register` sera reporté dans `(public)/accueil` et `(auth)/*` plus tard.

### Espace salarié construit (sur `front/`)

- **Remise en état de l'infra** : `front/package.json` pointait des versions non installables (`typescript@^7`), corrigé (Next 16.3.3, React 19.2.8, TS 5). Polices Marianne et Spectral auto-hébergées dans `public/fonts/`. `.env.local` créé (mode mocks).
- **Couche données** : fixtures (catégories, partenaires, salarié, une dizaine de transactions dont une contre-écriture), `magasin.ts` en mémoire (solde calculé, génération de code avec TTL borné à 300 s), adaptateurs mock, `services/index.ts` (bascule mocks / API), hooks `useSolde` / `useCodePaiement` / `usePagination`, utils `montant` / `date`.
- **Primitives UI** (CSS Modules, jetons uniquement) : `Bouton`, `Carte`, `Pastille`, `EtatVide`, `EtatErreur`, `Chargement`, `Icone` (SVG maison, pas de librairie).
- **Simulation** : `Montant` (seul point d'affichage d'une valeur monétaire), `MentionSimulation`, `BandeauSimulation`.
- **Écrans** :
  - `/salarie` : carte solde (formulation positive et mention de simulation), actions rapides, dernières opérations, « Coup de cœur du Ministre ».
  - `/salarie/paiement` : génération du code, représentation matricielle, jeton et copie, minuteur de validité, régénération, état expiré, écran « paiement accepté ».
  - `/salarie/historique` : filtre par mois, liste paginée, pastilles Validée / Annulée / Correction.
  - `/salarie/partenaires` : recherche + filtre catégories (piloté par les données) + liste.
  - `/salarie/demandes` : version légère (état vide + formulaire simulé).
  - `RailSalarie` et layout : navigation latérale, lien d'évitement, `<main>`.
- **Vérifications** : `tsc --noEmit` 0 erreur, `eslint` 0 erreur (2 warnings dans des stubs de l'équipe), `next build` OK, captures headless des 4 écrans.

## Décisions

- Squelette `front-employee` retenu comme architecture front unique.
- Espaces partenaire et admin : encore en stubs, à construire ensuite.
- Le code de paiement affiché est une représentation (un vrai code signé relève du backend). C'est indiqué à l'écran.
- Pas de vraie carte scannable ni d'API cartographique (souveraineté).

## À compléter pour la suite (mail Sellami, échéance demain 12h)

- [ ] Basculer `CartePro` vers `Ticket Tout` partout, avec grep de contrôle.
- [ ] `tokens.css` : 2 accents dérivés de `#1B3A6B`, remplacer le vert d'action, produire la table de contrastes.
- [ ] Logotype Ticket Tout (principale / monochrome / favicon) posé dans les 3 espaces.
- [ ] Favicon.
- [ ] Redessiner la carte (repos et paiement) pour qu'elle donne envie.
- [ ] Brand book PDF (10 pages minimum), avec captures réelles.
- [ ] Reprendre les prises vidéo où « CartePro » apparaît.
- [ ] Écrire noir sur blanc ce qui est laissé de côté et pourquoi.
