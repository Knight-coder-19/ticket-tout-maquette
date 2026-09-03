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

### 16. `topup` reçoit une horloge et une référence optionnelle

**Le plan** (§4.1) annonce `topup(tx, admin, employer_id, account_id, amount, reference)`.

**Ce que j'ai fait** : j'ai intercalé `clock: &dyn Clock` en deuxième position et typé la
référence `Option<&str>`.

**Pourquoi** : l'`occurred_at` de l'opération doit venir de l'horloge injectée, comme partout
ailleurs sur le chemin monétaire — sinon un test ne peut pas dater un rechargement, et la
démonstration de l'expiration à horloge fixe s'arrête au premier crédit. La référence est
nullable en base (`topups.reference`), le type Rust le dit.

### 17. L'idempotence du rechargement s'appuie sur le verrou de chaîne

**Le plan** décrit la référence comme « la clé d'idempotence naturelle », en priorité P3.

**Ce que j'ai fait** : `topup` prend `lock_chain` en première instruction, puis cherche un
rechargement existant pour le couple `(employer_id, reference)` et le renvoie tel quel s'il
existe.

**Pourquoi pas un index unique** : `uq_topup_reference` n'existe pas dans `0001_schema.sql`, et
la migration est déjà appliquée sur les postes de l'équipe. Ajouter une migration `0003` pour
une contrainte de priorité P3 revient à faire porter au schéma un risque de rejeu de migration
la veille du rendu.

**Ce qui rend le contrôle correct malgré tout** : le verrou consultatif 42 est pris par tout
chemin qui écrit dans le journal — `topup`, `settle`, et toute écriture future. Deux
rechargements simultanés portant la même référence ne peuvent donc pas s'exécuter en parallèle :
le second attend, puis lit la ligne écrite par le premier. La faille résiduelle est un `INSERT`
direct dans `topups` qui contournerait la fonction ; c'est le genre de chose que l'index unique
interdirait pour de bon, et c'est la raison de le poser un jour.

### 18. Le compte système est refusé au crédit

**Le plan** ne dit rien du cas.

**Ce que j'ai fait** : `topup` renvoie `SystemAccountCredited` quand le compte destinataire porte
`owner_type = 'system'`.

**Pourquoi** : `post_operation` refuse déjà le virement d'un compte vers lui-même, donc recharger
`MINISTRY_ISSUANCE` depuis lui-même échouait de toute façon. Mais recharger `CLOSURE_FORFEIT`
depuis l'émission passait sans rien signaler, et produisait une ligne de `topups` qui n'a aucun
sens : un forfait de clôture n'est pas une dotation. Autant nommer le refus.

### 19. Seul `topup.rs` est livré, et il ne compile pas encore

`TASK-DISTRIBUTION-BACKEND.md` §2 ne me confie que `funding/topup.rs` : `mod.rs` et `repo.rs`
tombent dans le « tout le reste » de Giscard. J'avais écrit les trois ; je n'ai gardé que le
mien. `topup.rs` appelle donc des choses qui n'existent pas encore, exactement comme `settle`
appelle `approved_account` au point 15.

**Ce que Giscard doit fournir**, exactement :

```rust
// crates/core/src/lib.rs
pub mod funding;

// crates/core/src/funding/mod.rs
pub mod repo;
pub mod topup;

#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct Topup {
    pub operation_id: OperationId,
    pub batch_id: Option<BatchId>,
    pub employer_id: EmployerId,
    pub to_account: AccountId,
    pub reference: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum FundingError {
    SystemAccountMissing(&'static str),
    SystemAccountCredited,
    AccountInactive,
    Ledger(#[from] LedgerError),
    Db(#[from] sqlx::Error),
}

// crates/core/src/funding/repo.rs
pub async fn find_topup_by_reference(
    conn: &mut PgConnection, employer_id: EmployerId, reference: &str,
) -> Result<Option<Topup>, sqlx::Error>;

pub async fn insert_topup(
    conn: &mut PgConnection, operation_id: OperationId, batch_id: Option<BatchId>,
    employer_id: EmployerId, to_account: AccountId, reference: Option<&str>,
) -> Result<Topup, sqlx::Error>;
```

Deux points qui ne se devinent pas. `find_topup_by_reference` ne doit filtrer que sur
`(employer_id, reference)`, sans condition supplémentaire : c'est ce qui porte l'idempotence du
point 17, et un filtre de plus la casserait. Et `insert_topup` doit renvoyer la ligne insérée par
`RETURNING`, pas un `()` : `topup` rend le `Topup` à son appelant.

