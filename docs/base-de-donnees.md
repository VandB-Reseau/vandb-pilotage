# Base de données du pilotage

Même base Supabase que l'app réseau. Le pilotage n'écrit que dans le schéma `pilotage` ; il lit l'app réseau par ses
fonctions (`mon_role()`, `est_directeur()`, `magasins_visibles()`, `mes_magasins()`, `json_sur()`) et ses tables `perimetre_equipe`
et `app_config` (lue seulement : fiche des Responsables Régionaux, clé `drs_data`).

Mis à jour le 02/11/2026 (migration `0022`).

## Principes

- **Rôle lu dans la base** (fonctions de l'app réseau), jamais dans le seul jeton de connexion.
- **Un magasin est identifié par son nom** (`store_name`), comme dans l'app réseau.
- **Magasins du compte** (`pilotage.mes_magasins()`) : Directeur, tous (`perimetre_equipe` et magasins ayant un budget) ;
  Coach et RR, leur périmètre (`magasins_visibles()`) ; franchisé, ses magasins (`mes_magasins()`) ; sinon aucun.
- **Montants HT**, taux en fractions (0,02 = 2 %).

## Tables

| Table | Contenu | Clé | Lecture | Écriture |
| --- | --- | --- | --- | --- |
| `parametres_reseau` | Paramètres de l'année : `valeur` jsonb (`tauxRedevance`, `tauxPublicite`, `impot`, `tvaPanier`, `charges` : taux de charges patronales par catégorie et paramètres de la réduction générale ; `tresorerie` : délais de paiement en mois (`delaiFournisseurs` compté après la livraison), `avanceLivraison` (mois de livraison et de facturation des marchandises Cave et Bar avant la vente ; 1 si absente), TVA des ventes, des achats et des frais, `tvaTrimestrielle`, `partCotisations`, `consignes` : part des achats par univers, `ecoulement` et `remboursement` en mois, `demarque` (part des consignes jamais remboursée, en charge externe du budget ; 0 si absente), `avanceExterieur` (mois d'avance des achats Extérieur sur la vente), `stock` (0023 : `mois` par univers `{cave, bar, exterieur}`, mois d'achats des ventes à venir à garder en stock en fin de mois, 2,5 / 1 / 0 par défaut, et `tolerance`, écart toléré autour de la cible, 10 % par défaut ; sert au graphique du stock et au stock du fonds de roulement ; `stockJours`, ancien réglage, n'est plus lu), `operations` (`[{nom, mois, moisPaiement, part}]` : opérations du réseau dont une part des achats Cave et Bar du mois est payée à un autre mois) ; `alertes` : seuils `ecartCA`, `baisseMarge` en points, `moisRetard`, `tresorerie` en euros ; lot 40, écrits seulement s'ils diffèrent des valeurs par défaut : `grilleFrais` (`[{code, libelle, rubrique, bloc, racines, courante?, masquee?}]`, la grille des frais de l'année, complétée par les lignes par défaut qu'elle n'a pas) et `regles` (`jeuneMagasin`, `moisRythme`, `ecartRythme`, `seuilRythme`, `magasinsSaisonnalite`, `magasinsCalage`, `magasinsFamille`, `moisCommerciaux`)) | `annee` | Comptes ouverts, et le contrôle de gestion (0021) | Directeur et contrôle de gestion (0021) ; chaque changement est journalisé |
| `controle_gestion` | Comptes du contrôle de gestion désignés par le Directeur (0021) : `user_id` (compte de connexion), `email`, `ajoute_le`, `ajoute_par`. Avec le Directeur, ils modifient les paramètres réseau, même sans rôle dans l'app réseau | `user_id` | Directeur et contrôle de gestion | Ajout : Directeur par `ajouter_controle_gestion`. Retrait : Directeur |
| `journal_parametres` | Journal des paramètres réseau (0021) : une ligne par rubrique de `parametres_reseau.valeur` modifiée (`annee`, `rubrique`, `avant`, `apres`, `par`, `par_email`, `le`) | `id` | Directeur, contrôle de gestion, RR | Déclencheur `journal_parametres` seul |
| `budgets` | Budget d'un magasin pour une année : `statut` (`propose`, `en_discussion`, `valide`), `base` (réalisé importé du prévisionnel), `ajustements` (écarts du magasin aux cibles, format `Cibles`, dont saisonnalité, travaux, `tresorerieDepart` et `fraisBudget` : frais du budget ligne par ligne, même montant, hausse en % ou nouveau montant ; lot 42 : `accords`, thèmes acceptés par le franchisé, sans effet sur le calcul), `proposition` (base proposée par le siège), `hypotheses` (hypothèses calculées au dernier enregistrement, figées à la validation ; lot 42 : `departEstime`, trésorerie au 1er janvier estimée depuis les comptes et figée à la validation quand le franchisé n'a pas saisi la sienne), `valide_le`, `ajustements_siege` (0022 : photo des `ajustements` écrite par le Directeur, la position du siège face à laquelle se lisent les changements du magasin), `envoye_le` (0022 : date du dernier envoi au siège par le franchisé), `parametres` (copie des paramètres réseau de l'année faite à la validation, vide hors budget validé, 0020) | `store_name`, `annee` | Magasins du compte | Création et suppression : Directeur. Modification : Directeur, RR (validation et réouverture seulement, 0018) et franchisé sur leurs magasins |
| `reel_mensuel` | Réel par mois (1er du mois), univers (`cave`, `bar`, `exterieur`) et famille : `ca_ht`, `ca_ttc`, `marge_ht` (marge théorique de la caisse), `maj_par`. La colonne `tickets` de `0001` n'est plus utilisée (voir `reel_tickets`) | `store_name`, `mois`, `univers`, `famille` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `reel_tickets` | Tickets par mois et univers (un ticket ne se compte pas par famille) : `tickets`, `maj_par` | `store_name`, `mois`, `univers` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `codes_caisse` | Code magasin de la caisse (fichiers de la DSI) → nom du magasin, un code par magasin | `code` | Équipe | Directeur |
| `equipe` | Équipe d'un magasin, une ligne par poste sans nom : `poste`, `categorie` (`employe`, `agent_maitrise`, `cadre`, `apprenti`, `gerant_tns`), `heures_hebdo`, `brut_mensuel` (rémunération pour un gérant TNS), `primes` (`[{mois, montant}]`), `entree` et `sortie` (1er du mois, facultatives), `heures_saisie` (`semaine` ou `mois`, unité choisie à la saisie ; le calcul part de `heures_hebdo`) et `enveloppe` (primes d'équipe sans salarié : heures et brut à 0) (0015), `taux_horaire` (extras : taux horaire brut, `brut_mensuel` = taux × heures moyennes du mois ; vide pour un poste classique) (0017), `hausses` (hausses de salaire datées `[{mois: "AAAA-MM", taux}]`, appliquées à partir de leur mois et cumulées) (0019), `maj_le`, `maj_par` | `id` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `emprunts` | Prêts d'un magasin, saisis une fois avec leur date (0026) : `libelle`, `mode` (`initial` d'après le tableau de la banque : `montant` emprunté, `taux` annuel, `duree` en années, `debut` = 1re échéance, `differe` en mois d'intérêts seuls ; `restant` faute du tableau : `montant` = capital restant dû juste avant l'échéance de `debut`, `mensualite`), `debut` au 1er du mois, `maj_le`, `maj_par`. L'app en tire les intérêts et le capital de chaque mois de chaque année ; ils remplacent les frais `interets` et `remboursement_capital`. Un prêt saisi est déjà dépensé : aucun encaissement en trésorerie | `id` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `annees` | Années du pilotage (0027) : `etat` `campagne` (le budget de l'année se construit), `suivi` (son réel se compare à son budget ; la plus récente est l'année du Suivi, les autres sont « à clore »), `close` (en lecture) ; `campagne_le`, `suivi_le`, `close_le`, `maj_par`. Une année absente est en préparation. Départ : 2026 `suivi`, 2027 `campagne`. Sans aucune ligne, l'app suit l'ancienne règle du calendrier | `annee` | Comptes avec un rôle | Personne directement : fonctions `ouvrir_campagne`, `demarrer_suivi`, `clore_annee` (Directeur) |
| `frais_archives` | Photo des `frais` de chaque magasin à la fin d'une année, prise au démarrage du suivi de l'année suivante (0027) : mêmes colonnes que `frais`, plus `annee` et `archive_le` | `annee`, `store_name`, `code` | Magasins du compte | Personne directement : `demarrer_suivi` |
| `frais` | Frais annuels d'un magasin, une ligne par code de la grille (`src/moteur/parametres.ts`) : `code`, `libelle`, `rubrique` (rubriques de la grille, plus `hors_exploitation` pour `amortissements`, `interets`, `remboursement_capital`), `annuel` (€ par an) ou `taux_ca` (part du CA HT), l'un ou l'autre, `maj_le`, `maj_par` | `store_name`, `code` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `quadrimestres` | Chiffres comptables d'un magasin tous les 4 mois (1 : janvier à avril, 2 : mai à août, 3 : septembre à décembre), saisis ou importés : `achats` de marchandises, `variation_stock` (stock de fin − stock de début), `charges_externes` (redevance et publicité comprises), `impots_taxes`, `personnel`, `tresorerie` en fin de période, `maj_le`, `maj_par`. Achats et charges positifs. Le CA vient de la caisse ; marge réelle et EBE sont calculés par l'app (0008) | `store_name`, `annee`, `quadrimestre` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `stocks` | Valeur du stock d'un magasin au dernier jour du mois, au prix d'achat HT, Cave et Bar séparés : `mois` (1 à 12), `cave`, `bar` (positifs ou vides), `maj_le`, `maj_par` posés par la base. La cible (mois d'achats des ventes à venir) est un paramètre réseau ; l'app compare l'un à l'autre (0023) | `store_name`, `annee`, `mois` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `parts_realisees` | Part de l'année réalisée à fin du dernier mois, saisie par univers (`cave`, `bar`, `exterieur`) pour l'atterrissage d'un magasin sans réel de l'an dernier : `part` (0 à 1), `maj_le`, `maj_par`. Pas de ligne : calcul automatique (0009) | `store_name`, `annee`, `univers` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `correspondances_fec` | Rubrique d'un compte de charges du FEC propre au magasin (`achats`, `variation_stock`, `charges_externes`, `impots_taxes`, `personnel`, `hors_ebe`), quand son cabinet le range autrement que les racines du plan comptable : `maj_le`, `maj_par`. Pas de ligne : correspondance par défaut. Le FEC n'est pas enregistré (0010) | `store_name`, `compte` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins |
| `echanges_budget` | Commentaire sur le budget d'un magasin (0011, commentaires depuis 0025) : `texte` (2 000 caractères au plus), `auteur`, `auteur_role`, `auteur_nom` et `cree_le` posés par la base ; `ancre` (point commenté : `budget` par défaut, `theme/<thème>`, `ventes/<univers>`, `ligne/<clé de cible>`, `visualiser`) et `ancre_libelle` (160 caractères au plus) ; `parent` : commentaire auquel répond la ligne (une réponse prend le magasin, l'année et le point de son commentaire, jamais de réponse à une réponse) ; `resolu_le`, `resolu_par_role`, `resolu_par_nom` posés par `resoudre_commentaire`, remis à vide à l'écriture. `sujet` ne sert plus (messages d'avant 0025, lus comme commentaires sur le budget en général) | `id` ; index `store_name`, `annee`, `cree_le`, `parent` | Magasins du compte | Directeur partout ; RR, Coach et franchisé sur leurs magasins ; retrait par l'auteur seul (ses réponses partent avec) ; « Résolu » par `resoudre_commentaire` seulement |
| `versions_budget` | Version du budget à sa création et à chaque changement de statut, de base ou d'ajustements : `statut`, `base`, `ajustements`, auteur, rôle, nom, date (0011) | `id` ; index `store_name`, `annee`, `cree_le` | Magasins du compte | Déclencheur `versions_budget_trace` seul |
| `versions_nommees` | Version du budget enregistrée sous un nom pour comparer : `nom` (1 à 80 caractères), `base` (hypothèses avec l'équipe et les frais du jour), `ajustements`, auteur, rôle, nom et date posés par le déclencheur `versions_nommees_auteur` (0015) | `id` ; index `store_name`, `annee` | Magasins du compte | Ajout : Directeur, franchisé sur ses magasins ; retrait : Directeur ou auteur |
| `actions` | Action du plan d'un magasin : `type_alerte` (`ca`, `marge`, `reel`, `tresorerie`, `autre` ; `tickets` et `panier` depuis 0016), `intitule`, `responsable` (`franchise`, `coach`, `rr`, `directeur`), `echeance`, `statut` (`a_faire`, `faite`, `abandonnee`), `annee`, `depart` et `mois_depart` (mesure de l'alerte le jour de l'action), auteur et dates posés par la base (0012) | `id` ; index `store_name`, `statut` | Magasins du compte | Directeur partout ; RR et Coach sur leurs magasins ; le franchisé ne change que le statut |
| `ouvertures` | Date d'ouverture d'un magasin, le 1er du mois : `ouverture`, `maj_le`, `maj_par`. Donne son ancienneté (année 1, 2, 3, 4 et plus) et écarte le rythme de sortie des 2 mois qui suivent l'ouverture (0014). Depuis 0024, ne sert plus qu'en secours : la date de la fiche magasin de l'app réseau passe avant | `store_name` | Magasins du compte | Directeur |
| `groupes` | Groupes libres de magasins (centre-ville, zone commerciale…) : `nom` | `id` | Équipe | Directeur |
| `groupe_magasins` | Groupe d'un magasin (un au plus) | `store_name` | Équipe | Directeur |
| `cibles_reseau` | Cibles du réseau pour l'année : `valeur` (format `Cibles`) | `annee` | Équipe | Directeur |
| `cibles_groupe` | Cibles d'un groupe pour l'année : `valeur` (format `Cibles`) | `groupe_id`, `annee` | Équipe | Directeur |
| `journal_migrations` | Migrations du pilotage passées | `numero` | Directeur | Migrations |

## Circuit du budget (déclencheur `garde_budget`)

- Le Directeur crée le budget (proposition du siège) et peut tout modifier ; passer en `valide` date `valide_le`.
- Un franchisé modifie les `hypotheses` et les `ajustements` de ses magasins sans changer le statut (0022). Il passe
  le budget `en_discussion` en l'envoyant au siège : `statut` `en_discussion` avec `envoye_le` changé ; la base date
  alors `envoye_le` elle-même. Il ne touche ni à la `proposition`, ni au statut `valide`, ni à un budget déjà validé,
  ni à `ajustements_siege`. La `base` n'est modifiable que par le Directeur (déclencheur `garde_base`, distinct pour
  que rejouer `0001` seule ne le retire pas).
