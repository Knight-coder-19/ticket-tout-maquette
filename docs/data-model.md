# CartePro — Modèle de données

> Compagnon de `docs/data-dictionary.md` (le quoi) et de `migrations/0001_schema.sql` (le comment).
> Ce document dit **pourquoi** le schéma est ce qu'il est. Le dictionnaire dit ce que le front en
> voit, la migration dit comment PostgreSQL l'applique.

Le schéma tient en treize énumérations et dix-huit tables, dans un seul fichier de migration.
J'ai gardé l'ensemble en un seul fichier parce que l'ordre des dépendances y est lisible de haut en
bas, et qu'une base de démonstration se recrée d'une seule commande. La migration `0002` n'apporte
que le référentiel des villes, et la `0003` un index d'unicité que j'aurais dû poser dès le départ.

**Trois principes gouvernent tout ce qui suit.** L'argent ne se déplace que par écriture double,
donc jamais par une mise à jour de solde isolée. Rien de ce qui touche au journal ne se modifie ni
ne se supprime, et c'est la base elle-même qui le refuse, pas le code applicatif. Et toute règle
qui peut être portée par une contrainte l'est, parce qu'une contrainte tient même quand le code
se trompe.

---

## Les treize énumérations

J'ai choisi des types `ENUM` PostgreSQL plutôt que des colonnes `TEXT` avec un `CHECK`. Le gain
n'est pas le stockage, il est que l'ensemble des valeurs est **déclaré une seule fois** et que
`sqlx` peut le projeter sur une énumération Rust par `#[sqlx(type_name = ...)]`. Une valeur
inconnue ne franchit alors ni la base, ni la désérialisation. Le coût est connu et assumé :
ajouter une valeur demande un `ALTER TYPE`, et en retirer une est presque impossible. C'est
exactement la friction que je veux — une nouvelle valeur d'énumération est un changement cassant
pour le front, et le dictionnaire le dit.

| Type | Valeurs | Rôle |
|---|---|---|
| `user_role` | `employee`, `partner`, `admin` | Les trois rôles. Le contrôle d'accès s'y ramène entièrement. |
| `user_status` | `active`, `suspended`, `closed` | Cycle de vie d'un compte utilisateur, et aussi d'un employeur et d'un client d'API. |
| `link_status` | `active`, `ended` | Un rattachement à un employeur est en cours ou terminé. |
| `partner_status` | `pending`, `approved`, `rejected`, `suspended`, `closed` | Le parcours de validation d'un commerçant. Seul `approved` reçoit de l'argent et paraît au catalogue. |
| `account_owner` | `employee`, `partner`, `system` | À qui appartient un compte. `system` est la porte de sortie de toutes les contraintes de solde. |
| `account_status` | `active`, `suspended`, `closed` | Cycle de vie d'un compte monétaire, distinct de celui de l'utilisateur. |
| `token_status` | `active`, `consumed`, `expired`, `cancelled` | Les quatre fins possibles d'un jeton de paiement. Trois sur quatre sont définitives. |
| `operation_kind` | `topup`, `payment`, `compensation`, `closure_forfeit` | La nature d'une opération du journal. Chaque valeur a sa table de détail. |
| `entry_direction` | `debit`, `credit` | Le sens d'une écriture. Deux valeurs, jamais trois. |
| `entry_mode` | `qr_scan`, `short_code` | Comment le jeton a été présenté au comptoir. Sert au support et aux statistiques de terrain. |
| `batch_status` | `draft`, `validated`, `rejected` | Le cycle d'un lot de rechargement importé par fichier. |
| `service_mode` | `physical`, `online`, `both` | Amendement A1. Décide si une adresse est exigée. |
| `highlight_placement` | `minister_pick`, `public_featured` | Amendement A2. Deux vitrines distinctes, avec leurs propres positions. |

---

## Les dix-huit tables

### Le référentiel des personnes

