[//]: # (This is a changelog file)
[//]: # (Each time you make a minor or major change in the project, repertoriate it here according to the following format. So each changes equals to an affectation of this file with all the sections.)
[//]: # (This is a changelog file)
[//]: # (Each time you make a minor or minor change in the project, repertoriate it here according to the following format. So each changes equals to an affectation of this file with all the sections.)

## 1.7.0 03.09.2026

### Changed

- **`settle` renvoie un `Settlement { payment, amount }` au lieu d'un `Payment`.** La table `payments`
  ne porte pas de montant — il vit dans `ledger_operations`, qui fait autorité sur les sommes — alors
  que le contrat publié le réclame dans la réponse de `POST /partner/payments` et dans chaque ligne de
  `GET /partner/transactions`. Sans ce changement, le handler aurait dû aller le chercher lui-même,
  c'est-à-dire porter une requête dans la couche HTTP. Le détail est dans `decisions.md` §25.
- `payments/repo.rs` : `list_partner_payments` devient `list_partner_settlements` et joint
  `ledger_operations` pour rendre le montant de chaque ligne. Deux nouvelles lectures,
  `find_settlement_by_jti` et `operation_amount`.
- `dto/partner.rs` : `PaymentResponse::settled` devient `impl From<&Settlement>`. **Cela lève l'écart
  §22** — la règle du guide §4.4, un `From<DomainType>` par DTO de réponse, redevient tenable.
- `payments/mod.rs` réexporte `cancel` à côté de `settle`. `DELETE /me/payment-tokens/{jti}` en a
  besoin, et le §12 en fait déjà un point d'entrée métier.

### Added

- `crates/tests/tests/payments_flow.rs` : un vingtième test,
  `a_partner_reads_back_its_settlements_with_their_amounts`, qui couvre la lecture jointe — deux
  encaissements chez un commerçant, un chez un autre, ordre décroissant et cloisonnement vérifiés. Les
  tests existants affirment désormais le montant rendu, y compris sur le chemin idempotent, où il est
  relu depuis l'opération du ledger et non depuis le jeton.

### Notes

- **`crypto/password.rs` ne compile pas.** Le fichier arrivé par la PR #9 porte une virgule surnuméraire
  après la valeur de retour de `dummy_hash` (ligne 42), ce qui casse `cargo build` sur `develop` pour
  tout le monde. Par ailleurs le condensat factice qu'il renvoie ne commence pas par `$`, donc il n'est
  pas un PHC valide : `PasswordHash::new` le rejettera, et `verify_password` rendra `MalformedHash` là
  où l'on attend `false`. C'est précisément la vérification à temps constant sur utilisateur inconnu
  qui tombe, donc la protection contre l'énumération des comptes. Le fichier appartient à Giscard, je
  n'y touche pas ; j'ai vérifié mon travail en le neutralisant localement, puis je l'ai remis en
  l'état.

## 1.6.0 03.09.2026

### Added

- `crates/tests/tests/payments_flow.rs` : dix-neuf tests du chemin `authorize` → `settle` contre un
  PostgreSQL réel. Parcours nominal et déplacement des deux soldes, jeton couvrant la totalité du
  disponible, réservation qui interdit un second jeton, idempotence du même commerçant, refus du
  commerçant suivant, code court dicté au comptoir, code inconnu et code absurde, expiration,
  annulation par l'employé, annulation tentée par un autre employé, commerçant non agréé, compte
  clôturé, compte suspendu à l'émission, fenêtre de resynchronisation dépassée, et le balayage des
  jetons échus qui rend les fonds réservés.
- Le jeton signé rendu par `authorize` est vérifié dans le test : signature, `jti`, montant,
  émetteur et expiration. C'est la seule jonction entre `payments` et `crypto/token_sig`, elle
  méritait d'être tenue par un test.

### Changed

- `crates/tests/Cargo.toml` : ajout d'`ed25519-dalek` en `[dev-dependencies]`. `authorize` réclame
  une `SigningKey`, et le paquet de tests n'avait aucun moyen d'en fabriquer une. La clé du test est
  déterministe — trente-deux octets constants — plutôt que tirée au hasard : un test qui échoue doit
  échouer à chaque fois.

### Notes

- **La fenêtre de resynchronisation ne prolonge pas la vie d'un jeton, et les deux durées se
  contredisent.** `settle` compare `expires_at` à l'horloge du serveur, conformément à la décision 2,
  alors que `RESYNC_MAX_AGE_HOURS` vaut 72 h et `TOKEN_TTL_SECONDS` 300 s. Un commerçant hors ligne
  qui encaisse puis se resynchronise plus de cinq minutes après le scan reçoit donc `TOKEN_EXPIRED`,
  et la fenêtre de 72 h ne sert jamais. Le test
  `the_resync_window_does_not_extend_the_token_lifetime` fige le comportement actuel pour que le jour
  où on en décide autrement, ce soit un choix visible et non une dérive. Je ne touche pas à `settle`
  tant que la question n'est pas tranchée.
- Le refus d'un jeton expiré ne libère pas la réservation : c'est `expire_stale_tokens` qui le fait,
  et le test l'affirme dans les deux sens.
- `payments_flow.rs` reste du code mort tant que `core/src/lib.rs` ne déclare pas `pub mod payments;`
  et `pub mod partners;`, et tant que `partners::repo::approved_account` n'existe pas. J'ai vérifié
  les dix-neuf tests en posant ces trois éléments localement — `approved_account` avec son vrai
  filtre `status = 'approved'`, sans quoi la moitié des tests ne prouverait rien — puis je les ai
  retirés. Les neuf tests d'invariants passent toujours.

## 1.5.0 03.09.2026

### Added

- `api/src/dto/employee.rs` : `BalanceResponse`, `EmployeeTransaction`, `MinisterPick`,
  `AuthorizeRequest` et `IssuedTokenResponse`. Le solde se construit depuis `Account` par un
  `TryFrom`, parce que les trois montants sont des `i64` en base — la conversion peut échouer, et
  elle doit le dire plutôt que de fabriquer un `Money` invalide.
- `api/src/dto/partner.rs` : `PartnerSummary`, `PartnerTransaction`, `SettleRequest`,
  `PaymentResponse` et le lot de resynchronisation, `BatchSettleRequest`, `BatchSettleResult` et
  `BatchSettleResponse`. `SettleRequest::token_ref` traduit le couple `(jti, short_code)` en
  `TokenRef`, la validation de schéma garantissant qu'exactement un des deux est renseigné.

### Changed

- **Le lot de resynchronisation renvoie un `jti` nullable.** Une ligne saisie par code court et
  refusée pour code inconnu n'a pas de `jti` à nommer. Le contrat publié annonçait `string` ;
  il devient `string | null`, et la corrélation avec la file du commerçant se fait par le rang.
  Le détail est dans `decisions.md` §21.

### Fixed

- **Un montant nul est refusé au bord.** `Money` accepte zéro, `place_hold` le refuse, et la
  conversion range ce refus dans `CoreError::Internal` : une demande de jeton à 0 € serait sortie
  en **500** au lieu d'un `422`. `AuthorizeRequest` porte désormais la validation.

### Notes

- Le code court sort formaté pour l'affichage (`86RB-57CT`) et rentre tel que le commerçant l'a
  tapé. La normalisation reste au seul endroit qui l'a toujours faite, `settle::resolve` — deux
  implémentations de la même règle finissent toujours par diverger.
- Les montants de ces DTO sont des `Money`, donc des euros décimaux en JSON. Le commentaire du
  fichier de départ annonçait « amounts stay plain integers », écrit avant l'amendement A5 ; c'est
  la §4 du dictionnaire qui fait foi.
- `utoipa` ne sait rien de `Money` ni des newtypes d'identifiant. Plutôt que de dériver `ToSchema`
  dans `core`, chaque champ concerné porte un `#[schema(value_type = ...)]` : la documentation
  OpenAPI reste juste sans que la couche HTTP déborde sur le métier.
- Ces deux fichiers sont du code mort tant que `dto/mod.rs` ne les déclare pas. Il me manque de
  Giscard, exactement : `pub mod employee;` et `pub mod partner;` dans `crates/api/src/dto/mod.rs`,
  l'enveloppe commune `Paginated<T> { items, next_cursor }` de la §4.1 du dictionnaire au même
  endroit, `CatalogItem` dans `dto/catalog.rs` — dont dépend `MinisterPick` — et toujours
  `pub mod payments;` dans `core/src/lib.rs`. J'ai vérifié les deux fichiers en posant ces éléments
  localement, puis je les ai retirés.

## 1.4.0 03.09.2026

### Added

- `core/src/funding/topup.rs` : `topup`, le troisième et dernier segment du chemin monétaire.
  Verrou de chaîne, contrôle d'idempotence sur la référence, lecture du compte
  `MINISTRY_ISSUANCE`, verrou des deux comptes, opération de partie double, insertion dans
  `topups`. La constante `ISSUANCE_ACCOUNT` vit dans ce fichier plutôt que dans `mod.rs`, pour
  réduire d'autant ce que j'attends de Giscard.

### Notes

- **L'idempotence du rechargement ne repose pas sur un index unique.** Le schéma ne contraint
  pas `(employer_id, reference)`, et je n'ai pas voulu modifier une migration déjà appliquée.
  La protection tient au fait que `topup` prend `lock_chain` avant de chercher la référence :
  tout chemin qui écrit dans le journal passe par ce verrou consultatif, donc deux
  rechargements concurrents portant la même référence se sérialisent et le second lit la ligne
  du premier. C'est correct tant que personne n'insère dans `topups` sans passer par cette
  fonction.
- `topup` reçoit un `AccountId` déjà résolu. C'est la route `POST /admin/topups` qui appellera
  `directory::resolve_account_by_ref` pour traduire le matricule, et cette route appartient à
  Giscard.
- Le compte système est refusé au crédit d'un rechargement. `MINISTRY_ISSUANCE` se débite, il
  ne se recharge pas, et `CLOSURE_FORFEIT` reçoit des soldes de clôture, pas de l'émission.
- `funding` reste du code mort tant que Giscard n'a pas livré `funding/mod.rs`,
  `funding/repo.rs` et la déclaration `pub mod funding;` — le détail du contrat est dans
  `decisions.md` §19. J'ai vérifié `topup` en posant ces trois éléments localement, le temps de
  faire tourner cinq tests contre un PostgreSQL réel, puis je les ai retirés.
## 1.3.0 02.09.2026

### Added

- `core/src/payments/mod.rs` : `TokenStatus`, `EntryMode`, `PaymentToken`, `Payment`, `TokenRef`
  et `PaymentError`. Les erreurs `UnknownToken`, `TokenExpired`, `TokenAlreadyUsed`,
  `TokenCancelled`, `PartnerNotApproved` et `ResyncTooLate` restent distinctes : c'est de cette
  distinction que dépend la file d'attente du commerçant hors ligne.
- `core/src/payments/repo.rs` : les requêtes sur les jetons et les paiements, dont
  `lock_token`, `consume_token`, `insert_payment` et le balayage des jetons échus.
- `core/src/payments/authorize.rs` : émission d'un jeton — verrou de compte, réservation des
  fonds, tirage d'un code court disponible, insertion, signature du QR.
- `core/src/payments/settle.rs` : encaissement dans l'ordre imposé — idempotence, fenêtre de
  resynchronisation, verrous, contrôles, écriture. Plus `cancel`, l'annulation d'un jeton par
  l'employé, qui libère la réservation.
- `core/src/payments/expire.rs` : `expire_stale_tokens`, une transaction par jeton, pour que
  l'échec d'une ligne n'empêche pas les suivantes.

### Fixed

- **`release_hold` doit précéder `post_operation` dans `settle`.** L'ordre inscrit dans
  `TASK-DISTRIBUTION-BACKEND.md` §4.1 débitait le solde avant de libérer la réservation, ce qui
  laisse transitoirement `balance_held > balance_settled` — état que la contrainte
  `held_within_settled` refuse à chaque instruction. L'encaissement aurait échoué sur tout jeton
  couvrant la totalité du solde.
- **Idempotence sous concurrence.** Le contrôle de rejeu en tête de `settle` peut être franchi
  par deux requêtes simultanées du même commerçant. La seconde trouve désormais le jeton en
  `consumed` et relit le paiement associé au lieu de renvoyer `TokenAlreadyUsed` à quelqu'un qui
  a bel et bien été réglé.

### Notes

- La recherche par code court ignore volontairement le statut du jeton et prend le plus récent
  portant ce code. L'index unique ne couvrant que les jetons actifs, filtrer sur `active` aurait
  cassé l'idempotence : un rejeu après consommation n'aurait rien trouvé.
- `authorize` tire jusqu'à cinq codes courts en vérifiant leur disponibilité par un `SELECT`
  avant d'insérer. Un réessai après violation d'unicité aurait exigé un `SAVEPOINT`, une erreur
  d'insertion avortant la transaction entière.
- `payments` reste du code mort tant que `lib.rs` ne déclare pas `pub mod payments;` et
  `pub mod partners;`, et tant que `partners/repo.rs::approved_account` n'existe pas. Les trois
  éléments appartiennent à Giscard.

## 1.2.0 02.09.2026

### Added

- `core/src/crypto/token_sig.rs` : `TokenPayload`, `sign` et `verify` en Ed25519. Format de fil
  `CP1.<b64url payload>.<b64url signature>`, alphabet base64 URL sans remplissage. `verify`
  vérifie la signature **avant** de désérialiser, et distingue `UnsupportedVersion` d'une
  signature invalide pour qu'un futur `CP2` ne passe pas pour une falsification.
- `core/src/crypto/short_code.rs` : `generate`, `format_for_display`, `normalize` et `is_valid`.
  Alphabet de 31 caractères sans `0`, `O`, `1`, `I` ni `l`, parce que le code est dicté à voix
  haute. `normalize` ramène la saisie du commerçant vers la forme stockée.
- `crates/core/tests/token_sig.rs` : treize tests, dont la réécriture du montant dans un payload
  signé et un payload illisible présenté avec une signature de bonne longueur — ce dernier
  vérifie que la signature est contrôlée avant la désérialisation.
- `crates/core/tests/short_code.rs` : huit tests sur générateur à graine fixe, dont l'aller-retour
  `normalize(format_for_display(c)) == c` sur mille tirages.

### Changed

- `core/src/lib.rs` déclare le module `crypto`, et `core/src/crypto/mod.rs` ses trois
  sous-modules. Deux fichiers du périmètre de Giscard, modifications limitées aux déclarations.
- `crates/core/Cargo.toml` : ajout de `rand`, `base64` et `ed25519-dalek` en
  `[dev-dependencies]`, nécessaires pour fabriquer une paire de clés et forger un jeton depuis un
  test d'intégration.

### Notes

- `amt` est un entier de centimes dans le payload signé, jamais un `Money` : la sérialisation de
  `Money` produit un flottant pour l'API HTTP, et un flottant n'a pas de forme textuelle stable
  à signer.
- `verify` répond à une seule question, « avons-nous émis ce jeton ». L'expiration qui fait foi
  reste celle que `settle` compare à l'horloge serveur.

## 1.1.0 02.09.2026

### Added

- `core/src/ledger/hash.rs` : `GENESIS_HASH`, `entry_hash` et `digest_from_slice`. Le condensat
  SHA-256 porte une étiquette de domaine versionnée et huit champs de longueur fixe.
- `core/src/ledger/repo.rs` : les requêtes du journal, sans aucune règle métier — verrou
  consultatif, lecture de compte avec et sans `FOR UPDATE`, insertion d'opération et d'écriture,
  réservation du rang par `nextval`, ajustement des caches de solde et des réservations.
- `core/src/ledger/mod.rs` : `Posting`, `Account`, `LedgerOperation`, `LedgerEntry`, les quatre
  énumérations du journal, `LedgerError`, et les cinq points d'entrée `lock_chain`,
  `lock_account`, `post_operation`, `place_hold`, `release_hold`.
- `core/src/ledger/balance.rs` : `recompute_balance`, `recompute_held` et `verify_chain`, qui
  renvoie `ChainStatus::BrokenAt(seq)` sur la première écriture incohérente.
- `crates/tests/tests/invariants.rs` : un test par invariant I1 à I9 contre un PostgreSQL réel.
- `crates/tests/tests/common/mod.rs` : les fabriques de jeux d'essai — employeur, employé avec
  compte, partenaire approuvé, rechargement, émission de jeton et règlement.
- `docs/decisions.md` : la sérialisation canonique du hachage des écritures, avec le format
  champ par champ et les trois choix qui l'ont fixée.

### Changed

- `core/src/lib.rs` déclare le module `ledger`. C'est un fichier du périmètre de Giscard, la
  modification se limite à cette ligne.
- `core/src/error.rs` : ajout de `CoreError::Internal`, cible des variantes de `LedgerError` qui
  signalent une erreur de programmation et non une situation métier. La conversion
  `LedgerError` → `CoreError` vit dans `ledger/mod.rs`.

## 1.0.0 01.09.2027 3:09 PM

### Added

- `docs/data-model.md` : rédaction des neuf invariants I1 à I9, chacun avec sa formulation vérifiable et la raison pour laquelle il compte. Les règles portées par le schéma sont listées à part.
- `migrations/0001_schema.sql` : schéma complet — 13 énumérations, 16 tables, contraintes `CHECK`, index uniques partiels, déclencheurs d'immuabilité sur le ledger et l'audit, rôle `cartepro_app`, comptes système.
- Tests unitaires du socle sous `crates/core/tests/` (`money.rs`, `ids.rs`, `clock.rs`).
- `core/src/ids.rs` : ajout de `EmploymentLinkId`, requis par `data-dictionary.md` §3.4 et absent de la liste du guide.
- `core/src/money.rs` : type `Money` en centimes d'euro, avec `parse_euros` pour l'import CSV et conversion euros/centimes aux frontières de sérialisation.

database schema implementation in migrations/0001_schema.sql and insertion of France cities in the database in migrations/0002_cities.sql
### Changed

- **Les comptes système sont exemptés de la contrainte de non-négativité des soldes.** `MINISTRY_ISSUANCE` est la contrepartie d'émission : son solde négatif mesure le total émis. La contrainte absolue rendait tout rechargement impossible, la somme des soldes valant identiquement zéro en partie double. I3 est reformulé sur les seuls comptes `employee` et `partner`.
- **Devise : le franc devient l'euro.** Les montants circulent en JSON sous forme de nombres décimaux en euros (`456.56`) et non plus en entiers. Le stockage reste `BIGINT`, désormais en centimes. `data-dictionary.md` §0 et §1, §4 et `file-guide.md` §4.4 amendés en conséquence. Le front doit envoyer et lire des euros décimaux à deux décimales au maximum.

### Fixed

- `migrations/0001_schema.sql` : le rôle `cartepro_app` n'avait aucun privilège sur quinze des dix-huit tables — l'API aurait échoué à sa première requête. Les `GRANT` sont désormais explicites, et les `REVOKE` du ledger vérifiés en se connectant réellement avec ce rôle.
- `backend/tests/` n'appartenait à aucun paquet du workspace : Cargo ne compilait ni n'exécutait `invariants.rs`, `rbac.rs`, `payments_flow.rs`, `degraded_mode.rs`, `public_surface.rs` ni `common/`. Les fichiers sont déplacés dans un paquet dédié `crates/tests/`, ajouté aux membres du workspace.

### Removed