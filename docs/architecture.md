# Architecture

## Pile

React 19, TypeScript, MUI 9 avec le thème de l'app réseau (charte V and B), react-router en HashRouter (GitHub Pages),
Supabase (même projet que l'app réseau), Playwright. Polices et icônes embarquées.

## Dossiers

| Dossier | Contenu |
| --- | --- |
| `src/moteur/` | Moteur de calcul pur : `types.ts` (hypothèses, résultats), `budget.ts` (calcul), `cibles.ts` (hypothèses par niveaux réseau, groupe, magasin), `parametres.ts` (paramètres par défaut, grille des frais), `reel.ts` (synthèse du réel d'une année, familles de la caisse), `saisieReel.ts` (saisie d'un mois à la main), `equipe.ts` (masse salariale chargée personne par personne, réduction générale), `saisieEquipe.ts` (fiche d'un poste), `atterrissage.ts` (atterrissage de l'année depuis le réel, base du budget suivant, frais du magasin), `saisieFrais.ts` (saisie des frais), `compteResultat.ts` (compte de résultat sur 12 mois, rubriques et détail), `sante.ts` (santé d'un magasin depuis le réel, synthèse des budgets), `suivi.ts` (réel face au budget, indicateurs du réseau à date), `tresorerie.ts` (trésorerie du budget mois par mois), `quadrimestre.ts` (marge réelle et EBE depuis les chiffres comptables de chaque quadrimestre), `alertes.ts` (alertes des magasins et leurs seuils), `explication.ts` (« D'où vient ce chiffre ? »), `versions.ts` (versions du budget côte à côte), `comparaison.ts` (médianes, rangs, ratios du réel et des budgets), `periodes.ts` (mois, quadrimestres, année), `visite.ts` (fiche de visite), `leviers.ts` (leviers commerciaux), `campagne.ts` (campagne des budgets), `effets.ts` (effet d'une saisie sur l'EBE), `economie.ts` (économie du franchisé), `familles.ts` (familles face au réseau), `semaine.ts` (« Ma semaine »), `objectifs.ts` (objectifs du mois) |
| `src/import/` | Lecture des fichiers mensuels de la DSI (`caisse.ts` : ventes, tickets, quadrimestres des comptables, aperçu avant import ; format dans [import-caisse.md](import-caisse.md)) |
| `src/data/` | Lecture de la base (`pilotage.ts`, lectures gardées une minute et lues par pages de 1 000 lignes), chargement avec nouvelle tentative (`useChargement.ts`) |
| `src/lib/` | Classeur Excel écrit sans bibliothèque (`xlsx.ts`), contenu des exports du budget et de la vue réseau (`exports.ts`), mise en forme (`format.ts`), filtres de l'accueil et réel en retard (`aFaire.ts`), Entrée vers le montant suivant (`champSuivant.ts`) |
| `src/auth/` | Connexion et rôle lu dans la base |
| `src/pages/` | Connexion, Magasins, Réseau (classement des magasins), fiche Magasin (trois espaces : Synthèse ; année en cours avec Réel, Suivi du budget, Atterrissage, Quadrimestres ; budget avec Hypothèses, Équipe, Frais, Calendrier, Résultat et trésorerie, Échanges et versions), Hypothèses (cibles du réseau et des groupes), Imports de caisse (fichiers de la DSI, quadrimestres des comptables, codes caisse), Paramètres réseau (dont charges sociales) |
| `src/components/` | Écrans partagés, dont `SyntheseMagasin.tsx`, `CompteResultatMois.tsx` (tableau dépliable), `GraphiqueMois.tsx` (graphique 12 mois avec infobulle), `Indicateur.tsx` et `Courbe.tsx` (cartes chiffrées), `SuiviBudget.tsx`, `GrilleHypotheses.tsx` (hypothèses par famille), `SaisonnaliteMagasin.tsx`, `TravauxMagasin.tsx`, `CopieHypotheses.tsx` |
| `src/layout/` | Cadre : barre du haut, menu latéral sur PC, barre basse sur téléphone ; garde des saisies non enregistrées (`components/GardeSaisie.tsx`) |
| `supabase/` | Migrations du schéma `pilotage` et leurs tests |
| `tests/` | `moteur/` (calculs, sans navigateur), écrans sur PC et téléphone avec Supabase simulé |

## Flux

1. Connexion avec les identifiants de l'app réseau ; rôle lu par `mon_acces()`.
2. `pilotage.budgets_du_compte(annee)` renvoie les budgets du compte, les cibles du réseau et des groupes ; les
   paramètres viennent de `pilotage.parametres_reseau`.
3. Budget d'un magasin : sa base (réalisé proposé par le siège) passe par `appliquerCibles` (réseau, groupe, ajustements du
   magasin, dont démarque, saisonnalité et travaux), puis par `calculerBudget` (`poidsBudget`, `effetTravaux`). Un budget validé garde les hypothèses figées à la validation.
