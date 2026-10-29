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
| `0014_ouvertures` | Table `ouvertures` : date d'ouverture de chaque magasin (ancienneté pour les valeurs par défaut des tickets et du panier, rythme de sortie écarté juste après l'ouverture) ; lue sur les magasins du compte, écrite par le Directeur seul | 28/10/2026 |
| `0008_quadrimestres` | Table `quadrimestres` : achats, variation de stock, charges externes, impôts et taxes, personnel et trésorerie tous les 4 mois, saisis par le Directeur, le RR, le Coach et le franchisé sur leurs magasins | 28/10/2026 |
| `0009_parts_realisees` | Table `parts_realisees` : part de l'année réalisée saisie par univers pour l'atterrissage sans réel de l'an dernier, saisie par le Directeur, le RR, le Coach et le franchisé sur leurs magasins | 28/10/2026 |
| `0010_correspondances_fec` | Table `correspondances_fec` : rubrique choisie pour un compte du FEC quand le cabinet du magasin le range autrement que le plan comptable, gardée pour les imports suivants ; Directeur, RR, Coach et franchisé sur leurs magasins | 28/10/2026 |
| `0011_echanges_budget` | Tables `echanges_budget` (messages par sujet sur le budget d'un magasin, auteur posé par la base, retiré par son auteur seul) et `versions_budget` (une version à chaque changement de statut, de base ou d'ajustements, écrite par un déclencheur) ; fonction `mon_nom()` | 28/10/2026 |
| `0012_actions` | Table `actions` : plan d'action relié aux alertes (type, action, responsable, échéance, statut, mesure de départ) ; Directeur partout, RR et Coach sur leurs magasins, franchisé en lecture qui ne change que le statut | 28/10/2026 |
| `0013_cave_bar_separes` | `reel_du_compte` donne aussi le CA TTC et les tickets de la Cave et du Bar séparés, pour leurs paniers dans la vue réseau ; aucune table ni règle d'accès nouvelle | 28/10/2026 |
| `0015_versions_et_equipe` | Colonnes `heures_saisie` et `enveloppe` de `equipe` (heures saisies au mois, primes d'équipe sans salarié) ; table `versions_nommees` (versions du budget enregistrées sous un nom), lue sur les magasins du compte, ajoutée par le Directeur ou le franchisé sur ses magasins, retirée par le Directeur ou son auteur | 28/10/2026 |
| `0016_alertes_commerciales` | Types d'alerte `tickets` et `panier` acceptés dans `actions` ; règles d'accès inchangées | 28/10/2026 |
| `0017_extras` | Colonne `taux_horaire` de `equipe` : les extras deviennent un poste de l'équipe (heures moyennes × taux horaire) ; règles d'accès inchangées | 29/10/2026 |
| `0018_validation_rr` | Le RR valide ou rouvre le budget de ses magasins (statut et photo des hypothèses seulement) ; déclencheur `garde_budget` et règle de modification de `budgets` | 29/10/2026 |
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