- Position du siège (0022) : à la création et à chaque écriture des `ajustements` par le Directeur, la base copie les
  `ajustements` dans `ajustements_siege`. Personne ne l'écrit soi-même. Au passage de 0022, les budgets existants ont
  reçu les ajustements de la dernière version écrite par le Directeur, à défaut leurs ajustements du moment.
- Le RR valide un budget proposé ou en discussion de ses magasins, ou rouvre un budget validé (0018). Il ne change
  que le `statut` et, à la validation, la photo des `hypotheses` ; ni `proposition`, ni `base`, ni `ajustements`.
  Il ne crée ni ne supprime de budget.
- Paramètres figés (déclencheur `parametres_figes`, 0020, après `garde_budget`) : au passage en `valide`, la base copie
  dans `parametres` la ligne de `parametres_reseau` de l'année du budget ; un budget validé se calcule ensuite avec cette
  copie, même si le Directeur change un paramètre. Hors `valide`, `parametres` est vide. Personne ne l'écrit soi-même :
  le déclencheur la recalcule à chaque écriture. Les budgets déjà validés au passage de 0020 ont reçu les paramètres
  du moment de leur année.
- Les Coachs lisent sans écrire. Le franchisé ne lit pas les tables de groupes et de cibles : il les reçoit par
  `budgets_du_compte()`, limitées au réseau et au groupe de ses magasins.