4. Réel : chaque mois, le Directeur dépose les fichiers de la DSI (Imports de caisse) ; l'app les lit dans le navigateur,
   rattache les codes caisse aux magasins et remplace chaque mois reçu par `remplacer_reel`. Un mois peut aussi être saisi
   à la main depuis la fiche magasin. `syntheseReel` en tire cumul, marge, poids des familles et panier moyen.
5. Équipe : `chargerBudgets` lit aussi l'équipe des magasins du compte. Quand un magasin en a une, `hypothesesDe` la place
   dans ses hypothèses et `calculerBudget` calcule le personnel par `masseSalariale` (taux de la catégorie moins la
   réduction générale, hausse des salaires des cibles) au lieu des salaires saisis en bloc.
6. Frais : lus avec les budgets (`chargerFrais`) ; comme l'équipe, ils remplacent frais, amortissements et emprunts de la
   base tant que le budget n'est pas validé (`avecEquipeEtFrais`).
7. Atterrissage : `baseDepuisReel` part du réel de l'année (mois passés) et projette les mois restants, univers par
   univers : part de l'année réalisée saisie (`parts_realisees`), sinon saisonnalité du magasin l'année précédente, sinon
   saisonnalité médiane du réseau (`saisonnaliteMediane`), sinon moyenne réalisée ; `calculerBudget` en tire le compte
   de résultat. Le Directeur en fait la base du budget de l'an prochain (« Proposer le budget »), que les cibles ajustent.
8. Synthèse : `santeMagasin` compare le cumul réel à l'an dernier et reprend l'atterrissage (`atterrissageDe`) ;
   `compteResultat` met tout budget calculé en lignes mois par mois pour `CompteResultatMois`.
9. Suivi : `suiviBudget` compare le réel de l'année (`moisDuReel`) au budget de la même année. Vue réseau :
   `pilotage.reel_du_compte(annee)` renvoie le réel totalisé par magasin et par mois ; `ligneReseau` y ajoute budget,
   équipe et frais de chaque magasin, `totalReseau` en fait le total pondéré.
10. Trésorerie : `tresorerieBudget` (moteur pur) déroule le budget en encaissements et décaissements TTC avec les délais
   de `ParametresReseau.tresorerie` ; début d'année en régime établi (décembre de l'année précédente = décembre du budget).
   Les consignes s'y ajoutent hors TVA : nulles sur l'année, elles déplacent la trésorerie d'un mois à l'autre.
11. Export et impression : `feuillesBudget` et `feuilleReseau` reprennent les chiffres du moteur tels qu'à l'écran
   (totaux et parts du CA en formules Excel) ; `classeur` écrit le .xlsx. L'impression (A4 paysage) passe par les styles
   `@media print` d'`AppShell` : classes `pas-a-l-impression` (masqué) et `impression-seule` (montré à l'impression).
12. Quadrimestres : tous les 4 mois, le franchisé (ou l'équipe) saisit six montants comptables, ou le Directeur importe
   le fichier des comptables. `resultatsQuadrimestres` y ajoute le CA de la caisse : marge réelle = CA − (achats −
   variation de stock), écart à la marge théorique de la caisse (démarque constatée), EBE réel face au budget.
   Trésorerie glissante : `tresorerieGlissante` part de la dernière trésorerie saisie et ajoute les flux de
   l'atterrissage (`tresorerieBudget` appliqué à l'atterrissage) jusqu'à décembre.
