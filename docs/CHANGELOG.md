[//]: # (This is a changelog file)
[//]: # (Each time you make a minor or major change in the project, repertoriate it here according to the following format. So each changes equals to an affectation of this file with all the sections.)
[//]: # (This is a changelog file)
[//]: # (Each time you make a minor or minor change in the project, repertoriate it here according to the following format. So each changes equals to an affectation of this file with all the sections.)

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