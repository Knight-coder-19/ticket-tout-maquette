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

---

## Décision — La sérialisation canonique du hachage des écritures

### Contexte

`ledger/hash.rs` calcule le condensat de chaque écriture, et chaque écriture porte le condensat
de la précédente. C'est ce chaînage qui rend une falsification détectable : réécrire une ligne
passée oblige à recalculer tous les condensats suivants, ce que les déclencheurs d'immuabilité
et les privilèges interdisent.

La conséquence est brutale et mérite d'être écrite noir sur blanc : **le jour où je change la
façon dont les champs sont concaténés avant le hachage, toute la chaîne déjà écrite devient
invérifiable.** `verify_chain` signalerait la toute première écriture comme incohérente, et je
n'aurais aucun moyen de distinguer ce changement de format d'une véritable falsification. Ce
format n'est donc pas un détail d'implémentation, c'est une donnée du schéma au même titre
qu'un type de colonne.

### Le format retenu

SHA-256 sur la concaténation, sans séparateur ni encodage textuel, des champs suivants dans
cet ordre exact :

| Rang | Champ | Taille | Encodage |
|---|---|---|---|
| 1 | étiquette de domaine | 18 octets | `CARTEPRO/LEDGER/V1` en ASCII |
| 2 | `seq` | 8 octets | entier signé, gros-boutien |
| 3 | `operation_id` | 16 octets | les octets bruts de l'UUID |
| 4 | `account_id` | 16 octets | les octets bruts de l'UUID |
| 5 | `direction` | 1 octet | `0x00` pour un débit, `0x01` pour un crédit |
| 6 | `amount` | 8 octets | centimes d'euro, entier signé, gros-boutien |
| 7 | `recorded_at` | 8 octets | microsecondes depuis l'époque Unix, gros-boutien |
| 8 | `prev_hash` | 32 octets | le condensat de l'écriture précédente, ou `GENESIS_HASH` |

Tous les champs sont de longueur fixe. C'est la propriété qui rend la concaténation non
ambiguë : sans elle, deux jeux de valeurs différents pourraient produire la même suite d'octets,
et le condensat cesserait de dire quoi que ce soit de la ligne.

### Les trois points qui m'ont demandé un choix

**L'étiquette de domaine.** Elle ne protège de rien aujourd'hui, elle prépare demain : si un
autre condensat SHA-256 apparaît dans le projet — l'empreinte d'un fichier d'import, un jeton
de session — l'étiquette garantit qu'aucune valeur hachée dans un contexte ne peut être
présentée comme valide dans l'autre. Elle porte un numéro de version, `V1`, pour que le jour
où le format doit vraiment changer, la rupture soit explicite plutôt que silencieuse.

**Les microsecondes, et pas les nanosecondes.** `DateTime<Utc>` en Rust porte la nanoseconde,
`TIMESTAMPTZ` en PostgreSQL s'arrête à la microseconde. Hacher la nanoseconde reviendrait à
hacher une valeur que la base tronque en la stockant : le condensat recalculé après relecture
ne retomberait jamais sur celui qui est enregistré, et `verify_chain` déclarerait toute la
chaîne rompue. Je hache donc la précision réellement stockée.

**`recorded_at` est écrit explicitement, jamais laissé au `DEFAULT now()`.** Même raison : la
valeur hachée et la valeur stockée doivent être la même. `post_operation` récupère le
`recorded_at` renvoyé par l'insertion de l'opération et le réutilise tel quel pour les deux
écritures, qui partagent ainsi un instant d'enregistrement unique.

### Ce qui en découle sur le `seq`