13. Alertes : `chargerAlertes` rassemble le réel de l'année (`reel_du_compte`), son budget, l'an dernier, la trésorerie
   du dernier quadrimestre et le point bas du budget à venir ; `alertesMagasin` applique les seuils des Paramètres réseau
   de l'année du budget. Affichées à l'accueil, dans la vue Réseau (selon les filtres) et en tête de la synthèse d'un
   magasin ; chaque alerte ouvre l'onglet où elle se lit.
14. Et si : retiré au lot 26, remplacé par les versions nommées du budget (point 26).
15. Médianes : `chargerComparaison` calcule les ratios de chaque magasin du compte (taux de marge, masse salariale /
   marge, loyer / CA, panier, EBE / CA) sur le réel à date et sur les budgets de l'an prochain ; `medianes` et `rang`
   placent le magasin face à son groupe et au réseau (au périmètre pour un Coach ou un RR). Vue Réseau : ligne de la
   médiane de la sélection. Pas montré au franchisé.
16. Atterrissage sans réel de l'an dernier : `baseDepuisReel` projette les mois restants de chaque univers avec la part
   de l'année réalisée saisie (`parts_realisees`), sinon la saisonnalité médiane du réseau l'an dernier
   (`saisonnaliteMediane`, au moins 3 magasins complets), sinon la moyenne des mois réalisés.
17. Trésorerie glissante : `tresorerieGlissante` part de la dernière trésorerie saisie d'un quadrimestre et déroule les
   flux de l'atterrissage jusqu'à décembre.
18. Espace franchisé : en tête de la synthèse, `tachesFranchise` (`src/lib/aFaire.ts`) liste ce qu'il a à faire selon
   la date (réel du dernier mois, quadrimestre fini, budget proposé ou en discussion, équipe, frais) ; chaque ligne
   ouvre l'onglet. La comparaison aux autres magasins ne lui est pas montrée.
19. FEC : `lireFEC` (`src/import/fec.ts`) lit le fichier dans le navigateur ; `syntheseFEC` (`src/moteur/fec.ts`) range
   chaque compte de charges sur les racines du plan comptable, applique les exceptions du magasin
   (`correspondances_fec`) et rend les six montants du quadrimestre, repris dans la saisie avant enregistrement.
20. Échanges sur le budget : onglet Budget, messages par sujet (`echanges_budget`) et historique des versions
   (`versions_budget`, écrit par la base). Le CA et l'EBE de chaque version sont recalculés avec les cibles du moment.
21. Plan d'action : sur la synthèse, « Agir » sur une alerte crée une action (`actions`) avec la mesure du jour
   (`mesureDeAlerte`). `mesuresMagasin` recalcule la même mesure sans seuil, `effetAction` dit si elle s'améliore.
   Les listes d'alertes signalent celles qui ont une action en cours ; les actions confiées au franchisé vont dans son
   « À faire ».
22. Cave et Bar séparés : dans `calculerBudget`, un univers Cave ou Bar qui a des tickets se construit par
   CA atterri × (1 + évolution des tickets) × (1 + évolution du panier), réparti entre ses familles par `mix` (parts
   visées gardées, le reste au prorata du CA atterri). Cibles `evolutionPanier` et `mixFamille` ; l'évolution du CA
   d'une famille ne sert plus qu'aux univers sans tickets. Le compte de résultat reste celui du magasin. Réel :
   `syntheseReel().parUnivers`, `MoisReel.univers` (rempli par `reel_du_compte`, script 0013) ; vue Réseau, médianes
   et export avec un panier et une évolution des tickets par univers.
