# Implementations simulees

Chaque fichier ici implemente une interface de `src/lib/services`.

Regle : la forme des donnees renvoyees est identique a celle de l'API reelle.
Un mock qui renvoie une structure differente cree une architecture qui ne
correspondra pas a la production, et le raccordement au backend devient une
reecriture au lieu d'un changement de variable d'environnement.

Les mocks doivent aussi savoir echouer : solde insuffisant, code expire,
double encaissement. Ce sont ces cas qui font les vrais ecrans.
