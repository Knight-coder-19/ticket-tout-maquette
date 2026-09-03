# Architecture frontend Ticket Tout

## Regles structurantes

**1. Aucun composant n'appelle le reseau.**
Un composant appelle un service, le service appelle le client API, le client
API appelle le reseau. Consequence pratique : brancher le backend, changer
d'URL ou ajouter un entete d'authentification se fait a un seul endroit.

**2. Les mocks ont la meme forme que l'API reelle.**
Le basculement se fait par `NEXT_PUBLIC_USE_MOCKS`. L'equipe front avance
sans attendre le backend, sans construire une architecture jetable.

**3. Un montant ne s'affiche que par le composant `Montant`.**
C'est ce qui garantit que la mention de simulation ne peut pas etre oubliee
sur un ecran. Une valeur monetaire affichee autrement doit etre refusee en
revue de code.

**4. Les categories viennent des donnees.**
Aucun nom de categorie n'est ecrit dans un composant. Ajouter ou retirer une
categorie ne touche aucun fichier d'interface.

**5. Aucune couleur en dur.**
Tout passe par les jetons de `src/styles/tokens.css`.

**6. Aucun service tiers.**
Pas de CDN de polices, pas d'API cartographique, pas d'authentification
externe. L'application doit demarrer sur une machine hors ligne apres
`npm install`.

## Arborescence

```
src/
  app/              routes, un groupe par role
  components/       presentation uniquement, aucune logique metier
    ui/             primitives reutilisables
    layout/         en-tete, pied de page, navigation
    simulation/     mention obligatoire et affichage des montants
  lib/
    api/            client HTTP et chemins des routes
    services/       contrats metier, une interface par domaine
    hooks/          logique d'etat reutilisable
    utils/          formatage
    config/         environnement et constantes
  types/            types du domaine et contrats d'echange
  mocks/            donnees et implementations simulees
  styles/           jetons et styles globaux
```

## Ce qui depend du backend

| Element | Attendu de l'equipe backend |
|---|---|
| Contrat OpenAPI | Liste des routes et forme des reponses |
| Code de paiement | Signature serveur, TTL applique cote backend |
| Idempotence | Entete de cle d'idempotence accepte sur l'encaissement |
| Solde | Calcul cote serveur, jamais reconstruit dans le front |
| Contre-ecriture | Endpoint d'annulation, le front n'edite jamais une transaction |
| Decision partenaire | Enregistrement du motif et de l'horodatage |

## Etats a couvrir sur chaque ecran

Chargement, donnees absentes, erreur reseau, solde insuffisant, code expire,
categorie vide, session expiree. Un ecran qui ne traite que le cas nominal
n'est pas termine.