Le `seq` entre dans le condensat alors que la colonne est un `BIGSERIAL`. On ne peut donc pas
insérer d'abord et calculer le condensat ensuite : la mise à jour serait refusée par le
déclencheur d'immuabilité. `post_operation` réserve le rang par un `nextval` explicite avant
de hacher, puis insère la ligne avec ce rang. C'est ce que le `GRANT USAGE, SELECT ON SEQUENCE
ledger_entries_seq_seq` du schéma rendait déjà possible.

Une transaction annulée consomme quand même le rang réservé : la suite des `seq` peut donc
comporter des trous. Ce n'est pas un problème, parce que la continuité de la chaîne est portée
par les condensats et non par la contiguïté des rangs. `verify_chain` lit les écritures dans
l'ordre des `seq` et vérifie que chaque `prev_hash` est le condensat de la précédente ligne
lue, sans jamais supposer que les rangs se suivent.

---

## Écarts par rapport au plan de construction

`file-guide.md` et `TASK-DISTRIBUTION-BACKEND.md` ont été écrits avant la première ligne de code.
Sur vingt points, ce que j'ai écrit s'en écarte. Je les consigne ici parce qu'un écart non
justifié se lit comme une négligence, et parce que trois d'entre eux corrigent une erreur des
documents eux-mêmes — un relecteur qui suivrait le plan à la lettre réintroduirait le bug.

### 1. Dans `settle`, la libération de la réservation précède l'écriture

**Le plan** (`TASK-DISTRIBUTION-BACKEND.md` §4.1) fait passer l'opération du ledger, puis libère
la réservation :

```
post_operation(...)
release_hold(...)      // « le hold devient réel »
```

**Ce que j'ai fait** : l'inverse.

**Pourquoi** : la contrainte `held_within_settled` est vérifiée par PostgreSQL à *chaque
instruction*, pas à la fin de la transaction. Sur un compte à `settled = 100, held = 100` — le cas
d'un employé qui génère un jeton couvrant tout son solde — débiter avant de libérer donne
transitoirement `settled = 0, held = 100`, et la base refuse l'`UPDATE`. Dans l'ordre du plan,
tout encaissement portant sur la totalité du solde disponible échoue.

C'est l'écart le plus important de cette liste : il ne se voit pas sur un jeton de 10 € tiré sur
un solde de 100 €, seulement sur un jeton qui épuise le disponible.

### 2. `Account.balance_settled` est un `i64`, pas un `Money`

**Le plan** ne le dit pas explicitement, mais l'usage de `Money` partout ailleurs le suggère.

**Ce que j'ai fait** : les deux soldes de `Account` sont des entiers de centimes signés.

**Pourquoi** : `Money` refuse le négatif par construction, et `MINISTRY_ISSUANCE` est négatif par
construction lui aussi — c'est l'amendement A5 et l'invariant I3. Porter un solde système dans un
`Money` obligerait à fabriquer des valeurs qui violent l'invariant du type, c'est-à-dire à mentir
au compilateur pour se rassurer. Les montants d'opération, eux, sont bien des `Money` : le schéma
garantit qu'ils sont strictement positifs.

`Account::available_cents()` et `Account::can_cover(Money)` encapsulent la seule arithmétique de
solde exposée, pour que l'entier nu ne circule pas.

### 3. `recompute_balance` renvoie un `i64`

**Le plan** (`file-guide.md` §3.3) annonce `recompute_balance(conn, AccountId) -> Money`.

**Ce que j'ai fait** : `-> Result<i64, sqlx::Error>`.

**Pourquoi** : même raison qu'au point 2 — la fonction doit pouvoir rendre le solde du compte
d'émission, qui est négatif. `recompute_held`, en revanche, rend bien un `Money` : une somme de
jetons actifs est toujours positive.

### 4. `verify_chain` renvoie un statut, pas un `Result<(), seq>`

**Le plan** annonce `verify_chain(conn, from_seq) -> Result<(), u64>`, où l'erreur porte le
premier rang incohérent.

**Ce que j'ai fait** : `-> Result<ChainStatus, sqlx::Error>` avec
`ChainStatus::{Intact, BrokenAt(i64)}`.

**Pourquoi** : la signature du plan ne laisse pas de place à une panne de base. Or « la chaîne est
rompue au rang 412 » et « la connexion a été coupée » sont deux échecs de nature opposée : le
premier est une alerte de sécurité qui doit remonter jusqu'à un humain, le second une erreur
d'exploitation. Les confondre dans un même `Err` obligerait l'appelant à les distinguer par
inspection.

### 5. Les requêtes sont vérifiées à l'exécution, pas à la compilation

**Le plan** (`file-guide.md` §1) prévoit `.sqlx/` généré par `cargo sqlx prepare --workspace` et
commité, « sinon la CI ne compile pas sans base ».

**Ce que j'ai fait** : `sqlx::query_as` et `sqlx::query_scalar`, vérifiés à l'exécution. Le
dossier `.sqlx/` reste vide.

**Pourquoi** : les macros vérifiées à la compilation exigent une base joignable pendant le build,
ou un cache régénéré après *chaque* modification de requête. À deux développeurs travaillant en
parallèle, un cache oublié casse la compilation de l'autre sans message compréhensible. Le coût
réel est faible : les erreurs de typage SQL apparaissent au premier test d'intégration, et ces
tests tournent contre un vrai PostgreSQL.

**Conséquence assumée** : une faute de frappe dans un nom de colonne ne se voit pas à la
compilation. C'est ce qui rend les tests d'intégration non négociables.

### 6. `CoreError` gagne une variante `Internal`

**Le plan** liste les erreurs métier et leur correspondance HTTP dans `data-dictionary.md` §6.

**Ce que j'ai fait** : ajout de `CoreError::Internal`.

**Pourquoi** : `LedgerError` distingue deux familles. `InsufficientFunds` et `AccountInactive`
sont des situations métier, que l'utilisateur doit comprendre. `SelfTransfer`,
`NonPositiveAmount`, `CorruptedHash` et `AccountNotFound` sont des erreurs de programmation : si
elles surviennent, l'appelant est fautif et aucun message ne doit fuiter vers le client. Sans
variante dédiée, elles auraient dû être rangées sous `Db(_)`, ce qui aurait brouillé la seule
règle claire de cette table — `Db(_)` devient 500 et ne dit rien.

### 7. Le payload signé porte des entiers, pas des types du domaine

**Le plan** (`file-guide.md` §3.2) donne `TokenPayload { jti, amt, exp, iss }` sans préciser les
types.

**Ce que j'ai fait** : `amt: i64` en centimes, `exp: i64` en secondes Unix.

**Pourquoi** : `Money` possède une implémentation `Serialize` manuelle qui rend un flottant en
euros décimaux, parce que c'est ce que le front attend. Un flottant n'a pas de forme textuelle
garantie stable entre deux versions de `serde_json` : un jeton signé aujourd'hui pourrait cesser
de se vérifier demain. Même raisonnement pour la date, dont la sérialisation textuelle admet
plusieurs formes équivalentes.

`TokenPayload::new` est le seul point de conversion, et `amount()` repasse par `Money::try_new` au
retour — une signature valide prouve que le jeton vient de nous, pas que sa valeur est saine.

### 8. `short_code` expose quatre fonctions au lieu d'une

**Le plan** ne demande que `generate_short_code(&mut impl Rng) -> String` et mentionne le format
d'affichage `XXXX-XXXX`.

**Ce que j'ai fait** : `generate`, `format_for_display`, `normalize` et `is_valid`.

**Pourquoi** : un code court existe sous trois formes — celle qui est stockée (`86RB57CT`), celle
qui est affichée (`86RB-57CT`) et celle que le commerçant tape (`86rb 57ct`, avec ou sans tiret).
Sans `normalize`, la recherche part sur la chaîne brute, aucune ligne ne correspond, et un
paiement parfaitement valide est refusé comme jeton inconnu. C'est le bug qui coûte une
démonstration.

`is_valid` écarte les saisies absurdes avant de toucher à la base, pour que deviner des codes ne
revienne pas à faire tourner PostgreSQL gratuitement. Elle valide la forme *stockée* : l'ordre
d'appel est `normalize`, puis `is_valid`, puis la recherche.

### 9. Le code court est tiré après vérification, pas réessayé après échec

**Ce que j'avais annoncé** : une boucle de réessai sur violation d'unicité (`SQLSTATE 23505`),
« cinq lignes ».

**Ce que j'ai fait** : jusqu'à cinq tirages, chacun précédé d'un `SELECT` de disponibilité.

**Pourquoi j'ai changé d'avis** : c'était faux. Une violation de contrainte avorte la transaction
PostgreSQL entière — toute instruction suivante échoue jusqu'au `ROLLBACK`. Un réessai aurait
exigé un `SAVEPOINT` autour de chaque insertion, soit une mécanique disproportionnée sur le
chemin chaud pour une collision dont la probabilité est de l'ordre de 10⁻⁸ à 31⁸ combinaisons.

La course résiduelle — deux `authorize` simultanés tirant le même code entre le `SELECT` et
l'`INSERT` — reste rattrapée par l'index unique, et se manifeste alors comme une erreur 500. À
cette probabilité-là, c'est un compromis que j'assume.

### 10. La recherche par code court ignore le statut du jeton

**Ce que j'ai fait** : `WHERE short_code = $1 ORDER BY issued_at DESC LIMIT 1`, sans filtre sur le
statut.

**Pourquoi** : l'index d'unicité `uq_active_short_code` ne couvre que les jetons actifs. Filtrer
sur `status = 'active'` aurait donc cassé l'idempotence : un commerçant qui rejoue un
encaissement par code court après consommation n'aurait rien trouvé et aurait reçu `UnknownToken`
au lieu de son paiement. Or c'est exactement ce que fait une file d'attente hors ligne.

### 11. `settle` relit le paiement quand le jeton est déjà consommé

**Le plan** (§4.1) place le contrôle d'idempotence en tête, avant les verrous, et refuse ensuite
tout jeton dont le statut n'est pas `active`.

**Ce que j'ai fait** : quand le jeton est trouvé en `consumed` *après* les verrous, `settle`
relit le paiement associé et le renvoie s'il appartient au commerçant qui demande.

**Pourquoi** : le contrôle en tête s'exécute avant `lock_chain`. Deux requêtes simultanées du même
commerçant peuvent donc le franchir toutes les deux, se sérialiser ensuite sur le verrou, et la
seconde recevoir `TokenAlreadyUsed` alors qu'elle vient d'être réglée. Pour une file d'attente qui
rejoue jusqu'au succès, c'est une boucle infinie.

**Limite connue** : cette branche n'est atteignable que sous une vraie course. Je peux tester
celle qui refuse, pas celle qui rend le paiement ; un test de concurrence réelle relève de
`payments_flow.rs`.

### 12. `payments` expose `cancel` et `expire_stale_tokens` prend une limite

**Le plan** ne prévoit `cancel_token` qu'au niveau des requêtes, et annonce
`expire_stale_tokens(pool, clock) -> Result<u64>`.

**Ce que j'ai fait** : une fonction métier `cancel(tx, clock, account_id, jti)` qui vérifie que le
jeton appartient bien au compte avant de l'annuler et de libérer la réservation, et
`expire_stale_tokens(pool, clock, limit)`.

**Pourquoi** : `DELETE /me/payment-tokens/{jti}` a besoin d'un point d'entrée qui fasse les deux
choses ensemble ; les laisser au handler reviendrait à mettre une règle métier dans la couche
HTTP. Le paramètre `limit` évite qu'un balayage sur une base ancienne ne charge cent mille lignes
d'un coup — et l'annulation d'un jeton déjà annulé rend `Ok(())`, pour la même raison
d'idempotence qu'au point 11.

### 13. Les erreurs de paiement sont plus fines que la liste du plan

**Ce que j'ai ajouté** : `TokenCancelled`, `PartnerNotApproved` et `ShortCodeUnavailable`.

**Pourquoi** : les deux premières sont des situations que le commerçant doit distinguer d'un jeton
déjà encaissé — un jeton annulé par l'employé et un compte de commerçant non validé n'appellent
pas la même réaction au comptoir. `ShortCodeUnavailable` signale l'épuisement des cinq tirages du
point 9 ; elle ne devrait jamais survenir, et c'est précisément pour ça qu'elle doit être
nommée plutôt que noyée dans un 500.

### 14. Les tests I6 et I7 vérifient une propriété de données, pas un comportement

**Le plan** décrit I6 comme « deux `settle` → un seul paiement » et I7 comme un encaissement
refusé après expiration.

**Ce que j'ai fait** : au moment d'écrire `invariants.rs`, `settle` n'existait pas. Les deux tests
vérifient donc les propriétés au niveau de la base — l'unicité de `payments.token_jti`, la
cohérence entre le statut d'un jeton et l'existence de son paiement, et la requête qui détecte un
règlement postérieur à l'expiration.

**Ce qu'il reste à faire** : maintenant que `settle` existe, les versions comportementales
appartiennent à `payments_flow.rs` et `degraded_mode.rs`. Les tests d'invariants restent utiles
tels quels : ils vérifient l'état de la base, indépendamment du chemin de code qui l'a produit.

### 15. Le bouchon d'`approved_account` n'a pas été posé

**Le plan** (§3) prévoit que je bouchonne `partners::repo::approved_account` avec un compte en dur
dès la première heure, pour ne pas être bloqué sur `settle`.

**Ce que j'ai fait** : rien de tel. `settle` appelle la fonction telle que le contrat la définit,
et `payments` reste du code mort tant que Giscard ne l'a pas écrite.

**Pourquoi** : le bouchon aurait vécu dans un fichier qui ne m'appartient pas. La règle de
coexistence prime, et Giscard tient ses fichiers. Pour vérifier mon propre travail, je pose la
fonction et les deux `pub mod` manquants localement, je fais tourner les tests, puis je les
retire — rien n'entre dans son périmètre.

**Ce qu'il doit fournir**, exactement :

```rust
// crates/core/src/lib.rs
pub mod partners;
pub mod payments;

