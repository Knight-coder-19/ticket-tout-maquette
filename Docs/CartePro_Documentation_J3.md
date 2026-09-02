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
