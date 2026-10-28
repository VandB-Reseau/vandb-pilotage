# Architecture

## Pile

React 19, TypeScript, MUI 9 avec le thème de l'app réseau (charte V and B), react-router en HashRouter (GitHub Pages),
Supabase (même projet que l'app réseau), Playwright. Polices et icônes embarquées.

## Dossiers

| Dossier | Contenu |
| --- | --- |
| `src/moteur/` | Moteur de calcul pur : `types.ts` (hypothèses, résultats), `budget.ts` (calcul), `cibles.ts` (hypothèses par niveaux réseau, groupe, magasin), `parametres.ts` (paramètres par défaut, grille des frais), `reel.ts` (synthèse du réel d'une année, familles de la caisse), `saisieReel.ts` (saisie d'un mois à la main), `equipe.ts` (masse salariale chargée personne par personne, réduction générale), `saisieEquipe.ts` (fiche d'un poste), `atterrissage.ts` (atterrissage de l'année depuis le réel, base du budget suivant, frais du magasin), `saisieFrais.ts` (saisie des frais), `compteResultat.ts` (compte de résultat sur 12 mois, rubriques et détail), `sante.ts` (santé d'un magasin depuis le réel, synthèse des budgets), `suivi.ts` (réel face au budget, indicateurs du réseau à date), `tresorerie.ts` (trésorerie du budget mois par mois), `quadrimestre.ts` (marge réelle et EBE depuis les chiffres comptables de chaque quadrimestre), `alertes.ts` (alertes des magasins et leurs seuils), `simulation.ts` (« et si » sur le budget, sans l'enregistrer), `comparaison.ts` (médianes, rangs, ratios du réel et des budgets) |
| `src/import/` | Lecture des fichiers mensuels de la DSI (`caisse.ts` : ventes, tickets, quadrimestres des comptables, aperçu avant import ; format dans [import-caisse.md](import-caisse.md)) |
| `src/data/` | Lecture de la base (`pilotage.ts`, lectures gardées une minute et lues par pages de 1 000 lignes), chargement avec nouvelle tentative (`useChargement.ts`) |
| `src/lib/` | Classeur Excel écrit sans bibliothèque (`xlsx.ts`), contenu des exports du budget et de la vue réseau (`exports.ts`), mise en forme (`format.ts`), filtres de l'accueil et réel en retard (`aFaire.ts`), Entrée vers le montant suivant (`champSuivant.ts`) |
| `src/auth/` | Connexion et rôle lu dans la base |
| `src/pages/` | Connexion, Magasins, Réseau (classement des magasins), fiche Magasin (onglets Synthèse, Suivi du budget, Budget, Atterrissage de l'année en cours, Réel avec choix de l'année et saisie d'un mois, Quadrimestres, Et si, Équipe, Frais), Hypothèses (cibles du réseau et des groupes), Imports de caisse (fichiers de la DSI, quadrimestres des comptables, codes caisse), Paramètres réseau (dont charges sociales) |
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
14. Et si : `hypothesesSimulees` copie les hypothèses du budget et y applique les leviers (CA, taux de marge, hausse de
   loyer, embauche ajoutée à l'équipe ou au personnel saisi en bloc) ; `simuler` recalcule budget et trésorerie des deux
   côtés. Rien n'est enregistré.
15. Médianes : `chargerComparaison` calcule les ratios de chaque magasin du compte (taux de marge, masse salariale /
   marge, loyer / CA, panier, EBE / CA) sur le réel à date et sur les budgets de l'an prochain ; `medianes` et `rang`
   placent le magasin face à son groupe et au réseau (au périmètre pour un Coach ou un RR). Vue Réseau : ligne de la
   médiane de la sélection. Pas montré au franchisé.

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
