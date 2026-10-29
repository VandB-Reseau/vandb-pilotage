# Base de données du pilotage

Même base Supabase que l'app réseau. Le pilotage n'écrit que dans le schéma `pilotage` ; il lit l'app réseau par ses
fonctions (`mon_role()`, `est_directeur()`, `magasins_visibles()`, `mes_magasins()`, `json_sur()`) et ses tables `perimetre_equipe`
et `app_config` (lue seulement : fiche des Responsables Régionaux, clé `drs_data`).

Mis à jour le 29/10/2026 (migration `0017`).

## Principes

- **Rôle lu dans la base** (fonctions de l'app réseau), jamais dans le seul jeton de connexion.
- **Un magasin est identifié par son nom** (`store_name`), comme dans l'app réseau.
- **Magasins du compte** (`pilotage.mes_magasins()`) : Directeur, tous (`perimetre_equipe` et magasins ayant un budget) ;
  Coach et RR, leur périmètre (`magasins_visibles()`) ; franchisé, ses magasins (`mes_magasins()`) ; sinon aucun.
- **Montants HT**, taux en fractions (0,02 = 2 %).

## Tables

| Table | Contenu | Clé | Lecture | Écriture |
| --- | --- | --- | --- | --- |
| `parametres_reseau` | Paramètres de l'année : `valeur` jsonb (`tauxRedevance`, `tauxPublicite`, `impot`, `tvaPanier`, `charges` : taux de charges patronales par catégorie et paramètres de la réduction générale ; `tresorerie` : délais de paiement en mois, TVA des ventes, des achats et des frais, `tvaTrimestrielle`, `partCotisations`, `consignes` : part des achats par univers, `ecoulement` et `remboursement` en mois, `demarque` (part des consignes jamais remboursée, en charge externe du budget ; 0 si absente), `avanceExterieur` (mois d'avance des achats Extérieur sur la vente), `operations` (`[{nom, mois, moisPaiement, part}]` : opérations du réseau dont une part des achats Cave et Bar du mois est payée à un autre mois) ; `alertes` : seuils `ecartCA`, `baisseMarge` en points, `moisRetard`, `tresorerie` en euros) | `annee` | Comptes ouverts | Directeur |
| `budgets` | Budget d'un magasin pour une année : `statut` (`propose`, `en_discussion`, `valide`), `base` (réalisé importé du prévisionnel), `ajustements` (écarts du magasin aux cibles, format `Cibles`, dont saisonnalité, travaux et `tresorerieDepart`), `proposition` (base proposée par le siège), `hypotheses` (hypothèses calculées au dernier enregistrement, figées à la validation), `valide_le` | `store_name`, `annee` | Magasins du compte | Création et suppression : Directeur. Modification : Directeur, franchisé sur ses magasins |
| `reel_mensuel` | Réel par mois (1er du mois), univers (`cave`, `bar`, `exterieur`) et famille : `ca_ht`, `ca_ttc`, `marge_ht` (marge théorique de la caisse), `maj_par`. La colonne `tickets` de `0001` n'est plus utilisée (voir `reel_tickets`) | `store_name`, `mois`, `univers`, `famille` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `reel_tickets` | Tickets par mois et univers (un ticket ne se compte pas par famille) : `tickets`, `maj_par` | `store_name`, `mois`, `univers` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `codes_caisse` | Code magasin de la caisse (fichiers de la DSI) → nom du magasin, un code par magasin | `code` | Équipe | Directeur |
| `equipe` | Équipe d'un magasin, une ligne par poste sans nom : `poste`, `categorie` (`employe`, `agent_maitrise`, `cadre`, `apprenti`, `gerant_tns`), `heures_hebdo`, `brut_mensuel` (rémunération pour un gérant TNS), `primes` (`[{mois, montant}]`), `entree` et `sortie` (1er du mois, facultatives), `heures_saisie` (`semaine` ou `mois`, unité choisie à la saisie ; le calcul part de `heures_hebdo`) et `enveloppe` (primes d'équipe sans salarié : heures et brut à 0) (0015), `taux_horaire` (extras : taux horaire brut, `brut_mensuel` = taux × heures moyennes du mois ; vide pour un poste classique) (0017), `maj_le`, `maj_par` | `id` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `frais` | Frais annuels d'un magasin, une ligne par code de la grille (`src/moteur/parametres.ts`) : `code`, `libelle`, `rubrique` (rubriques de la grille, plus `hors_exploitation` pour `amortissements`, `interets`, `remboursement_capital`), `annuel` (€ par an) ou `taux_ca` (part du CA HT), l'un ou l'autre, `maj_le`, `maj_par` | `store_name`, `code` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `quadrimestres` | Chiffres comptables d'un magasin tous les 4 mois (1 : janvier à avril, 2 : mai à août, 3 : septembre à décembre), saisis ou importés : `achats` de marchandises, `variation_stock` (stock de fin − stock de début), `charges_externes` (redevance et publicité comprises), `impots_taxes`, `personnel`, `tresorerie` en fin de période, `maj_le`, `maj_par`. Achats et charges positifs. Le CA vient de la caisse ; marge réelle et EBE sont calculés par l'app (0008) | `store_name`, `annee`, `quadrimestre` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `parts_realisees` | Part de l'année réalisée à fin du dernier mois, saisie par univers (`cave`, `bar`, `exterieur`) pour l'atterrissage d'un magasin sans réel de l'an dernier : `part` (0 à 1), `maj_le`, `maj_par`. Pas de ligne : calcul automatique (0009) | `store_name`, `annee`, `univers` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `correspondances_fec` | Rubrique d'un compte de charges du FEC propre au magasin (`achats`, `variation_stock`, `charges_externes`, `impots_taxes`, `personnel`, `hors_ebe`), quand son cabinet le range autrement que les racines du plan comptable : `maj_le`, `maj_par`. Pas de ligne : correspondance par défaut. Le FEC n'est pas enregistré (0010) | `store_name`, `compte` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `echanges_budget` | Message sur le budget d'un magasin : `sujet` (`general`, `ca`, `marge`, `personnel`, `frais`, `travaux`, `tresorerie`), `texte` (2 000 caractères au plus), `auteur`, `auteur_role`, `auteur_nom` et `cree_le` posés par la base (0011) | `id` ; index `store_name`, `annee`, `cree_le` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins ; retrait par l'auteur seul |
| `versions_budget` | Version du budget à sa création et à chaque changement de statut, de base ou d'ajustements : `statut`, `base`, `ajustements`, auteur, rôle, nom, date (0011) | `id` ; index `store_name`, `annee`, `cree_le` | Magasins du compte | Déclencheur `versions_budget_trace` seul |
| `versions_nommees` | Version du budget enregistrée sous un nom pour comparer : `nom` (1 à 80 caractères), `base` (hypothèses avec l'équipe et les frais du jour), `ajustements`, auteur, rôle, nom et date posés par le déclencheur `versions_nommees_auteur` (0015) | `id` ; index `store_name`, `annee` | Magasins du compte | Ajout : Directeur, franchisé sur ses magasins ; retrait : Directeur ou auteur |
| `actions` | Action du plan d'un magasin : `type_alerte` (`ca`, `marge`, `reel`, `tresorerie`, `autre` ; `tickets` et `panier` depuis 0016), `intitule`, `responsable` (`franchise`, `coach`, `rr`, `directeur`), `echeance`, `statut` (`a_faire`, `faite`, `abandonnee`), `annee`, `depart` et `mois_depart` (mesure de l'alerte le jour de l'action), auteur et dates posés par la base (0012) | `id` ; index `store_name`, `statut` | Magasins du compte | Directeur partout ; RR et Coach sur leurs magasins ; le franchisé ne change que le statut |
| `ouvertures` | Date d'ouverture d'un magasin, le 1er du mois : `ouverture`, `maj_le`, `maj_par`. Donne son ancienneté (année 1, 2, 3, 4 et plus) et écarte le rythme de sortie des 2 mois qui suivent l'ouverture (0014) | `store_name` | Magasins du compte | Directeur |
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
| `pilotage.reel_du_compte(annee)` | `{ mois, coachs, rrs }` : réel des magasins du compte (mêmes magasins que la lecture du réel), totalisé par magasin et par mois pour l'année et la précédente (`ca`, `marge`, `ca_marge` = CA des lignes dont la marge est connue, `ttc`, `tickets`, et pour la Cave et le Bar séparés `ttc_cave`, `ttc_bar`, `tickets_cave`, `tickets_bar` depuis 0013) ; `coachs` : Coach de chaque magasin, pour le Directeur et le RR seulement ; `rrs` : noms des Responsables Régionaux de chaque magasin (identifiants de `perimetre_equipe.rrs` reliés à la fiche `drs_data` d'`app_config`), pour le Directeur seulement (0007). Sert à la vue réseau |
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
Lot 24, facultatifs : `sortie` (par univers `cave`, `bar` : `ca` HT des 4 derniers mois réalisés, leur `poids` dans la
saisonnalité, mois `de` et `a`), `rythme` (par univers : `auto`, `applique`, `ignore` ; absent, le rythme de sortie ne
s'applique pas, c'est le cas de l'atterrissage), `tempsForts` et `ajustementsCA` (voir les cibles). Un budget proposé avant
le lot 24 n'a pas de `sortie` : il garde son calcul jusqu'à sa prochaine proposition.

## Format des charges (`parametres_reseau.valeur.charges`)

Objet `ParametresCharges` de `src/moteur/equipe.ts` : `taux` par catégorie (part du brut, avant réduction) et `reduction`
(`smicAnnuel`, `tmin`, `tdelta`, `puissance`, `horsReduction`). Une valeur absente reprend celle par défaut
(`src/moteur/parametres.ts`, valeurs 2026). Le budget d'un magasin qui a une équipe porte aussi `equipe` et
`hausseSalaires` dans ses hypothèses : un budget validé garde l'équipe du jour de la validation. De même, les frais
enregistrés dans `frais` remplacent ceux de la base du budget tant qu'il n'est pas validé.

## Format des cibles (`cibles_reseau.valeur`, `cibles_groupe.valeur`, `budgets.ajustements`)

Objet `Cibles` de `src/moteur/cibles.ts`, chaque clé facultative : `evolutionUnivers` (par univers), `evolutionFamille`,
`margeFamille` et `demarqueFamille` (par famille, clé `univers/famille`, par exemple `cave/Bière`), `hausseSalaires`, `inflationFrais`,
`evolutionFlux` (`cave`, `bar`) ; au niveau du magasin seulement, `poidsMois` (12 parts, total 100 %) et `travaux`.
Lot 24 : au réseau seulement, `hausseTarifaire` (défaut du panier) et `millesimes` (par ancienneté `1` à `4` :
`evolutionFlux` et `evolutionPanier` par univers, le panier en plus de la hausse tarifaire) ; au magasin seulement,
`rythme` (`applique` ou `ignore` par univers), `tempsForts` (`[{nom, type (exterieur, soiree, operation), mois, univers,
caAnPasse, ca, extrasPersonnel, autresCharges, moisAchats}]`, mois de 1 à 12, montants HT) et `ajustementsCA`
(`[{libelle, univers, de, a, montant (€ HT par mois) ou taux (part du CA de l'univers)}]`). Ordre des niveaux : magasin,
groupe, ancienneté du magasin, réseau, hausse tarifaire, réalisé. Une clé absente reprend le niveau au-dessus : magasin, puis groupe, puis réseau, puis le
réalisé du magasin (évolution nulle, marge réalisée, démarque nulle). Lot 8 : ces clés vivent dans le JSON existant, sans migration.
