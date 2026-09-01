# CartePro - Frontend

Interface du dispositif CartePro, Ministere du Job et Bonheur.
Demonstrateur : simulation fonctionnelle, aucune valeur reelle ne circule.

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
| `npm test` | Tests unitaires |

## Documentation

Architecture et regles de contribution : `docs/ARCHITECTURE.md`.
