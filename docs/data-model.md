<!--
TODO: write the detailed schema — the 13 enums, every table with its columns, CHECK constraints,
partial unique indexes and triggers, and the rationale behind each choice. The invariants section
below is written. The migration must match this file exactly.
-->

# CartePro — Modèle de données

> Compagnon de `docs/data-dictionary.md` (le quoi) et de `migrations/0001_schema.sql` (le comment).
> Cette première version ne couvre que les invariants. Le détail du schéma reste à rédiger.

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
