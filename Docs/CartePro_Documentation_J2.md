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

### 5. Accessibilité RGAA niveau AA (mail Pontaillac)

- **RGAA AA s'applique** à tout le démonstrateur.
- Une **déclaration d'accessibilité** doit accompagner la livraison.
- Conséquences dev front : contrastes suffisants (attention à la couleur des boutons, `#1B3A6B` interdit en fond de bouton de toute façon), navigation clavier complète, focus visible, labels sur tous les champs de formulaire, textes alternatifs, hiérarchie sémantique des titres, attributs ARIA sur les composants custom (QR code, modales, tableaux de bord, tableaux de données).

### 6. Écrans liés aux règles juridiques et métier

- **Inscription partenaire** : champs **SIREN** et **objet social** obligatoires à la saisie, contrôlés au moins dans leur forme (SIREN = 9 chiffres).
- **Écran admin de validation partenaire** : **motif écrit obligatoire** pour toute décision (acceptation comme refus) ; afficher la trace horodatée + l'identifiant de l'agent.
- **Vue « partenaire refusé »** : définir ce que voit un partenaire dont la demande est refusée (statut + motif).
- **Inscription salarié** : ne demander que le strict nécessaire (minimisation RGPD).
- Cohérence UI ↔ CGU sur 3 comportements à afficher clairement :
  - que se passe-t-il quand le **solde est insuffisant**
  - que devient un **solde non consommé en fin de période**
  - **qui peut annuler** une transaction validée et selon quelle procédure

### 7. Contraintes techniques front (mail Vignal)

- **Pas d'API cartographique tierce** (Google Maps, Mapbox…). La « recherche et localisation des partenaires » doit se faire sans service tiers propriétaire → carte auto-hébergée (type Leaflet + tuiles libres) ou simple liste filtrable par ville. **À trancher.**
- Pas d'authentification tierce, pas de service d'envoi de mail commercial.
- L'application doit tourner **intégralement en local** → héberger **Marianne et Spectral en local** (pas de CDN Google Fonts si on veut du 100 % hors-ligne, à vérifier).
- **Écran QR code employé** : durée de vie **5 min max**, compte à rebours visible, régénération, état « expiré ».
- **Feedback idempotence côté partenaire** : un 2ᵉ scan du même QR affiche la transaction déjà passée (même identifiant), pas une erreur ni un double débit.
- **Message d'erreur explicite** quand un débit dépasse le solde (dire pourquoi).

### 8. Vidéo de présentation (mail Sellami) — livrable front

- Moins de **2 min**, **1080p**, **sous-titres incrustés**.
- **Capture de la vraie application qui tourne** — pas de maquette, pas de prototype cliquable filmé. Une capture d'écran commentée suffit.
- Parcours à montrer : un salarié ouvre son espace → voit son solde → choisit un partenaire près de chez lui → paie en 3 secondes.
- À joindre : le **script avec minutages**, la **phrase-titre unique**, et si on dépasse 2 min, quel moment du parcours on coupe et pourquoi.

---

## Échéances

- **Vendredi 12h00** : identité visuelle appliquée, nom `CartePro` partout (résultat du grep), captures de la mention de simulation, vidéo + script. (Côté juridique, mêmes échéances : fiche de registre RGPD, déclaration d'accessibilité, projet de CGU.)
- **Vendredi 17h00** : livrables archi/back (schéma BDD, spec OpenAPI, tests d'intégrité). Pas du front, mais à synchroniser avec l'autre équipe.

---
