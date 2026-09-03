# Ticket Tout — maquette

Export **statique** du front du dispositif *Ticket Tout* (démonstrateur d'une
carte d'avantages salariés, Ministère du Job et Bonheur — projet d'école).

**Site en ligne :** https://knight-coder-19.github.io/ticket-tout-maquette/

- **Espace salarié** — fonctionnel, données simulées (mocks en mémoire) :
  solde à la seconde, code de paiement QR à usage unique (5 min), réseau de
  partenaires, historique des opérations, demandes.
- **Accueil** (`/`) — entrée vers les quatre espaces.
- **Partenaire / administration / connexion** — ébauches d'arborescence.

Aucune valeur réelle. Aucun appel réseau à l'exécution (polices auto-hébergées,
données simulées).

## Structure

| Branche | Contenu |
|---|---|
| `main` | le code (`front/`, Next.js 16, App Router) |
| `gh-pages` | l'export statique construit, servi par GitHub Pages |

## Construire

```bash
cd front
npm install
NEXT_PUBLIC_BASE_PATH=/ticket-tout-maquette npm run build   # -> front/out/
```

`NEXT_PUBLIC_BASE_PATH` = sous-chemin de publication. Vide pour servir à la
racine d'un domaine (`npx serve out`).

## Adaptations pour l'export

- `next.config.mjs` : `output: "export"`, `trailingSlash`, `basePath`.
- `.env.production` : mocks activés, base path.
- `src/app/(public)/accueil/*` et `PiedDePage.tsx` : vraie page d'accueil.
- polices déplacées dans `src/styles/fonts/` (URLs résolues par le bundler,
  indépendantes du base path).
- `[id]/page.tsx` (×3) : `generateStaticParams`.
