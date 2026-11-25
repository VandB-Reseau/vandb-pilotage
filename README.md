# V and B Pilotage (page de renvoi)

**Le projet vit désormais dans [VandB-Reseau/vandb-reseau](https://github.com/VandB-Reseau/vandb-reseau).**

Le pilotage financier des magasins (budgets, réel de caisse, trésorerie, simulateurs) a été fusionné dans l'app réseau
le 03/11/2026 (menu « Budgets », onglet « Budget » de la fiche magasin), puis les deux dépôts ont été réunis le
25/11/2026 :

- le code est dans `src/pilotage/` du dépôt réseau ;
- les migrations du schéma `pilotage` (0001 à 0038) sont dans `supabase/migrations/pilotage/` du dépôt réseau, à
  l'identique, et toute nouvelle migration prend un numéro de la série unique de ce dépôt ;
- la documentation (architecture, base, règles métier, mise en ligne, tests) est dans `docs/` du dépôt réseau.

Ce dépôt ne publie plus qu'une page (`site/index.html`) : l'ancienne adresse
https://vandb-reseau.github.io/vandb-pilotage/ et ses liens (`#/magasins/<nom>/<partie>`, `#/reseau`, `#/parametres`…)
mènent à la même page dans https://vandb-reseau.github.io/vandb-reseau/.

L'historique complet de l'ancienne app reste dans l'historique Git de ce dépôt (dernière version complète : commit
`2790878`, demande de fusion #59). Ne plus rien y développer.
