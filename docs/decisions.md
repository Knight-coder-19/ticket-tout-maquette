<!--
TODO: write the long form of the 12 framing decisions, then of amendments A1 to A4 — for each one the
context, the options weighed, the decision, and its consequences on the code. End with the two open
parameters (resync delay, closure grace) and the five open questions of CLAUDE.md section 3.1, which
must be settled before migration 0003 is written.
-->

---

## Amendement A5 — La devise devient l'euro, et la monnaie se représente en centimes entiers

### Contexte

Le projet a été conçu en franc, et le franc CFA n'a pas de subdivision en usage : un montant
était un entier, un point. Le passage à l'euro change cela, parce que l'euro a des centimes.
La question « comment représente-t-on une somme d'argent » redevient donc ouverte, et elle ne
peut pas être tranchée après coup : le montant est haché dans la chaîne d'audit du ledger et
stocké dans une colonne dont le type engage toutes les migrations suivantes.

Deux questions distinctes se cachent derrière celle-là, et je les ai séparées : ce que le type
Rust contient en mémoire, et ce qui circule sur le fil entre le front et l'API. Les confondre
est précisément ce qui pousse à choisir le flottant.

### Les options que j'ai pesées

**Le flottant, `Money(f64)`.** C'est la réponse spontanée quand on se dit « l'euro a des
décimales, il me faut donc des décimales ». Je l'ai écartée pour quatre raisons, dont la
première est rédhibitoire au sens strict :

1. `f64` n'implémente ni `Eq`, ni `Ord`, ni `Hash` en Rust. Ce n'est pas une convention de
   style, c'est le compilateur : les dérives de `Money` cesseraient de compiler, et je perdrais
   le tri total et la comparaison exacte.
2. `hash.rs` exige une sérialisation canonique du montant pour la chaîne d'audit. Un flottant a
   plusieurs représentations binaires pour une même valeur ; « canonique » n'y a pas de sens
   sans inventer des règles supplémentaires. Et le document prévient que toute modification
   ultérieure de cette sérialisation invalide la chaîne déjà écrite.
3. `recompute_balance` somme des milliers d'écritures et doit retomber exactement sur
   `balance_settled`, ce que les tests d'invariants P0 vérifient. En flottant l'addition n'est
   pas associative, et côté PostgreSQL l'ordre d'agrégation de `SUM()` n'est pas garanti : deux
   exécutions sur les mêmes lignes peuvent rendre deux valeurs. Un invariant qui tolère une
   marge n'est plus un invariant.
4. Une fraction de centime perdue par opération sur un système de paiement, ce n'est pas une
   imprécision d'affichage, c'est une caisse qui ne se réconcilie pas.

**Le décimal exact, `rust_decimal::Decimal` sur `NUMERIC(14,2)`.** Correct sur le fond, et
lisible en base. Je l'ai écarté pour un motif de coût, pas de justesse : une dépendance de plus,
une arithmétique plus lourde sur le chemin chaud du ledger, et surtout une renégociation du
schéma avec l'équipe alors que `BIGINT` répond déjà au besoin.

**L'entier en centimes, `Money(i64)`.** Retenu. Le type ne change pas, seule l'unité change :
`Money(45656)` vaut 456,56 €. L'arithmétique reste exacte et déterministe, le hachage reste
défini, la colonne reste `BIGINT`, et rien de ce qui avait été décidé pour le ledger n'est à
refaire.

### Ce que j'ai décidé

**En interne, la monnaie est un entier de centimes d'euro.** Le champ de `Money` est privé :
personne en dehors de `core/src/money.rs` ne peut lire ou écrire l'entier sous-jacent. La
représentation est un détail d'implémentation, au même titre que la façon dont `String` range
ses octets.

**Sur le fil, les montants circulent en euros décimaux.** Le front envoie et reçoit `456.56`,
`3.99`, `25`. C'est le format dans lequel les sommes sont saisies par les utilisateurs, et je
refuse de faire porter au front une conversion qu'il ferait en JavaScript, où le flottant est
le seul type numérique disponible et où le piège décrit plus bas est exactement le même.

Cela amende le contrat publié : le dictionnaire de données stipulait « entier, en unité
monétaire mineure, jamais de décimale ». J'assume le changement et j'en tire les conséquences
dans les documents, mais il doit être annoncé à l'équipe front de vive voix — un `2500`
résiduel écrit sous l'ancien contrat pour dire 25,00 € serait désormais lu 2500,00 €, et cette
erreur d'un facteur cent est silencieuse.

**La conversion n'existe qu'à un seul endroit.** Elle est faite par `Money` lui-même, dans sa
désérialisation, sa sérialisation et son `Display`. Aucune multiplication ou division par cent
ne doit apparaître ailleurs dans le backend : si un `100` surgit un jour dans `payments/`,
`funding/` ou `dto/`, c'est un défaut, pas une adaptation.

**J'ai aussi décidé que `checked_sub` refuse un résultat négatif.** L'entier signé le
permettrait, mais un `Money` négatif construit en contournant `try_new` violerait en silence la
garantie du type, et `checked_sub` est la primitive sur laquelle reposent la retenue de fonds et
le débit du ledger.

### La conséquence technique qui mérite d'être écrite

La façon spontanée de convertir un euro décimal en centimes, `(montant * 100.0) as i64`,
tronque. Ce n'est pas un cas d'école : je l'ai mesuré sur l'intervalle 0,01 € à 20 000 €, et
**131 252 montants sur 1 999 999, soit 6,6 %, perdent un centime**. `0.29 * 100.0` vaut
`28.999999999999996` et donne 28 centimes ; `2.01 * 100.0` donne 200.

Remplacer la troncature par un arrondi corrige ces cas mais en crée un pire : `3.999 * 100.0`
arrondi donne 400, et trois décimales sont acceptées en silence, 3,999 € devenant 4,00 €. Le
flottant a perdu l'information dont j'ai besoin pour valider.

La méthode retenue passe par le texte. `f64::to_string()` en Rust imprime la plus courte chaîne
décimale qui, relue, redonne le même flottant : pour le double le plus proche de 456,56, c'est
`"456.56"`. Le bruit binaire est éliminé une fois, au bord, et le découpage sur le séparateur
décimal donne ensuite des entiers exacts. Surtout, la chaîne conserve le nombre de décimales
réellement saisi, ce qui permet de **refuser** `3.999` au lieu de deviner ce que l'utilisateur
voulait.

### Conséquences sur le code et les documents

- `core/src/money.rs` : `Money` en centimes, champ privé, `Serialize`/`Deserialize` convertissant
  aux frontières, `parse_euros(&str)` pour l'import CSV, `InvalidMoneyError` distinguant le
  montant négatif, mal formé, trop précis ou hors limites.
- `funding/csv.rs` doit appeler `parse_euros` sur la colonne `montant` plutôt que de parser un
  nombre lui-même. C'est la frontière la plus exposée : elle est remplie à la main dans un
  tableur.
- `crates/api/src/extractors/` doit fournir un extracteur `Json` maison, sinon le rejet d'un
  montant invalide sort au format brut de serde et non dans l'enveloppe `{ error, message,
  request_id }`.
- `data-dictionary.md` §0, §1 et §4, `file-guide.md` §3.1 et §4.4, et
  `TASK-DISTRIBUTION-BACKEND.md` ont été amendés en conséquence.
- Le stockage reste `BIGINT`, et le champ `currency` des payloads vaut désormais toujours
  `"EUR"`.
