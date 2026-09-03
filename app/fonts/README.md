# Polices

Chargées en local (`next/font/local`) pour que l'app tourne 100 % hors-ligne
(contrainte de souveraineté, mail Vignal).

## Marianne - titres (charte graphique ministérielle, mail Sellami)

- `Marianne-Regular.woff2` (400)
- `Marianne-Medium.woff2` (500)
- `Marianne-Bold.woff2` (700)

Récupérées depuis la distribution du Système de Design de l'État
(`@gouvfr/dsfr`). Marianne est la police officielle de l'État français,
d'usage libre. Poids max disponible : 700 (pas d'ExtraBold).

## Spectral - corps de texte

Chargée via `next/font/google` dans `app/layout.tsx` : `next/font` télécharge
et self-héberge le fichier au build, donc aucune requête réseau à l'exécution.