`TopupBatch` et `BatchStatus` sont annoncés par `file-guide.md` §3.8 dans le même `mod.rs`. Le lot
CSV étant coupé au §1 du plan de répartition, ils ne me manquent pas — mais la table
`topup_batches` existe et `Topup.batch_id` la référence déjà, donc autant les écrire tant qu'il
y est.

### 20. Les tests de `funding` ne sont pas livrés

`topup` a été vérifié par cinq tests contre un PostgreSQL réel : le rechargement nominal et les
deux soldes qui bougent en sens inverse, la référence rejouée qui ne crédite pas deux fois, le
compte suspendu refusé, le compte système refusé au crédit, et deux rechargements sans référence
qui s'appliquent tous les deux. Ils passent, et ils ne sont pas dans le dépôt.

**Pourquoi** : ils ont besoin de tout ce que liste le point 19, et livrer un fichier de test qui
ne compile pas casserait le paquet `crates/tests` en entier, donc aussi `invariants.rs`. Ils
reviendront quand Giscard aura livré — dans un `funding_topup.rs` à part, parce que ce ne sont
pas des invariants et que `payments_flow.rs` est réservé au chemin `authorize` → `settle`.

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

**Cet écart est levé par le §25.**

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

### 25. `settle` renvoie un `Settlement`, pas un `Payment`

**Ce que j'ai fait** : `settle` rend désormais `Settlement { payment, amount }`, et `payments/repo.rs`
gagne `find_settlement_by_jti`, `operation_amount` et `list_partner_settlements`, cette dernière
remplaçant `list_partner_payments`.

**Pourquoi** : la table `payments` ne porte pas de montant, et c'est délibéré — le montant vit dans
`ledger_operations`, parce que le journal est ce qui fait autorité sur les sommes. Mais le contrat
publié demande `amount` dans la réponse de `POST /partner/payments` **et** dans chaque ligne de
`GET /partner/transactions`. Le handler devait donc aller le chercher lui-même, c'est-à-dire mettre
une requête dans la couche HTTP, exactement ce que la règle R1 interdit.

Le coût est nul sur le chemin nominal : `settle` tient déjà `token.amount` au moment où il écrit
l'opération, il n'a rien à relire. Sur le chemin idempotent — le commerçant qui rejoue — la relecture
du montant coûte une requête de plus, sur un chemin qui n'est pas le chemin chaud.

**Ce que ça règle au passage** : le §22. `PaymentResponse` se construit à nouveau par un
`impl From<&Settlement>`, comme la règle du guide §4.4 le demande pour tout DTO de réponse. Ce n'était
pas possible tant que le type du domaine ne portait pas le montant.

**Pourquoi une composition et pas une structure plate** : `Payment` est la ligne de la table, et
`Settlement` est le résultat métier d'un encaissement. Aplatir les deux aurait dupliqué les sept
champs de `Payment`, et il aurait fallu les maintenir en double le jour où la table change. La
composition ne coûte qu'une implémentation manuelle de `FromRow`, huit lignes, qui sert aussi bien à
la lecture unitaire qu'à la liste jointe.

### 26. L'expiration se juge au moment du scan, pas au moment de la synchronisation

**Le constat** : `RESYNC_MAX_AGE_HOURS` vaut 72 h et `TOKEN_TTL_SECONDS` vaut 300 s. Tant que
`settle` comparait `expires_at` à l'horloge du serveur, la première de ces deux durées ne servait
strictement à rien : tout encaissement hors ligne resynchronisé plus de cinq minutes après le scan
sortait en `TokenExpired`. `TASK-DISTRIBUTION-BACKEND.md` annonce pourtant au jury que « le backend
est prêt » pour la file d'attente hors ligne. Il ne l'était pas.

**Ce que j'ai fait** : `settle` compare désormais `expires_at` à `scanned_at`. Le jeton est valide
si le commerçant l'a scanné pendant sa fenêtre de validité, quel que soit le moment où la
synchronisation nous parvient — dans la limite de `resync_max_age`.

**Ce que ça amende** : la décision 2, qui faisait de l'horloge du serveur la seule autorité sur
l'expiration. Elle reste vraie pour ce qu'elle protégeait — le jeton du QR ne fait toujours pas foi,
et c'est nous qui décidons — mais la question « à quel instant juge-t-on ? » reçoit une autre
réponse.

**Ce que je concède** : `scanned_at` vient du client. Je l'encadre par trois bornes plutôt que de
lui faire confiance :

1. `now - scanned_at > resync_max_age` reste refusé — une file d'attente ne remonte pas de trois
   jours.
2. `scanned_at` est ramené à `min(scanned_at, now)` — une horloge de caisse en avance ne prolonge
   la vie d'aucun jeton, elle est simplement recalée sur la nôtre.
3. `scanned_at < issued_at` est refusé — un scan antérieur à l'émission du jeton ne peut pas être
   sincère.

