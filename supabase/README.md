# Base Supabase : migrations du pilotage

Même base que l'app réseau ; tout ce qui appartient au pilotage est dans le schéma `pilotage`, décrit par `migrations/`,
une migration par changement, numérotée dans l'ordre où elle s'applique. Carte : [docs/base-de-donnees.md](../docs/base-de-donnees.md).

| Migration | Contenu | Date |
| --- | --- | --- |
| `0001_socle_pilotage` | Schéma `pilotage`, `mes_magasins()`, paramètres réseau, budgets et leur circuit, réel mensuel, `magasins_du_compte()`, journal | 26/10/2026 |
| `0002_hypotheses_par_niveaux` | Groupes de magasins, cibles du réseau et des groupes, base et ajustements du budget (`garde_base`), `budgets_du_compte()` | 26/10/2026 |
| `0003_reel_annee` | Réel de l'année : CA TTC, tickets par univers (`reel_tickets`), codes caisse, saisie ouverte au RR, au Coach et au franchisé sur leurs magasins, `remplacer_reel()` | 27/10/2026 |
| `0004_equipe` | Équipe des magasins par poste (heures, brut, primes, entrée et sortie), saisie par le Directeur, le RR, le Coach et le franchisé sur leurs magasins | 27/10/2026 |
| `0005_frais` | Frais des magasins ligne par ligne (€ par an ou part du CA), emprunts et amortissements, saisis par le Directeur, le RR, le Coach et le franchisé sur leurs magasins | 27/10/2026 |
| `0007_filtre_rr` | `reel_du_compte` donne aussi au Directeur les Responsables Régionaux de chaque magasin, pour filtrer la vue réseau ; aucune table ni règle d'accès nouvelle | 28/10/2026 |
| `0008_quadrimestres` | Table `quadrimestres` : achats, variation de stock, charges externes, impôts et taxes, personnel et trésorerie tous les 4 mois, saisis par le Directeur, le RR, le Coach et le franchisé sur leurs magasins | 28/10/2026 |
| `0009_parts_realisees` | Table `parts_realisees` : part de l'année réalisée saisie par univers pour l'atterrissage sans réel de l'an dernier, saisie par le Directeur, le RR, le Coach et le franchisé sur leurs magasins | 28/10/2026 |
| `0006_suivi_reseau` | Fonction `reel_du_compte` : réel de tous les magasins du compte totalisé par mois, pour la vue réseau ; aucune table ni règle d'accès nouvelle | 27/10/2026 |

## Passer une migration

1. Supabase > SQL Editor : coller le fichier entier, exécuter. Les migrations sont réexécutables.
2. Vérifier : `SELECT * FROM pilotage.journal_migrations ORDER BY numero;`
3. Première fois seulement : Settings > API > Exposed schemas, ajouter `pilotage`.

Toujours dans l'ordre des numéros. Repasser une ancienne migration seule ne rouvre jamais un accès, mais peut en
resserrer un : `0001` rejouée seule remet l'écriture du réel au Directeur seul ; repasser alors `0003`.

## Tester sans toucher à la base en ligne

`npm run test:base` rejoue les migrations deux fois, dans l'ordre inverse, puis de nouveau dans l'ordre sur un PostgreSQL local vide, après
`tests/supabase_minimal.sql` (ce que fournit Supabase) et `tests/dependances_reseau.sql` (fonctions et tables de l'app
réseau dont le pilotage dépend, copiées de ses migrations 0004 et 0005), puis vérifie `tests/regles_acces.sql`.
