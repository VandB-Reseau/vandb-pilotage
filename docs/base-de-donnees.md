# Base de données du pilotage

Même base Supabase que l'app réseau. Le pilotage n'écrit que dans le schéma `pilotage` ; il lit l'app réseau par ses
fonctions (`mon_role()`, `est_directeur()`, `magasins_visibles()`, `mes_magasins()`, `json_sur()`) et ses tables `perimetre_equipe`
et `app_config` (lue seulement : fiche des Responsables Régionaux, clé `drs_data`).

Mis à jour le 28/10/2026 (migration `0007`).

## Principes

- **Rôle lu dans la base** (fonctions de l'app réseau), jamais dans le seul jeton de connexion.
- **Un magasin est identifié par son nom** (`store_name`), comme dans l'app réseau.
- **Magasins du compte** (`pilotage.mes_magasins()`) : Directeur, tous (`perimetre_equipe` et magasins ayant un budget) ;
  Coach et RR, leur périmètre (`magasins_visibles()`) ; franchisé, ses magasins (`mes_magasins()`) ; sinon aucun.
- **Montants HT**, taux en fractions (0,02 = 2 %).

## Tables

| Table | Contenu | Clé | Lecture | Écriture |
| --- | --- | --- | --- | --- |
| `parametres_reseau` | Paramètres de l'année : `valeur` jsonb (`tauxRedevance`, `tauxPublicite`, `impot`, `tvaPanier`, `charges` : taux de charges patronales par catégorie et paramètres de la réduction générale ; `tresorerie` : délais de paiement en mois, TVA des ventes, des achats et des frais, `tvaTrimestrielle`, `partCotisations`) | `annee` | Comptes ouverts | Directeur |
| `budgets` | Budget d'un magasin pour une année : `statut` (`propose`, `en_discussion`, `valide`), `base` (réalisé importé du prévisionnel), `ajustements` (écarts du magasin aux cibles, format `Cibles`, dont saisonnalité, travaux et `tresorerieDepart`), `proposition` (base proposée par le siège), `hypotheses` (hypothèses calculées au dernier enregistrement, figées à la validation), `valide_le` | `store_name`, `annee` | Magasins du compte | Création et suppression : Directeur. Modification : Directeur, franchisé sur ses magasins |
| `reel_mensuel` | Réel par mois (1er du mois), univers (`cave`, `bar`, `exterieur`) et famille : `ca_ht`, `ca_ttc`, `marge_ht` (marge théorique de la caisse), `maj_par`. La colonne `tickets` de `0001` n'est plus utilisée (voir `reel_tickets`) | `store_name`, `mois`, `univers`, `famille` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `reel_tickets` | Tickets par mois et univers (un ticket ne se compte pas par famille) : `tickets`, `maj_par` | `store_name`, `mois`, `univers` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `codes_caisse` | Code magasin de la caisse (fichiers de la DSI) → nom du magasin, un code par magasin | `code` | Équipe | Directeur |
| `equipe` | Équipe d'un magasin, une ligne par poste sans nom : `poste`, `categorie` (`employe`, `agent_maitrise`, `cadre`, `apprenti`, `gerant_tns`), `heures_hebdo`, `brut_mensuel` (rémunération pour un gérant TNS), `primes` (`[{mois, montant}]`), `entree` et `sortie` (1er du mois, facultatives), `maj_le`, `maj_par` | `id` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `frais` | Frais annuels d'un magasin, une ligne par code de la grille (`src/moteur/parametres.ts`) : `code`, `libelle`, `rubrique` (rubriques de la grille, plus `hors_exploitation` pour `amortissements`, `interets`, `remboursement_capital`), `annuel` (€ par an) ou `taux_ca` (part du CA HT), l'un ou l'autre, `maj_le`, `maj_par` | `store_name`, `code` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `groupes` | Groupes libres de magasins (centre-ville, zone commerciale…) : `nom` | `id` | Équipe | Directeur |
| `groupe_magasins` | Groupe d'un magasin (un au plus) | `store_name` | Équipe | Directeur |
| `cibles_reseau` | Cibles du réseau pour l'année : `valeur` (format `Cibles`) | `annee` | Équipe | Directeur |
| `cibles_groupe` | Cibles d'un groupe pour l'année : `valeur` (format `Cibles`) | `groupe_id`, `annee` | Équipe | Directeur |
| `journal_migrations` | Migrations du pilotage passées | `numero` | Directeur | Migrations |

## Circuit du budget (déclencheur `garde_budget`)

- Le Directeur crée le budget (proposition du siège) et peut tout modifier ; passer en `valide` date `valide_le`.
- Un franchisé modifie les `hypotheses` de ses magasins : le budget passe `en_discussion`. Il ne touche ni à la
  `proposition`, ni au statut `valide`, ni à un budget déjà validé.
- Un franchisé modifie les `ajustements` de ses magasins (même effet) ; la `base` n'est modifiable que par le Directeur
  (déclencheur `garde_base`, distinct pour que rejouer `0001` seule ne le retire pas).
- Coachs et RR lisent sans écrire. Le franchisé ne lit pas les tables de groupes et de cibles : il les reçoit par
  `budgets_du_compte()`, limitées au réseau et au groupe de ses magasins.

## Fonctions

| Fonction | Rôle |
| --- | --- |
| `pilotage.mes_magasins()` | Magasins du compte connecté |
| `pilotage.magasins_du_compte(annee)` | Magasins du compte avec statut, hypothèses et date du budget de l'année (lot 0, remplacée dans l'app par la suivante) |
| `pilotage.remplacer_reel(ventes, tickets)` | Import ou saisie du réel : vide puis réécrit chaque couple magasin et mois reçu (ventes et tickets à part). Droits de l'appelant (`SECURITY INVOKER`) : une ligne hors périmètre fait échouer tout l'appel. Renvoie le nombre de lignes de ventes |
| `pilotage.reel_du_compte(annee)` | `{ mois, coachs, rrs }` : réel des magasins du compte (mêmes magasins que la lecture du réel), totalisé par magasin et par mois pour l'année et la précédente (`ca`, `marge`, `ca_marge` = CA des lignes dont la marge est connue, `ttc`, `tickets`) ; `coachs` : Coach de chaque magasin, pour le Directeur et le RR seulement ; `rrs` : noms des Responsables Régionaux de chaque magasin (identifiants de `perimetre_equipe.rrs` reliés à la fiche `drs_data` d'`app_config`), pour le Directeur seulement (0007). Sert à la vue réseau |
| `pilotage.budgets_du_compte(annee)` | `{ magasins, reseau, groupes }` : budgets du compte (base, ajustements, hypothèses, groupe), cibles du réseau, groupes utiles au compte avec leurs cibles |

