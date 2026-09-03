# Ticket Tout — livraison du brand book (v1)

Pour B. Sellami. Échéance : jeudi 12h00.

Sellami a demandé plus que ce qui tient en une journée et a fixé les
priorités : **l'interface avant le PDF**, **sacrifier les déclinaisons avant le
logotype**, et **écrire ce qui est laissé de côté et pourquoi**. Voici l'état.

---

## 1. Interface (priorité haute) — fait

| Demande | État |
|---|---|
| Nom « Ticket Tout » partout (onglets, connexion, pied de page, mails, pages d'erreur, données de démo, exports, README) | ✅ basculé, `grep` de contrôle propre (une seule occurrence « CartePro » : note historique volontaire du README) |
| Palette en variables nommées, fichier unique, écrans qui l'utilisent | ✅ `src/styles/tokens.css` — changer une valeur fait bouger toute l'interface ; aucune couleur en dur (règle d'archi) |
| Deux accents qui « réveillent », dérivés du `#1B3A6B` | ✅ ambre `#F2A81C` (action) + corail `#E4572E` (décoratif / liens en version sombre) |
| Couleur d'action qui n'est plus le bleu ni « administrative » | ✅ le bouton d'action était vert `#0B6B4F`, il est passé à l'ambre (texte foncé, contraste 8,6:1) |
| Table de contrastes mesurée, outil cité, couple < 4,5:1 signalé | ✅ `node scripts/contrastes.mjs` (formule WCAG 2.1). Tous les couples utilisés passent AA. Le corail plein sur blanc (3,7:1) n'est **pas** utilisé pour du texte — signalé dans le book, pas maquillé |
| Logotype : version principale, monochrome, favicon | ✅ + version sur fond sombre. `src/components/marque/Logo.tsx` |
| Logotype dans les trois espaces + favicon | ✅ rail salarié, rails partenaire et admin, en-tête d'authentification, `app/icon.svg` |
| Carte « désirable », au repos et au paiement, captures réelles | ✅ concept « Le Ticket » ; `src/components/marque/CarteVisuelle.tsx` ; captures issues de **notre maquette** (front exporté en statique, publié sur GitHub Pages : https://knight-coder-19.github.io/ticket-tout-maquette/) |

## 2. Brand book (PDF) — fait

`docs/brand-book/brand-book.pdf`, 13 pages : couverture, la marque, logotype
(4 versions + règles), couleurs, contrastes, typographie, carte physique
(recto/verso, format ISO), carte dans l'interface (repos + paiement, captures
prises dans notre maquette), interdits (5, dont 3 tirés de notre propre
interface), périmètre.

Toutes les captures du book proviennent de la maquette : le front exporté en
statique et publié sur GitHub Pages,
<https://knight-coder-19.github.io/ticket-tout-maquette/>. Ce n'est pas un
montage graphique — c'est l'interface réelle, données simulées.

Recompilation : `cd docs/brand-book && make`.

## 3. Laissé de côté — et pourquoi

| Élément | Raison | Rattrapage |
|---|---|---|
| **Déclinaisons** : bandeau web, visuel réseaux sociaux, gabarit d'affiche A3 | Priorité explicite de Sellami : à sacrifier en dernier. Une journée n'y suffisait pas après l'interface + le book. | v1.1. La palette, la grille et le logotype du book suffisent à les produire ; il ne manque que les gabarits. |
| **Carte « en situation »** (main, portefeuille, terminal de paiement) | Des mockups photoréalistes demandent une banque d'images ou de la 3D, hors périmètre du jour. | Les rendus recto/verso (vectoriels, à l'échelle) tiennent lieu de référence. Photos à produire si le Ministre en a besoin pour la présentation. |
| **Écrans partenaire et admin** | Ces espaces sont encore des stubs. Le logotype y est posé (demande respectée) mais les écrans ne sont pas construits — hors périmètre du brand book. | Chantier front séparé. |
| **Vidéo** | Les premières prises disaient « CartePro ». | ✅ re-tournée sous « Ticket Tout » (voix off FR + sous-titres synchronisés), à partir des captures de la maquette. Traité à part. |

## 4. Point à trancher avec Sellami

La carte retient le concept **« Le Ticket »** (talon ambre + perforation, écho
du logotype). Deux autres pistes avaient été présentées : « Institutionnel
chaleureux » (plus sobre) et « Éditorial vibrant » (plus expressif, plus
risqué vis-à-vis de la charte). Si « Le Ticket » ne convient pas, le book se
met à jour en une passe.