23. Frais : `lignesFrais` (`src/moteur/parametres.ts`) reprend les lignes de l'onglet FFBUD dans son ordre, rangées par
   bloc (`BLOCS_FRAIS` : charges externes, impôts et taxes, autres charges ; `blocDe`), avec les racines du plan
   comptable de chaque ligne (`ligneFraisDuCompte` dans l'import du FEC). Publicité franchise et royalties restent
   calculées sur le CA ; intérêts sur emprunts, des comptes courants et agios s'additionnent dans les intérêts.
   La colonne `rubrique` de la table `frais` est gardée telle quelle : aucun changement de base.
24. Projection du CA (`src/moteur/projection.ts`) : l'atterrissage mesure le rythme de sortie de la Cave et du Bar
   (`Hypotheses.sortie`, 4 derniers mois ÷ leur poids) ; les cibles posent `rythme`, et `calculerBudget` part de ce rythme
   s'il reste à 15 % de l'atterrissage hors temps forts (au-delà : confirmation du Directeur). L'ancienneté
   (`trancheMillesime`, table `ouvertures`) et la hausse tarifaire sont des niveaux de cibles (`niveauxReseau`), pas des
   multiplicateurs. Temps forts et ajustements datés (cibles du magasin) : CA de l'an passé retiré de la base, CA du
   budget ajouté au mois, extras de personnel et autres charges, achats payés au mois saisi (`paiementsAchats`).
   `calageMillesimes` donne la médiane du réseau par ancienneté dans l'écran Hypothèses.
25. Prise en main : `calculerBudget` garde le détail du CA de chaque univers (`Budget.detailCA`) ; `src/moteur/explication.ts`
   en tire les étapes du CA, de la marge et de l'EBE (« D'où vient ce chiffre ? », `DetailCalcul`). Aides à la demande
   (`Aide`, textes dans `src/lib/aide.ts`). Recherche de magasin dans la barre du haut (`RechercheMagasin`, magasins
   récents dans le stockage du navigateur, sans donnée chiffrée).
