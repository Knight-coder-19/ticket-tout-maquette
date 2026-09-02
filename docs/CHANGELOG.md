[//]: # (This is a changelog file)
[//]: # (Each time you make a minor or major change in the project, repertoriate it here according to the following format. So each changes equals to an affectation of this file with all the sections.)
[//]: # (This is a changelog file)
[//]: # (Each time you make a minor or minor change in the project, repertoriate it here according to the following format. So each changes equals to an affectation of this file with all the sections.)

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