#### `cities`

`id`, `name`, `department`, avec `uq_cities_name_department`.

Une ville n'est pas identifiée par son seul nom : plusieurs départements portent des communes
homonymes. La clé naturelle est donc le couple, et c'est elle que l'index d'unicité protège. La
table est alimentée par la migration `0002`, et rien dans l'application ne l'écrit.

#### `users`

`id`, `email` (`CITEXT`, unique), `password_hash`, `role`, `status`, `last_login_at`, `created_at`,
`updated_at`.

L'adresse est en `CITEXT` et non en `TEXT` : personne ne considère que `Claire@…` et `claire@…`
sont deux comptes, et régler la casse dans la base plutôt que dans le code garantit qu'aucun chemin
d'écriture ne peut créer le doublon. `password_hash` porte un PHC complet — l'algorithme et ses
paramètres voyagent avec l'empreinte, ce qui permettra de changer de coût sans migration de données.

La table ne porte **que** l'authentification. Ce qu'est la personne — un employé, un commerçant —
vit dans `employees` et `partners`. C'est ce qui permet à un rôle de changer sans toucher à
l'identité.

#### `employees` et `employers`

`employees` : `id`, `user_id` (unique), `last_name`, `first_name`, `phone`, `created_at`.
`employers` : `id`, `legal_name`, `ifu` (unique), `contact_email`, `contact_phone`, `status`,
`created_at`.

Un employé est toujours adossé à un utilisateur, jamais l'inverse : l'unicité de `user_id` interdit
deux fiches employé pour un même compte. Un employeur, lui, n'a pas d'utilisateur — il n'a pas de
session, il n'existe que comme payeur et comme émetteur de matricules. Son `ifu` est unique mais
nullable, parce qu'un employeur public peut ne pas en avoir.

#### `employment_links`

`id`, `employee_id`, `employer_id`, `employer_ref`, `account_id`, `status`, `started_at`,
`ended_at`, `created_at`.

C'est la table qui rattache un employé à un employeur **et à un compte**. Trois règles y sont
portées par le schéma :

- `uq_active_employment` — un employé n'a qu'un rattachement `active`. L'index est partiel, donc
  l'historique des rattachements terminés reste intact.
- `uq_employer_ref` — un matricule est unique **par employeur, parmi les actifs**. Deux employeurs
  peuvent utiliser le même matricule sans se gêner, et un matricule libéré peut être réattribué.
- `ended_after_started` et `ended_link_has_date` — un rattachement terminé porte forcément sa date
  de fin, et cette date ne précède pas le début.

Le compte est porté par le rattachement et non par l'employé, parce que c'est le rattachement qui
justifie l'existence de l'argent. Le jour où l'employé change d'employeur, la question du solde
résiduel se pose explicitement au lieu de suivre silencieusement.

### Les commerçants

#### `partners`