// crates/core/src/partners/repo.rs
pub async fn approved_account(tx: &mut PgTransaction<'_>, id: PartnerId)
    -> Result<AccountId, PartnerError>;
```

Le filtre `status = 'approved'` doit vivre dans sa requête, pas chez l'appelant : c'est elle qui
porte la règle « un commerçant non validé ne reçoit pas d'argent public ».

### 21. `BatchSettleResult.jti` est nullable

**Le contrat publié** (`data-dictionary.md` §4.5) donne `jti: string` dans chaque résultat du lot de
resynchronisation.

**Ce que j'ai fait** : `Option<Jti>`, donc `string | null` côté front.

**Pourquoi** : une ligne du lot peut être saisie par code court. Si ce code est inconnu — le
commerçant s'est trompé de chiffre au comptoir, la veille, hors ligne — il n'existe aucun `jti` à
renvoyer, et le contrat exige pourtant d'en écrire un. Les deux échappatoires étaient d'inventer un
UUID nul, qui se lit comme un identifiant valide, ou de retirer la ligne de la réponse, ce qui
décale la correspondance avec la file du commerçant.

Le front corrèle par le rang : `results[i]` répond à `items[i]`, et le lot conserve l'ordre reçu.
Le `jti` est un confort d'affichage, pas la clé de corrélation. Un `null` sur une ligne `failed`
dit exactement ce qui s'est passé : nous n'avons pas pu nommer ce jeton.

### 22. `PaymentResponse` ne se construit pas par `From<Payment>`

**La règle** (`file-guide.md` §4.4) demande un `impl From<DomainType> for ResponseDto` par DTO de
réponse.

**Ce que j'ai fait** : `PaymentResponse::settled(&Payment, Money)`.

**Pourquoi** : `Payment` ne porte pas le montant. Il porte `operation_id`, et le montant vit dans
`ledger_operations.amount` — c'est le journal qui fait autorité sur les sommes, pas la table des
paiements, et c'est voulu. Un `From<Payment>` seul ne peut donc pas remplir le champ `amount` du
contrat. Le rendre optionnel aurait fait porter au front une absence qui n'existe pas ; faire lire
la base au DTO aurait mis une requête dans une couche qui n'en fait jamais.

La deuxième valeur est fournie par l'appelant, qui l'a déjà sous la main : `settle` renvoie le
`Payment`, et le montant est celui du jeton qu'il vient de consommer.

### 23. `AuthorizeRequest` refuse le montant nul

**Ce que j'ai ajouté** : une validation de schéma sur `AuthorizeRequest`, qui rejette un `amount`
non strictement positif.

**Pourquoi** : `Money` refuse le négatif et les décimales surnuméraires dès la désérialisation, mais
il accepte zéro — c'est un montant légitime pour le type, `Money::zero()` existe. Un jeton de 0 €
n'a en revanche aucun sens, et sans ce contrôle il descendait jusqu'à `place_hold`, remontait en
`LedgerError::NonPositiveAmount`, que la conversion range dans `CoreError::Internal`, c'est-à-dire
un **500**. Une saisie utilisateur invalide serait sortie en erreur serveur.

Le refus appartient donc au bord : c'est un `422 VALIDATION_FAILED`, ce que le dictionnaire annonce
déjà pour un montant mal formé.

### 24. Le code court sort formaté et rentre brut

**Ce que j'ai fait** : `IssuedTokenResponse` applique `format_for_display` au code du domaine, donc
`86RB57CT` sort en `86RB-57CT`. Dans l'autre sens, `SettleRequest::token_ref` transmet la saisie du
commerçant **telle quelle** dans `TokenRef::ShortCode`, sans la normaliser.

**Pourquoi l'asymétrie** : l'affichage est une décision d'exposition, elle appartient au DTO. La
normalisation, elle, est une règle de résolution : `settle::resolve` appelle déjà `normalize` puis
`is_valid` avant de chercher en base, et c'est le seul endroit qui doit le faire. Normaliser aussi
dans le DTO créerait une seconde autorité sur la même règle — inoffensive tant que les deux
implémentations coïncident, et silencieusement fausse le jour où l'une des deux change.

Le DTO ne valide donc pas la forme du code court non plus. Il plafonne seulement sa longueur, pour
qu'une saisie absurde ne voyage pas jusqu'à la base. Un code mal formé ressort en `TOKEN_NOT_FOUND`,
comme un code inconnu, ce qui est la même chose du point de vue du comptoir.