**Ce qu'un menteur y gagne, exactement** : encaisser un jeton *qu'il détient légitimement* et qui a
expiré, en déclarant l'avoir scanné pendant sa validité. Rien de plus. Il ne peut pas en forger un,
la signature est Ed25519 ; ni l'encaisser deux fois, `payments.token_jti` est unique ; ni en changer
le montant, celui-ci vient du jeton et jamais de la requête ; ni le passer sur un compte suspendu ou
un commerçant non agréé, ces contrôles sont inchangés. Mis en face d'un mode dégradé qui ne
fonctionnait pas du tout, le compromis me paraît largement favorable.

### Le jeton déjà balayé

Corriger la comparaison ne suffisait pas. `expire_stale_tokens` passe les jetons échus en `expired`
et libère leur réservation ; le `match` sur le statut refusait ces jetons avant même d'examiner
`scanned_at`. Un encaissement hors ligne parfaitement valide restait donc refusé dès que le balayage
était passé — c'est-à-dire toujours, puisque l'expiration est traitée en paresseux à chaque lecture
de solde.

`settle` accepte maintenant un jeton `expired`, en retenant que sa réservation n'existe plus :

- `still_held` distingue `Active` (le hold est là, il faut le libérer) de `Expired` (le balayage
  l'a déjà fait, le libérer une seconde fois donnerait `ReleaseExceedsHold`).
- `consume_token` accepte `status IN ('active', 'expired')`, sans quoi le jeton serait resté
  `expired` alors qu'un paiement lui est attaché, ce qui casse la cohérence que le test I6 vérifie.
- Les fonds ayant été rendus disponibles, l'employé a pu les dépenser entre-temps. `post_operation`
  échoue alors sur la contrainte de solde, et je traduis explicitement ce cas en
  `PaymentError::InsufficientFunds` plutôt que de le laisser remonter en `Ledger(_)`, que la table
  de correspondance range en 500. C'est une situation métier, le commerçant doit la comprendre.

**Ce que ça règle au passage** : l'invariant I7 — « un jeton expiré n'est jamais réglé » — devient
vrai *par construction*. Il était jusqu'ici vérifié après coup par une requête ; il est maintenant
la condition même qui autorise l'écriture, puisque `settle` refuse tout `scanned_at` postérieur à
`expires_at`.

### 27. `AuthUser<R>(pub AuthenticatedUser)` ne peut pas compiler tel qu'il est écrit

**Le contrat figé à H+0** (`TASK-DISTRIBUTION-BACKEND.md` §3, repris par `file-guide.md` §4.3) donne
l'extracteur d'authentification sous cette forme :

```rust
pub struct AuthUser<R: Role>(pub AuthenticatedUser);
```

**Le problème** : Rust refuse un paramètre de type qui n'apparaît dans aucun champ — c'est
l'erreur `E0392`. Le marqueur de rôle n'étant utilisé que par l'implémentation de
`FromRequestParts`, la structure a besoin d'un `PhantomData<R>` pour exister. Je ne l'ai découvert
qu'en compilant mes handlers contre le contrat.

**Ce que j'ai fait** : mes handlers destructurent `AuthUser(user, _)`. C'est la seule forme qui
compile, et elle laisse à Giscard le choix de rendre le second champ public ou d'exposer un
accesseur — dans ce dernier cas, ce sont mes deux fichiers qui changent, pas les siens.

**Pourquoi je le consigne plutôt que de le contourner** : c'est un des cinq contrats que nous avons
gelés pour ne pas nous bloquer mutuellement. Un contrat qui ne compile pas doit être corrigé dans
le document, sinon chacun de nous deux le redécouvrira de son côté.

### 28. Le curseur de pagination est l'identifiant de la dernière ligne

**Le plan** (`file-guide.md` §4.3) décrit un « curseur opaque base64 encapsulant
`(valeur_de_tri, id)` ».

**Ce que j'ai fait** : mes deux listes rendent l'identifiant de la dernière opération de la page,
et `null` dès que la page n'est pas pleine.

**Pourquoi** : l'encodage du curseur appartient à `extractors/pagination.rs`, qui n'existe pas
encore. Inventer un format base64 dans mes handlers reviendrait à en fixer un deuxième, et le jour
où Giscard écrit le sien, les deux se contrediraient en silence. L'identifiant nu reste opaque du
point de vue du front — il ne doit rien en déduire — et se remplace par le format complet sans
changer la forme de la réponse.

### 29. Les lectures de l'espace partenaire vivent dans `payments`, pas dans `reporting`

**Le plan** confie `core/src/reporting/` à Giscard, et c'est là que devraient naturellement vivre
les relevés.

**Ce que j'ai fait** : `payments/repo.rs` gagne `partner_totals` et `list_partner_activity`, avec
les types `PartnerTotals` et `PartnerActivity` dans `payments/mod.rs`. En revanche le relevé de
l'employé reste chez lui, dans `reporting::employee_statement`.

**Pourquoi cette frontière-là** : ce que lit un commerçant, ce sont ses propres encaissements —
`payments` joint à `ledger_operations`, exactement la matière dont `payments/repo.rs` a déjà la
charge, et dont j'ai eu besoin de toute façon pour le montant du §25. Le relevé d'un employé, lui,
mélange rechargements et paiements, et va chercher le nom d'un employeur ou d'une enseigne : c'est
un croisement de trois domaines dont aucun n'est le mien.

**Le libellé du client** — « K. A. » — est calculé en SQL à partir des initiales de l'employé, avec
un `LEFT JOIN` : un compte sans fiche employé rend un tiret plutôt que de faire disparaître la
ligne. Le nom complet ne quitte jamais la base.

### 30. Ce que mes deux fichiers de routes attendent de Giscard

Les neuf handlers sont écrits et compilent, vérifiés contre un jeu de bouchons que j'ai posés puis
retirés. Voici, exactement, ce qui leur manque. Je le liste ici parce que la moitié de ces éléments
n'était pas dans le contrat figé, et qu'ils sont autant de décisions que je prends à sa place tant
qu'il ne les a pas prises.

```rust
// core/src/lib.rs
pub mod directory;  pub mod partners;  pub mod payments;  pub mod reporting;

// core/src/partners/mod.rs
pub struct PartnerCard { pub id: PartnerId, pub trade_name: String }
pub enum PartnerError { NotApproved, Db(sqlx::Error) }

// core/src/partners/repo.rs
pub async fn approved_account(tx: &mut PgTransaction<'_>, id: PartnerId)
    -> Result<AccountId, PartnerError>;

// core/src/partners/highlights.rs
pub struct MinisterPick { pub partner: PartnerCard, pub position: i32 }
pub async fn minister_picks(pool: &PgPool) -> Result<Vec<MinisterPick>, PartnerError>;

// core/src/directory/employees.rs
pub async fn active_account(conn: &mut PgConnection, employee: EmployeeId)
    -> Result<AccountId, DirectoryError>;

// core/src/reporting/mod.rs
pub struct StatementLine {
    pub operation_id: OperationId, pub kind: OperationKind, pub amount: Money,
    pub incoming: bool, pub counterparty: String,
    pub occurred_at: DateTime<Utc>, pub reference: Option<String>,
}
pub async fn employee_statement(
    pool: &PgPool, account: AccountId, limit: i64, cursor: Option<&str>,
) -> Result<Vec<StatementLine>, sqlx::Error>;

// api/Cargo.toml : ed25519-dalek, puisque AppState porte Arc<SigningKey>
// api/src/state.rs   : AppState { db, clock, signing_key, config }, Clone
// api/src/error.rs   : ApiError, IntoResponse, et From<_> pour CoreError, sqlx::Error,
//                      InvalidMoneyError, PaymentError, PartnerError, DirectoryError
// api/src/extractors/auth.rs       : AuthUser<R>(pub AuthenticatedUser, pub PhantomData<R>),
//                                    marqueurs Employee et Partner,
//                                    From<AuthenticatedUser> pour EmployeeId et PartnerId
// api/src/extractors/pagination.rs : Pagination { cursor: Option<String>, limit: u32 }
// api/src/extractors/validated.rs  : ValidatedJson<T: Validate>(pub T)
// api/src/dto/mod.rs               : Paginated<T> { items, next_cursor } + les pub mod
// api/src/dto/catalog.rs           : CatalogItem + From<&PartnerCard>
// api/src/routes/mod.rs            : monte employee::routes() et partner::routes()
```

Deux points ne se devinent pas. `AuthenticatedUser` doit se convertir en `EmployeeId` et en
`PartnerId` — c'est ce que le handler d'exemple du guide suppose avec son `partner.into()`, et
sans ces deux conversions aucun handler ne sait de qui il parle. Et `ApiError` doit accepter
`PaymentError` directement, sans passer par `CoreError` : les codes du dictionnaire §6 distinguent
`TOKEN_EXPIRED` de `TOKEN_ALREADY_USED`, ce que la conversion vers `CoreError` aplatirait.

**`PaymentError::code()`** est en revanche déjà écrit, chez moi, dans `payments/mod.rs` : le lot de
resynchronisation doit nommer l'erreur de chaque ligne sans fabriquer de réponse HTTP, donc le
code stable appartient au domaine. `api/src/error.rs` n'a plus qu'à y ajouter le statut.

