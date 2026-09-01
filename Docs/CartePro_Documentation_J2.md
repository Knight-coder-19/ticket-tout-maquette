# CartePro — Documentation Jour 2

## Contexte : 3 mails reçus du cabinet ministériel

Aujourd'hui on a reçu 3 mails qui précisent et complètent le cahier des charges. Chacun vient d'un des 3 interlocuteurs du cabinet :

- **Benjamin Sellami** (conseiller com) — identité visuelle, nom de marque, vidéo de présentation, affichage du catalogue partenaires.
- **Florine Pontaillac** (conseillère juridique) — mention de simulation, RGPD, référencement des partenaires, accessibilité RGAA, CGU.
- **Thomas Vignal** (conseiller numérique) — livrables d'architecture, doctrine de souveraineté (pas de cloud/service tiers), intégrité transactionnelle.

**Point de vigilance sécurité :** ces mails viennent d'expéditeurs externes, avec des bandeaux d'avertissement automatiques, et le cahier des charges annoté contenait un lien « quarantine » douteux. On ne clique sur aucune pièce jointe non vérifiée et on ne communique aucune info bancaire par mail.

Le mail de Thomas est surtout back-end. Les deux autres ont un impact front-end fort. Voici le tri.

---

## Ce qui concerne le front-end

### 1. Identité visuelle (mail Sellami)

La charte graphique ministérielle est **obligatoire**. Le doc complet (47 pages) doit arriver dans la journée via le secrétariat, mais l'essentiel :

- **Bleu institutionnel `#1B3A6B`** en couleur primaire — **jamais en fond de bouton**. Il faut donc définir une autre couleur pour les boutons d'action.
- Typo : **Marianne** pour les titres, **Spectral** pour le corps de texte.
- Bloc-marque en **haut à gauche**, zone de protection respectée, **jamais posé sur une photo**.

### 2. Nom affiché = « CartePro », partout (mail Sellami)

Le nom `CartePro` doit apparaître dans **toute l'interface**, pas seulement la page d'accueil :

- titre des onglets du navigateur
- écran de connexion
- pied de page
- mails envoyés par l'application
- pages d'erreur
- libellés des 3 espaces
- jeux de données de démonstration
- titre du dépôt + README

À faire : un `grep -ri` sur le dépôt pour vérifier qu'aucun nom de code interne ne traîne.

### 3. Catalogue et catégories de partenaires (mail Sellami)

- Afficher des **catégories neutres** (restauration, culture, loisirs), **pas les enseignes en dur** dans les gabarits.
- Les catégories vivent **dans les données**, pas dans les templates : on ajoute / renomme / retire une catégorie sans toucher une ligne d'interface.
- L'écran de recherche et le catalogue s'adaptent automatiquement à la liste des catégories.
- Une **catégorie vide s'affiche proprement** (état vide géré) au lieu de casser la mise en page.
- À faire **maintenant** (J+1) : « une heure aujourd'hui vs un après-midi la semaine prochaine ».

### 4. Mention « simulation » partout où un montant s'affiche (mail Pontaillac)

Mention de simulation **visible et non dissimulée** (un astérisque discret en pied de page ne suffit pas), sur **chaque** écran où une valeur monétaire apparaît :

- écran de solde
- historique des transactions
- écran de génération du QR code
- écran de validation côté partenaire
- tableau de bord financier du partenaire
- tableau de bord national (admin)
- messages d'erreur qui citent un montant
- titre des pages concernées
- tout document ou export produit par l'application

Prévoir un **composant réutilisable** et fournir **une capture par emplacement**, prise sur l'application qui tourne.
