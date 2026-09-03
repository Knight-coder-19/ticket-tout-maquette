# Ticket Tout - Frontend

Interface du dispositif Ticket Tout, Ministere du Job et Bonheur.
Demonstrateur : simulation fonctionnelle, aucune valeur reelle ne circule.

Nom de marque : « Ticket Tout » (ex-nom de travail « CartePro »).

## Demarrage

```bash
cp .env.example .env.local
npm install
npm run dev
```

L'application demarre avec les donnees simulees, sans backend.
Basculer `NEXT_PUBLIC_USE_MOCKS=false` pour interroger l'API reelle.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de developpement |
| `npm run build` | Build de production |
| `npm run typecheck` | Verification des types |
| `npm run lint` | Analyse statique |

## Documentation

Architecture et regles de contribution : `docs/ARCHITECTURE.md`.
