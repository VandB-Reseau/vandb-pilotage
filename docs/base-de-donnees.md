# Base de données du pilotage

Même base Supabase que l'app réseau. Le pilotage n'écrit que dans le schéma `pilotage` ; il lit l'app réseau par ses
fonctions (`mon_role()`, `est_directeur()`, `magasins_visibles()`, `mes_magasins()`) et sa table `perimetre_equipe`.

Mis à jour le 26/10/2026 (migration `0001`).

## Principes

- **Rôle lu dans la base** (fonctions de l'app réseau), jamais dans le seul jeton de connexion.
- **Un magasin est identifié par son nom** (`store_name`), comme dans l'app réseau.
- **Magasins du compte** (`pilotage.mes_magasins()`) : Directeur, tous (`perimetre_equipe` et magasins ayant un budget) ;
  Coach et RR, leur périmètre (`magasins_visibles()`) ; franchisé, ses magasins (`mes_magasins()`) ; sinon aucun.
- **Montants HT**, taux en fractions (0,02 = 2 %).

## Tables

| Table | Contenu | Clé | Lecture | Écriture |
| --- | --- | --- | --- | --- |
| `parametres_reseau` | Paramètres de l'année : `valeur` jsonb (`tauxRedevance`, `tauxPublicite`, `impot`, `tvaPanier`) | `annee` | Comptes ouverts | Directeur |
| `budgets` | Budget d'un magasin pour une année : `statut` (`propose`, `en_discussion`, `valide`), `proposition` (hypothèses du siège), `hypotheses` (retenues), `valide_le` | `store_name`, `annee` | Magasins du compte | Création et suppression : Directeur. Modification : Directeur, franchisé sur ses magasins |
| `reel_mensuel` | Réel par mois, univers (`cave`, `bar`, `exterieur`) et famille : `ca_ht`, `marge_ht`, `tickets` | `store_name`, `mois`, `univers`, `famille` | Magasins du compte | Directeur (import) |
| `journal_migrations` | Migrations du pilotage passées | `numero` | Directeur | Migrations |

## Circuit du budget (déclencheur `garde_budget`)

- Le Directeur crée le budget (proposition du siège) et peut tout modifier ; passer en `valide` date `valide_le`.
- Un franchisé modifie les `hypotheses` de ses magasins : le budget passe `en_discussion`. Il ne touche ni à la
  `proposition`, ni au statut `valide`, ni à un budget déjà validé.
- Coachs et RR lisent sans écrire.

## Fonctions

| Fonction | Rôle |
| --- | --- |
| `pilotage.mes_magasins()` | Magasins du compte connecté |
| `pilotage.magasins_du_compte(annee)` | Magasins du compte avec statut, hypothèses et date du budget de l'année |

## Format des hypothèses (`budgets.hypotheses`)

Objet `Hypotheses` de `src/moteur/types.ts` : année, mois réalisés, CA mensuel de référence (12 mois), part réalisée
par univers (facultative), familles (univers, famille, CA réalisé, marge réalisée, évolution, marge visée), flux Cave et
Bar, personnel (salaires mensuels, gérance, heures), lignes de frais (grille de `src/moteur/parametres.ts`),
amortissements, intérêts, capital remboursé, déficit reportable.