## Journal des paramètres (déclencheur `journal_parametres`, 0021)

- Après chaque création ou modification d'une ligne de `parametres_reseau`, une ligne par rubrique de premier niveau
  (`tauxRedevance`, `impot`, `charges`…) dont la valeur a changé, avec l'ancienne et la nouvelle valeur, le compte et son
  email. Personne n'écrit dans le journal à la main.

## Fonctions

| Fonction | Rôle |
| --- | --- |
| `pilotage.mes_magasins()` | Magasins du compte connecté |
| `pilotage.magasins_du_compte(annee)` | Magasins du compte avec statut, hypothèses et date du budget de l'année (lot 0, remplacée dans l'app par la suivante) |
| `pilotage.remplacer_reel(ventes, tickets)` | Import ou saisie du réel : vide puis réécrit chaque couple magasin et mois reçu (ventes et tickets à part). Droits de l'appelant (`SECURITY INVOKER`) : une ligne hors périmètre fait échouer tout l'appel. Renvoie le nombre de lignes de ventes |
| `pilotage.reel_du_compte(annee)` | `{ mois, coachs, rrs }` : réel des magasins du compte (mêmes magasins que la lecture du réel), totalisé par magasin et par mois pour l'année et la précédente (`ca`, `marge`, `ca_marge` = CA des lignes dont la marge est connue, `ttc`, `tickets`, et pour la Cave et le Bar séparés `ttc_cave`, `ttc_bar`, `tickets_cave`, `tickets_bar` depuis 0013) ; `coachs` : Coach de chaque magasin, pour le Directeur et le RR seulement ; `rrs` : noms des Responsables Régionaux de chaque magasin (identifiants de `perimetre_equipe.rrs` reliés à la fiche `drs_data` d'`app_config`), pour le Directeur seulement (0007). Sert à la vue réseau |
| `pilotage.peut_parametrer()` | Vrai pour le Directeur et les comptes du contrôle de gestion : modifient les paramètres réseau (0021) |
| `pilotage.mes_droits()` | `{ parametrer, controle_gestion }` : droits du compte propres au pilotage, lus par l'app à la connexion (0021) |
| `pilotage.ajouter_controle_gestion(email)` | Directeur seul : désigne un compte de connexion existant comme contrôle de gestion ; faux si aucun compte n'a cet email (0021) |
| `pilotage.budgets_du_compte(annee)` | `{ magasins, reseau, groupes }` : budgets du compte (base, ajustements, hypothèses, groupe, paramètres figés depuis 0020, position du siège et date d’envoi depuis 0022), cibles du réseau, groupes utiles au compte avec leurs cibles |
| `pilotage.ouvertures_reseau()` | `(store_name, ouverture)` : date d'ouverture des magasins du compte (`mes_magasins()`) d'après la fiche magasin de l'app réseau, ramenée au 1er du mois. Lit `public.store_overrides.open_date`, sinon la liste `store_adds` d'`app_config` (noms passés par `store_renames`) ; écarte les dates de remplissage (`2020-01-01`, `2027-01-01`). Lecture seule, `SECURITY DEFINER`, comptes connectés seulement (0024) |
| `pilotage.date_sure(texte)` | Convertit un texte en date, vide s'il n'en est pas une (0024) |
| `pilotage.resoudre_commentaire(id, resolu)` | Marque « Résolu » (ou rouvre) un commentaire, pas une réponse, d'un magasin du compte : Directeur partout, RR, Coach et franchisé sur leurs magasins ; pose la date, le rôle et le nom. `SECURITY DEFINER`, comptes connectés seulement (0025) |
| `pilotage.ouvrir_campagne(annee)` | Directeur seul : ouvre la campagne des budgets de `annee` (année suivie la plus récente + 1, une campagne à la fois) ; reprend pour `annee` les paramètres réseau (sans les dates de campagne), les cibles du réseau et des groupes de l'année d'avant quand ils n'existent pas, sans rien écraser. Rejouée, ne change rien (0027) |
| `pilotage.demarrer_suivi(annee)` | Directeur seul : la campagne `annee` devient l'année suivie ; l'année d'avant reste suivie (à clore) ; archive les `frais` des magasins pour l'année d'avant (0027) |
| `pilotage.clore_annee(annee)` | Directeur seul : clôt une année suivie qui n'est plus la plus récente (0027) |

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
(`[{libelle, univers, de, a, caAnPasse, ca}]` : client extérieur face à l'an passé, CA HT sur la période ; avant le
03/11/2026 `montant` (€ HT par mois) ou `taux` (part du CA de l'univers), toujours lus). Depuis le 03/11/2026, au magasin
seulement : `investissements` (`[{libelle, type (equipement, mobilier, informatique, autre), montant HT, mois de mise en
service, duree en années}]`, amortis en linéaire au prorata des mois), `emprunts` (`[{libelle, montant, taux annuel, duree en
années, premiereEcheance (mois)}]`, échéances constantes, capital encaissé le mois d'avant la 1re échéance), `apport`
(`{montant, mois}`), `finEmpruntsEnCours` (dernier mois des emprunts déjà en cours, 12 par défaut), `rienPrevu` (questions
répondues « Rien de prévu ») et `accords`. Ordre des niveaux : magasin,
groupe, ancienneté du magasin, réseau, hausse tarifaire, réalisé. Une clé absente reprend le niveau au-dessus : magasin, puis groupe, puis réseau, puis le
réalisé du magasin (évolution nulle, marge réalisée, démarque nulle). Lot 8 : ces clés vivent dans le JSON existant, sans migration.
