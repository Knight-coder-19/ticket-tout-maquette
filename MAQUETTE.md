# Maquette Ticket Tout (GitHub Pages)

Branche `maquette-statique` = la branche `front` + ce qu'il faut pour publier un
**export statique** du front sur GitHub Pages. Aucun backend, aucune valeur
réelle, aucun appel réseau à l'exécution.

En ligne : <https://knight-coder-19.github.io/ticket-tout-maquette/>

## Le problème, et la solution retenue

Le `front` sert ses données simulées via **44 route handlers Next** sous
`src/app/api/` (`env.baseApi = "/api"`). Un export statique (`output: "export"`)
n'a pas de serveur : ces routes ne répondraient plus.

Ces handlers sont pourtant **purs** — une `Request` entre, une `Response` sort,
tout l'état vit en mémoire dans `src/mocks/`. Alors on les rejoue **dans le
navigateur** :

| Fichier | Rôle |
|---|---|
| `src/mocks/api/**` | les mêmes handlers, déplacés hors de `src/app/` pour que Next ne les traite plus comme des routes |
| `src/mocks/serveur-local.routes.ts` | table générée : motif d'URL → handler (`scripts/generer-routes-maquette.mjs`) |
| `src/mocks/serveur-local.ts` | routeur : reçoit `('/api/v1/…', options)`, fabrique une `Request`, appelle le handler, rend sa `Response` |
| `src/lib/api/client.ts` | quand `env.modeMaquette`, `joindre()` passe par `repondreLocalement` au lieu de `fetch` |
| `src/lib/config/env.ts` | `modeMaquette = NEXT_PUBLIC_MAQUETTE === "true"` |

Résultat : comportement identique à `next dev`, **y compris les `POST`** du flux
de paiement (émission d'un code, annulation, régénération).

Le reste :

| Fichier | Rôle |
|---|---|
| `front/next.config.mjs` | `output: "export"`, `trailingSlash`, `basePath` piloté par `NEXT_PUBLIC_BASE_PATH` |
| `front/.env.production` | valeurs de build (`NEXT_PUBLIC_MAQUETTE=true`, mocks, base path) |
| `front/src/styles/globals.css` | URLs de police préfixées du base path (le CSS global n'est pas réécrit par Next) |
| `.../[id]/page.tsx` (×3) | `generateStaticParams` + `dynamicParams = false` |
| `.github/workflows/maquette.yml` | build + déploiement Pages sur push `maquette-statique` |

## Régénérer la table des routes

Après tout ajout / suppression d'un handler sous `src/mocks/api/` :

```bash
node scripts/generer-routes-maquette.mjs front
```

## Publier

### Option A — GitHub Actions

1. `git push pub maquette-statique`
2. Repo `ticket-tout-maquette` → **Settings → Pages → Source : GitHub Actions**

### Option B — branche `gh-pages` (déploiement immédiat)

```bash
cd front
NEXT_PUBLIC_BASE_PATH=/ticket-tout-maquette npm run build
# publier le contenu de front/out/ à la racine de la branche gh-pages
```

## Lancer en local

```bash
cd front && npm install
NEXT_PUBLIC_BASE_PATH= npm run build
npx serve out      # http://localhost:3000
```
