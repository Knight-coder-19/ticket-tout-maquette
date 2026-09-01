# CartePro — Documentation de compréhension du projet

## C'est quoi CartePro ?

Le Ministère du Job et Bonheur veut moderniser le système des avantages salariés dématérialisés (un peu comme les tickets restaurant, mais en version plus large). L'idée : les employeurs créditent leurs employés avec des fonds, et ces employés peuvent dépenser cet argent chez des partenaires référencés par le Ministère (commerces, prestataires, etc.).

Le but affiché derrière ça : améliorer le pouvoir d'achat, le bien-être au travail, et soutenir l'économie locale. C'est un projet porté par une Directrice/Direction du Numérique et de l'Innovation, avec 3 contacts côté cabinet ministériel (une conseillère juridique, un conseiller numérique, un conseiller com).

**Point important à garder en tête :** ce n'est PAS un vrai système de paiement au sens réglementaire. C'est une simulation fonctionnelle — aucune transaction financière réelle ne doit avoir lieu. Ça nous enlève une grosse pression côté légal/réglementaire (pas besoin d'agrément bancaire etc.), on peut se concentrer sur le fonctionnel et la démo.

## Les 3 espaces à construire

Le projet repose sur 3 profils utilisateurs différents, donc 3 espaces distincts :

**1. Espace Employé**
- Voir son solde disponible
- Voir l'historique de ses transactions
- Générer un QR code de paiement à présenter chez un partenaire
- Chercher/localiser les partenaires référencés

**2. Espace Partenaire** (le commerçant qui reçoit le paiement)
- Créer et gérer son compte (mais validé par un admin avant d'être actif)
- Scanner ou entrer manuellement les transactions reçues
- Un dashboard financier (montants reçus, transactions par période)
- Pouvoir parcourir le catalogue des autres partenaires

**3. Espace Admin (le Ministère)**
- Valider les demandes d'inscription des partenaires
- Gérer les comptes (activer, suspendre, fermer)
- Dashboard national (volume de transactions, partenaires actifs, répartition géographique)
- Gérer les recharges des employeurs (créditer les comptes employés)

## Les règles importantes à respecter

Il y a des exigences précises données par le client, à ne pas zapper :

- Le solde doit s'afficher **en temps réel** après chaque transaction
- Le QR code de paiement doit pouvoir fonctionner **en mode dégradé** (connexion limitée) — donc pas 100% dépendant du réseau
- L'inscription d'un partenaire passe **obligatoirement** par une validation manuelle de l'admin (pas d'auto-activation)
- Une transaction validée est **irréversible** — une fois passée, on ne peut plus revenir dessus

## Contraintes techniques côté archi

- Application web responsive, doit marcher sur mobile ET desktop
- Backend avec base de données relationnelle
- API REST documentée
- Authentification multi-rôles (employé / partenaire / admin) avec gestion de session

Côté sécurité des transactions :
- Une transaction validée doit être stockée de façon intègre, non modifiable
- Les QR codes doivent être à usage unique ou avoir une durée de vie limitée (max 5 minutes)
- Tout doit passer en HTTPS

Côté interopérabilité : l'API doit exposer un endpoint permettant à un système tiers de consulter le solde d'un employé, en JSON — pensé pour une future intégration avec les systèmes RH des employeurs (pas pour maintenant, mais l'endpoint doit exister).

Côté perf : générer un QR code doit prendre moins de 2 secondes, et le catalogue partenaires doit gérer la pagination (au cas où la liste devient longue).

## Le planning attendu

**Semaine 1 — Proof of concept (revue projet le vendredi)**
- Catalogue partenaires navigable (au moins 5 partenaires fictifs)
- Espace employé qui affiche solde + historique simulé
- Génération d'un QR code de paiement (peut être statique à ce stade)
- Présentation orale : démo fonctionnelle + archi technique

**Semaine 2 — Version finale (revue technique jeudi + keynote vendredi)**
- Les 3 espaces complets et fonctionnels
- Le parcours transaction complet, de bout en bout (génération QR → validation côté partenaire)
- Dashboard admin opérationnel
- Documentation technique (installation, API, schéma de base de données)
- Rétrospective du projet

---

# Journal de bord — Jour 1

## Ce qu'on a fait aujourd'hui

**Répartition de l'équipe**
On s'est réparti en 4, avec 2 équipes distinctes :
- Front-end : moi + Espoire
- Back-end : les 2 autres membres

**Choix technique front-end**
On a réfléchi à la techno à utiliser côté front et on a choisi **Next.js**.

**Travail sur la maquette**
Une fois la techno posée, on a commencé à réfléchir à quoi devait ressembler le front (structure, écrans, à quoi ça doit ressembler visuellement) et on a bossé sur la maquette.

## À compléter pour la suite
- Choix techno côté back-end (à demander à l'autre équipe)
- Détail des écrans maquettés aujourd'hui
- Points bloquants ou questions en suspens
- Répartition précise des tâches pour demain
