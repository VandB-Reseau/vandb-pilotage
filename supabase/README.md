# Base Supabase : migrations du pilotage

Même base que l'app réseau ; tout ce qui appartient au pilotage est dans le schéma `pilotage`, décrit par `migrations/`,
une migration par changement, numérotée dans l'ordre où elle s'applique. Carte : [docs/base-de-donnees.md](../docs/base-de-donnees.md).

| Migration | Contenu | Date |
| --- | --- | --- |
| `0001_socle_pilotage` | Schéma `pilotage`, `mes_magasins()`, paramètres réseau, budgets et leur circuit, réel mensuel, `magasins_du_compte()`, journal | 26/10/2026 |
| `0002_hypotheses_par_niveaux` | Groupes de magasins, cibles du réseau et des groupes, base et ajustements du budget (`garde_base`), `budgets_du_compte()` | 26/10/2026 |

## Passer une migration

1. Supabase > SQL Editor : coller le fichier entier, exécuter. Les migrations sont réexécutables.
2. Vérifier : `SELECT * FROM pilotage.journal_migrations ORDER BY numero;`
3. Première fois seulement : Settings > API > Exposed schemas, ajouter `pilotage`.

## Tester sans toucher à la base en ligne

`npm run test:base` rejoue les migrations deux fois puis dans l'ordre inverse sur un PostgreSQL local vide, après
`tests/supabase_minimal.sql` (ce que fournit Supabase) et `tests/dependances_reseau.sql` (fonctions et tables de l'app
réseau dont le pilotage dépend, copiées de ses migrations 0004 et 0005), puis vérifie `tests/regles_acces.sql`.