`id`, `user_id` (unique), `account_id` (unique), `legal_name`, `trade_name`, `category`, `ifu`,
`service_mode`, `website_url`, `city_id`, `district`, `address_line`, `latitude`, `longitude`,
`status`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_reason`.

Deux contraintes méritent d'être lues :

- `physical_needs_city` — un commerçant qui n'est pas exclusivement en ligne doit avoir une ville.
  C'est l'amendement A1 : le catalogue filtre par ville, et une adresse manquante rendrait le
  commerçant invisible sans que personne ne s'en aperçoive.
- `reviewed_is_complete` — `reviewed_by` et `reviewed_at` sont tous deux nuls ou tous deux
  renseignés. Une validation sans validateur, ou sans date, n'est pas une validation.

`idx_partners_catalog` est un index partiel `WHERE status = 'approved'` : le catalogue public ne
lit que les commerçants agréés, l'index ne porte donc que ceux-là.

Les coordonnées géographiques existent en `NUMERIC(9,6)` mais ne sont pas exposées. Elles dorment
en attendant une carte, et le dictionnaire les marque comme telles.

#### `partner_highlights`

`id`, `partner_id`, `placement`, `position`, `created_by`, `created_at`, `removed_at`.

Amendement A2. Une mise en avant se retire en posant `removed_at`, jamais en supprimant la ligne :
qui a mis un commerçant en vitrine, et quand, est une information d'audit. Les deux index partiels
`uq_active_highlight_partner` et `uq_active_highlight_position` — tous deux `WHERE removed_at IS
NULL` — garantissent qu'un commerçant n'occupe qu'une place par vitrine et qu'une position n'est
tenue que par un commerçant. Une place libérée redevient disponible immédiatement.

### L'argent

#### `accounts`

`id`, `owner_type`, `owner_id`, `system_code` (unique), `payment_handle` (unique),
`balance_settled`, `balance_held`, `status`, `version`, `opened_at`, `closed_at`.

C'est la table la plus contrainte du schéma, et c'est voulu.

- `settled_never_negative` et `held_within_settled` sont **exemptées pour `owner_type = 'system'`**.
  C'est l'amendement du jalon 1.0.0 : en partie double, la somme de tous les soldes vaut
  identiquement zéro, donc la contrepartie d'émission `MINISTRY_ISSUANCE` est nécessairement
  négative. Son solde mesure le total émis. Sans cette exemption, aucun rechargement n'était
  possible.
- `held_never_negative` s'applique à tout le monde : une réservation négative n'a aucun sens.
- `system_account_shape` interdit les deux formes bâtardes — un compte système avec un
  propriétaire, un compte d'utilisateur avec un code système.

`owner_id` ne porte **pas** de clé étrangère, parce qu'il désigne tantôt un employé, tantôt un
commerçant. C'est le seul endroit du schéma où j'accepte une référence non contrainte, et
`system_account_shape` en limite les dégâts.

`balance_settled` et `balance_held` sont des **caches**. La vérité est dans `ledger_entries`, et
l'invariant I2 exige qu'ils coïncident. Je les garde parce que recalculer un solde à chaque lecture
de page coûterait une agrégation sur tout l'historique.

`version` est un compteur d'optimistic locking, incrémenté à chaque mouvement. Il n'est pas encore
utilisé pour arbitrer un conflit — les verrous de ligne s'en chargent — mais il rend un conflit
détectable côté lecture.

#### `ledger_operations`

`id`, `kind`, `amount`, `memo`, `created_by`, `occurred_at`, `recorded_at`.

Une opération est le fait métier : un rechargement, un paiement. Elle porte le montant, qui est
**strictement positif** — le sens est porté par les écritures, jamais par le signe du montant.

Deux dates, et la distinction compte : `occurred_at` est le moment où la chose s'est produite dans
le monde — l'instant du scan au comptoir, éventuellement hors ligne — tandis que `recorded_at` est
le moment où nous l'avons enregistrée. Sur un système qui accepte la resynchronisation différée,
les confondre revient à mentir sur l'un des deux.

#### `ledger_entries`

`seq` (`BIGSERIAL`), `operation_id`, `account_id`, `direction`, `amount`, `recorded_at`,
`prev_hash`, `hash` (unique).

Le cœur. Chaque opération produit au moins deux écritures, un débit et un crédit de même montant,
et l'invariant I1 le vérifie. Chaque écriture porte le condensat de la précédente, ce qui rend
toute réécriture du passé détectable : modifier une ligne oblige à recalculer tous les condensats
suivants, ce que les déclencheurs et les privilèges interdisent.

`hash` est unique — deux écritures ne peuvent pas porter le même condensat, ce qui serait le
symptôme d'une collision ou d'une duplication. Les deux `CHECK` d'octets garantissent que la
colonne contient bien un SHA-256 et non un fragment.

Le format exact de la sérialisation avant hachage est figé, et il est décrit dans `decisions.md`.
Toute modification ultérieure invaliderait la chaîne déjà écrite.

`recorded_at` est écrit **explicitement** par l'application et jamais laissé au `DEFAULT now()` :
la valeur hachée et la valeur stockée doivent être la même, à la microseconde près, sinon
`verify_chain` déclare la chaîne rompue.

### Les paiements

#### `payment_tokens`

`jti` (clé primaire), `account_id`, `amount`, `short_code`, `status`, `issued_at`, `expires_at`,
`resolved_at`.

Le `jti` est fourni par l'application et non par la base : il entre dans le payload signé du QR,
et il doit être connu avant l'insertion.

`uq_active_short_code` est partiel — un code court n'est unique que **parmi les jetons actifs**.
C'est ce qui permet de réutiliser l'alphabet réduit indéfiniment sans jamais accumuler des
collisions historiques. La conséquence, importante, est que la recherche par code court ne peut pas
filtrer sur le statut sans casser l'idempotence d'un encaissement rejoué.

`resolved_token_has_date` : dès qu'un jeton quitte `active`, il porte la date à laquelle il l'a
quitté. `token_expires_after_issue` interdit un jeton mort-né.

#### `payments`

`operation_id` (clé primaire), `token_jti` (unique), `partner_id`, `from_account`, `entry_mode`,
`scanned_at`, `synced_at`.

La clé primaire **est** l'identifiant de l'opération du journal : un paiement n'existe pas sans
son écriture double, et la relation est un-pour-un par construction plutôt que par convention.

`token_jti` est **unique**, et c'est cette contrainte, à elle seule, qui porte l'invariant I6 : un
jeton ne peut pas être encaissé deux fois, même si deux requêtes concurrentes franchissent tous les
contrôles applicatifs. C'est aussi ce qui rend la file d'attente hors ligne sûre.

La table ne porte **pas** de montant. Il vit dans `ledger_operations`, parce que le journal fait
autorité sur les sommes et qu'une seconde copie finirait par diverger.

### Les rechargements

#### `topup_batches` et `topups`

`topup_batches` : `id`, `employer_id`, `file_name`, `file_hash`, `line_count`, `total_amount`,
`status`, `uploaded_by`, `uploaded_at`, `validated_at`.
`topups` : `operation_id` (clé primaire), `batch_id`, `employer_id`, `to_account`, `reference`.

`uq_batch_file` — le couple employeur et empreinte du fichier est unique. Réimporter deux fois le
même tableur est l'erreur la plus banale d'un service de paie, et c'est la base qui la refuse.

Comme pour les paiements, `topups.operation_id` est à la fois la clé primaire et la référence à
l'opération. `batch_id` est nullable, parce qu'un rechargement unitaire décidé par un administrateur
n'appartient à aucun lot.

`reference` est la clé d'idempotence d'un rechargement unitaire. La migration `0003` pose
`uq_topup_reference` sur `(employer_id, reference) WHERE reference IS NOT NULL` : jusque-là,
l'idempotence ne tenait que par le verrou consultatif pris par `topup`, et un `INSERT` direct
l'aurait contournée. L'index partiel laisse coexister autant de rechargements sans référence que
nécessaire.

### Les corrections

#### `compensations`

`operation_id` (clé primaire), `original_operation_id`, `reason`, `approved_by`.

Le journal étant en ajout seul, une erreur ne se corrige pas : elle se compense par une opération
inverse qui pointe vers l'originale. `compensation_is_not_self` interdit le cas dégénéré d'une
opération qui se compenserait elle-même. La table est conçue et contrainte ; la logique n'est pas
implémentée, et c'est une coupe assumée.

### L'exploitation

#### `sessions`

`id`, `user_id`, `token_hash` (unique), `ip_address`, `user_agent`, `created_at`, `last_seen_at`,
`expires_at`, `revoked_at`.

Seule l'empreinte du jeton de session est stockée, jamais le jeton : une fuite de la base ne donne
pas de quoi se connecter. Une session se révoque en posant `revoked_at`, elle ne se supprime pas —
savoir qu'une session a été révoquée, et quand, fait partie de l'audit. Les deux index sont
partiels `WHERE revoked_at IS NULL`, puisque seules les sessions vivantes sont interrogées.

#### `api_clients`

`id`, `employer_id`, `client_id` (unique), `secret_hash`, `label`, `status`, `last_used_at`,
`created_at`.

L'accès machine pour l'intégration SIRH. Le secret est haché comme un mot de passe. `employer_id`
est porté par le client lui-même : l'employeur d'une requête d'intégration se déduit du secret
présenté, jamais d'un paramètre de chemin, sans quoi n'importe quel client lirait les soldes de
n'importe quel employeur.

#### `audit_log`

`id`, `actor_id`, `action`, `entity_type`, `entity_id`, `payload`, `ip_address`, `created_at`.

Journal des actes d'administration, en ajout seul comme le ledger. `actor_id` est nullable pour
couvrir les actions du système lui-même. `payload` est un `JSONB` parce que la forme de ce qu'on
consigne dépend de l'action, et qu'une table par type d'acte serait ingérable.

---

## L'immuabilité, et qui a le droit d'écrire

Trois tables sont en **ajout seul** : `ledger_operations`, `ledger_entries` et `audit_log`. La
règle est posée à deux niveaux, et c'est délibéré.

**Les déclencheurs.** La fonction `forbid_mutation()` lève une exception `restrict_violation` sur
tout `UPDATE`, `DELETE` ou `TRUNCATE`. Elle s'applique même à un superutilisateur qui écrirait à la
main dans `psql`, et le message nomme la table et l'opération refusée.

**Les privilèges.** Le rôle applicatif `cartepro_app` reçoit `SELECT, INSERT` sur ces trois tables
et rien d'autre, et les `REVOKE` explicites achèvent de le dire. Sur les quinze autres tables il a
`SELECT, INSERT, UPDATE`, jamais `DELETE`.

Deux niveaux, parce qu'ils échouent différemment : un privilège manquant se contourne en se
connectant avec un autre rôle, un déclencheur non. Et un déclencheur peut être désactivé par le
propriétaire de la table, un privilège non. Ensemble, ils ne laissent pas de chemin simple.

`GRANT USAGE, SELECT ON SEQUENCE ledger_entries_seq_seq` mérite une ligne d'explication : la
séquence est consommée par un `nextval` explicite **avant** l'insertion, parce que le rang entre
dans le condensat et qu'on ne peut donc pas l'apprendre après coup. Une transaction annulée
consomme quand même son rang, la suite des `seq` peut donc comporter des trous. Ce n'est pas un
problème : la continuité de la chaîne est portée par les condensats, jamais par la contiguïté des
rangs.

**Les deux comptes système** sont insérés par la migration elle-même : `MINISTRY_ISSUANCE`, la
contrepartie d'émission dont le solde négatif mesure le total mis en circulation, et
`CLOSURE_FORFEIT`, qui recevra les soldes des comptes clôturés hors délai de grâce.

---

## Les invariants I1 à I9

Ce sont les neuf propriétés que le système doit tenir à tout instant. Elles sont la porte de
sortie du jalon H+6 : `crates/tests/tests/invariants.rs` contient un test par invariant, et tant
qu'ils ne passent pas, rien d'autre ne se construit.

Je les ai écrites en pensant à une seule question : **si celle-ci est fausse, est-ce que de
l'argent est perdu, créé, ou dépensé deux fois ?** Les règles qui ne répondent pas oui à cette
question ne sont pas des invariants, elles sont listées à part en fin de section.

Chacune est vérifiable contre une base réelle, sans passer par l'API.

---

### I1 — La partie double est équilibrée

Pour toute opération du ledger, la somme des écritures au crédit égale la somme des écritures au
débit, et cette somme égale `ledger_operations.amount`. Aucune opération n'a moins de deux
écritures.

```sql
SELECT o.id
FROM ledger_operations o
JOIN ledger_entries e ON e.operation_id = o.id
GROUP BY o.id, o.amount
HAVING sum(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END) <> o.amount
    OR sum(CASE WHEN e.direction = 'debit'  THEN e.amount ELSE 0 END) <> o.amount
    OR count(*) < 2;