26. Lot 26 : versions nommées (table `versions_nommees`, `VersionsBudget`) : base complète du jour (équipe et frais
   compris) et ajustements, recalculées avec les cibles du moment, comparées par `comparerVersions`. Équipe : heures
   saisies à la semaine ou au mois (`heuresSaisie`, le calcul garde les heures par semaine), primes d'équipe sans salarié
   (`enveloppe` : charges de la catégorie, sans réduction). Atterrissage (`baseDepuisReel`) : depuis le mois d'ouverture,
   saisonnalité du magasin seulement sur une année précédente complète, magasin de moins de 18 mois projeté sur le
   rythme de ses 4 derniers mois (`JEUNE_MAGASIN`) ; `expliquerAtterrissage`. Quadrimestres : `comparaisonPeriode` et
   `memePeriode` (cumul face au budget et à l'an passé, ligne par ligne).
27. Lot 27, ergonomie : fiche magasin en trois espaces (Synthèse, année en cours, budget de l'an prochain) découpés en
   parties ; les parties du budget non affichées gardent leur saisie (classe `partie-cachee`, imprimées avec le reste).
   `BarreEnregistrement` collée en bas tant qu'un ajustement n'est pas enregistré, avec l'effet avant → après.
   `src/moteur/periodes.ts` regroupe le compte de résultat et la trésorerie par quadrimestre ou sur l'année
   (`ChoixPeriode`, choix gardé dans le navigateur par `src/lib/preferences.ts`). `GraphiqueTresorerie` (barres de fin
   de mois, `plusGrosseSortie`). Synthèse face au budget de l'année et CA cumulé (`cumul`, `cumulApres`). Liste des
   magasins triable avec ligne Total (`totalBudgets`), alertes par magasin ; « À traiter » (`aTraiter`, `ATraiter`)
   pour le Directeur, le RR et le Coach.
28. Lot 28 : les mois restants de l'atterrissage suivent le rythme des 4 derniers mois quand il s'écarte de moins de
   15 % de la méthode d'avant (`ECART_RYTHME`), sinon l'écart s'affiche et « Retenir le rythme » le saisit en part de
   l'année réalisée. Alertes tickets et panier, Cave et Bar séparés, sur 3 mois face à l'an dernier (`alertes.ts`).
   `src/moteur/visite.ts` : fiche de visite (`FicheVisite`, imprimée seule en A4 portrait, `@page fiche`), trois
   sujets classés par la marge en jeu. `src/moteur/leviers.ts` : leviers commerciaux sur un an (`LeviersCommerciaux`,
   rien d'enregistré ; « En faire une action » ouvre le plan d'action pré-rempli). `src/moteur/campagne.ts` : dates
   de la campagne des budgets (`parametres_reseau.valeur.campagne`), retard et avancement par RR et par Coach
   (`CampagneBudgets` sur la liste des magasins). CA par heure travaillée (`caParHeure`) dans la vue Réseau et la
   comparaison. `src/moteur/effets.ts` : effet d'une saisie d'équipe ou de frais sur l'EBE, montré par
   `BarreEnregistrement` dans Équipe, Frais et Quadrimestres.
29. Lot 29 : `src/moteur/economie.ts` : point mort (coûts fixes ÷ taux de marge sur coûts variables, frais en % du CA
   comptés variables), marge de sécurité, coût du gérant, reste disponible et CA à atteindre pour une rémunération visée
   (`EconomieFranchise`, dans Résultat et trésorerie, franchisé compris). `src/moteur/familles.ts` : poids de chaque
   famille dans son univers et taux de marge face à la médiane (3 magasins au moins), potentiel de marge
   (`FamillesReseau` sur la synthèse, caché au franchisé). `src/moteur/semaine.ts` : magasins classés par la marge en
   jeu des sujets de la fiche de visite, alertes, actions en retard, totaux par Coach (`MaSemaine` dans la vue Réseau,
   suit ses filtres). Sans migration.
30. Lot 30 : fiche du magasin en 4 étapes de budget (chiffre d'affaires ; équipe et frais ; résultat et trésorerie ;
   échanges et versions) et 2 vues de l'année (Réel avec les quadrimestres, Où on va avec l'atterrissage), anciens liens
   redirigés par `ongletDe`. Synthèse en 3 blocs, le reste dans `PlusLoin` (replié, préférence mémorisée). Alertes
   regroupées dans `MaSemaine`. `SectionParametres` : chaque section des Paramètres repliée avec son résumé.
   `src/moteur/objectifs.ts` : CA TTC, clients par jour et panier du mois pour Cave et Bar (`ObjectifsMois`, imprimable).
   Extras dans l'équipe (migration 0017) et démarque de consignes.
31. Lot 31 : `HypothesesUnivers` remplace la grille complète dans le budget : leviers par univers, `GrilleHypotheses`
   (mode `detail`) n'affiche plus que les familles d'un univers, à la demande. `cibles.ts` : `moyenneUnivers`,
   `ecrireUnivers` (marge décalée de façon égale, démarque identique), `universRegle`. Sans migration.
32. Lot 32 : `src/lib/modeles.ts` (modèles d'import, relus par les vrais imports dans `tests/moteur/lot32.spec.ts`) et
   `BoutonModele`. `Indicateur` prend `aide` (texte de `src/lib/aide.ts`) ou `info` (`DetailCalcul`, devenu picto) ;
   `Aide compact` dans les lignes du compte de résultat et de la trésorerie. Sans migration.
33. Lot 33 : `fraisDepuisFEC` (`src/moteur/fec.ts`) et `saisieAvecFEC` (`src/moteur/saisieFrais.ts`), BFR dans `tresorerieBudget`,
   saisonnalité par univers (`caMensuelUnivers`), compte de résultat mensuel jusqu'à la trésorerie dégagée ; tests dans
   `tests/moteur/lot33.spec.ts` et `tests/lot33.spec.ts`. Migration `0018_validation_rr.sql` (le RR valide).

## Rôles

| Rôle | Voit | Écrit |
| --- | --- | --- |
| Directeur de réseau | Tous les magasins, hypothèses, paramètres, imports | Paramètres, cibles, groupes, budgets (valide, rouvre), réel (import et saisie), codes caisse, équipes, charges sociales |
| Responsable Régional, Coach | Magasins de leur périmètre, vue Réseau limitée à ce périmètre | Réel, équipe et frais de leurs magasins |
| Franchisé | Ses magasins, avec les cibles qui s'y appliquent | Ajustements de son budget tant qu'il n'est pas validé, réel et équipe de ses magasins |

## Plan par lots

Recadré le 27/10/2026 : le budget se construit dans l'app, magasin par magasin, sans import du prévisionnel Excel.
0 Socle · 1 Cibles par niveaux et accord · 2 Réel de l'année (import DSI, saisie) · 3 Équipe et masse salariale ·
4 Frais et atterrissage · 5 Hypothèses de l'an prochain (travaux, duplication d'un magasin à l'autre, démarque) ·
6 Vue réseau · plus tard, connexion caisse.