## Rejouer les migrations

Rejouer `0001` seule remet les règles du lot 0 sur `reel_mensuel` (écriture par le Directeur seul) : c'est plus strict,
jamais plus ouvert. Repasser ensuite `0003` pour rouvrir la saisie à l'équipe et aux franchisés.

## Format des hypothèses (`budgets.hypotheses`)

Objet `Hypotheses` de `src/moteur/types.ts` : année, mois réalisés, CA mensuel de référence (12 mois), part réalisée
par univers (facultative), familles (univers, famille, CA réalisé, marge réalisée, évolution, marge visée, démarque), flux Cave et
Bar, personnel (salaires mensuels, gérance, heures), lignes de frais (grille de `src/moteur/parametres.ts`),
amortissements, intérêts, capital remboursé, déficit reportable ; facultatifs : `poidsMois` (saisonnalité du magasin,
12 parts) et `travaux` (`activite` des 12 mois de 0 à 1, `gain` après réouverture, `investissement`, `dureeAmortissement` en années).

## Format des charges (`parametres_reseau.valeur.charges`)

Objet `ParametresCharges` de `src/moteur/equipe.ts` : `taux` par catégorie (part du brut, avant réduction) et `reduction`
(`smicAnnuel`, `tmin`, `tdelta`, `puissance`, `horsReduction`). Une valeur absente reprend celle par défaut
(`src/moteur/parametres.ts`, valeurs 2026). Le budget d'un magasin qui a une équipe porte aussi `equipe` et
`hausseSalaires` dans ses hypothèses : un budget validé garde l'équipe du jour de la validation. De même, les frais
enregistrés dans `frais` remplacent ceux de la base du budget tant qu'il n'est pas validé.

## Format des cibles (`cibles_reseau.valeur`, `cibles_groupe.valeur`, `budgets.ajustements`)

Objet `Cibles` de `src/moteur/cibles.ts`, chaque clé facultative : `evolutionUnivers` (par univers), `evolutionFamille`,
`margeFamille` et `demarqueFamille` (par famille, clé `univers/famille`, par exemple `cave/Bière`), `hausseSalaires`, `inflationFrais`,
`evolutionFlux` (`cave`, `bar`) ; au niveau du magasin seulement, `poidsMois` (12 parts, total 100 %) et `travaux`. Une clé absente reprend le niveau au-dessus : magasin, puis groupe, puis réseau, puis le
réalisé du magasin (évolution nulle, marge réalisée, démarque nulle). Lot 8 : ces clés vivent dans le JSON existant, sans migration.