```

Cette requête doit toujours renvoyer zéro ligne. C'est l'invariant qui garantit que l'argent ne
naît ni ne disparaît : il est toujours pris quelque part pour être mis ailleurs.

### I2 — Le solde d'un compte est le reflet exact de ses écritures

Pour tout compte, `balance_settled` égale la somme de ses crédits moins la somme de ses débits.
C'est ce que recalcule `ledger/balance.rs::recompute_balance`.

Le solde stocké est un cache : le ledger est la vérité. Si les deux divergent, c'est le solde
qui a tort, et la divergence signifie qu'une écriture a été passée sans mettre à jour le compte,
ou l'inverse — donc qu'une transaction n'était pas atomique.

### I3 — Aucun compte d'utilisateur n'a de solde négatif

Pour tout compte de `owner_type` valant `employee` ou `partner` : `balance_settled >= 0`,
`balance_held >= 0`, et `balance_held <= balance_settled`. **Les comptes système en sont
exemptés.**

La troisième condition est celle qui protège le disponible : `available = settled - held` ne doit
jamais devenir négatif, sinon un employé pourrait générer deux jetons couvrant chacun la totalité
de son solde.

L'exemption des comptes système n'est pas un assouplissement de confort, c'est une nécessité
arithmétique. En partie double équilibrée, chaque crédit a un débit jumeau du même montant : la
somme de tous les soldes vaut donc identiquement zéro. Si tous les comptes devaient être positifs
ou nuls, ils vaudraient tous zéro et le système ne pourrait contenir aucun argent. Vérifié sur
une base réelle après deux rechargements :

```
CLOSURE_FORFEIT    :     0
MINISTRY_ISSUANCE  : -8000
employé A          :  8000
employé B          :     0
─────────────────────────────
somme              :     0
```

Pré-créditer `MINISTRY_ISSUANCE` ne résoudrait rien : pour le créditer par une opération du
ledger il faut débiter autre chose du même montant, ce qui déplace le solde négatif sans le
supprimer. Écrire son solde directement au seed casserait I2 de façon permanente.

Le solde négatif du compte d'émission n'est donc pas un découvert : **c'est la mesure du total
émis**. Personne ne dépense depuis ce compte — aucun jeton de paiement ne s'y rattache et
`authorize` ne le regarde jamais. La propriété de sûreté que I3 protège vraiment, c'est qu'on ne
laisse jamais dépenser de l'argent qui n'existe pas, et cela ne concerne que les comptes depuis
lesquels on peut dépenser.

> **Plafonner l'émission**, si le besoin s'en fait sentir, relève d'une règle métier vérifiée dans
> `funding/topup.rs` avant de poster l'opération — jamais d'une contrainte de solde, qui
> réintroduirait le blocage.

### I4 — Les réservations correspondent aux jetons actifs

Pour tout compte, `balance_held` égale la somme des `amount` des `payment_tokens` de statut
`active` rattachés à ce compte. C'est ce que recalcule `recompute_held`.

Si `held` est trop haut, l'employé ne peut plus dépenser de l'argent qu'il possède : une
réservation n'a pas été libérée à l'expiration ou à l'annulation. Si `held` est trop bas, il peut
dépenser deux fois.

### I5 — La chaîne de hachage est continue et vérifiable

Pour toute écriture de rang `seq`, `prev_hash` est le `hash` de l'écriture de rang immédiatement
inférieur, et `hash` est exactement la valeur que recalcule `entry_hash(...)` à partir des champs
de la ligne. La toute première écriture a `prev_hash = GENESIS_HASH`.

`verify_chain(conn, from_seq)` renvoie le premier `seq` incohérent. C'est l'invariant qui rend une
falsification détectable : modifier une écriture passée oblige à recalculer tous les hachages
suivants, ce que les privilèges et les déclencheurs de I8 interdisent.

### I6 — Un jeton n'est encaissé qu'une seule fois

`payments.token_jti` est unique. Un jeton quitte l'état `active` pour exactement un état terminal
— `consumed`, `expired` ou `cancelled` — et `resolved_at` est alors renseigné. Un jeton `consumed`
a exactement un paiement associé ; un jeton dans tout autre état n'en a aucun.

C'est la protection contre le double encaissement, et elle doit tenir même quand deux partenaires
scannent le même QR au même instant : le verrou de `settle` en dépend.

### I7 — Un jeton expiré n'est jamais encaissé

Pour tout paiement, l'instant de règlement retenu par le serveur est antérieur à
`payment_tokens.expires_at` du jeton correspondant.

L'expiration inscrite dans le QR est indicative. La seule qui fait foi est celle que le serveur
vérifie contre sa propre horloge au moment du règlement (décision 2). Cet invariant se teste avec
`FixedClock` : on avance l'horloge au-delà de `expires_at` et le règlement doit être refusé.

### I8 — Le ledger et l'audit sont en ajout seul

`UPDATE`, `DELETE` et `TRUNCATE` sur `ledger_entries`, `ledger_operations` et `audit_log`
échouent. La protection est en deux couches : les privilèges refusent l'opération au rôle
`cartepro_app`, et la fonction `forbid_mutation()` la refuse au propriétaire de la base, qui
contourne les privilèges.

Une erreur ne se corrige jamais par une modification : elle se corrige par une compensation, une
opération inverse qui laisse la trace des deux (décision 4).

### I9 — Aucune ligne n'est supprimée, seulement marquée

Aucune ligne n'est retirée de `employment_links`, `partner_highlights`, `sessions`, `accounts`,
`partners` ni `users`. La fin de vie passe par une colonne dédiée : `ended_at`, `removed_at`,
`revoked_at`, `closed_at`, ou un changement de `status`.

C'est la règle R6. Elle a une conséquence directe sur les index : l'unicité porte toujours sur les
lignes actives via un index partiel, jamais sur la table entière, pour que l'historique reste
intact sans bloquer une recréation.

---

## Ce que le schéma porte déjà, et qui n'est pas dans les neuf

Ces règles sont réelles et testées, mais elles relèvent de la cohérence du référentiel, pas de la
sûreté monétaire. Elles n'arrêtent pas le projet si elles cassent, et la base les refuse d'elle-même.

| Règle | Porté par |
|---|---|
| Un employé n'a qu'un rattachement actif | `uq_active_employment` |
| Un matricule est unique par employeur, parmi les rattachements actifs | `uq_employer_ref` |
| Un `short_code` actif est unique | `uq_active_short_code` |
| Un partenaire n'occupe qu'une place par emplacement de mise en avant | `uq_active_highlight_partner` |
| Une position de mise en avant n'est occupée que par un partenaire | `uq_active_highlight_position` |
| Un partenaire non exclusivement en ligne a une ville | `physical_needs_city` |
| Un même fichier n'est importé qu'une fois par employeur | `uq_batch_file` |
| Les empreintes font 32 octets | `hash_is_32_bytes`, `prev_hash_is_32_bytes`, `batch_file_hash_is_32_bytes` |
| Un compte système a un code et pas de propriétaire, et réciproquement | `system_account_shape` |
| Les montants d'opération, d'écriture et de jeton sont strictement positifs | trois `CHECK` |
