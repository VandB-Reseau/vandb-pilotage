# Architecture

## Pile

React 19, TypeScript, MUI 9 avec le thème de l'app réseau (charte V and B), react-router en HashRouter (GitHub Pages),
Supabase (même projet que l'app réseau), Playwright. Polices et icônes embarquées.

## Dossiers

| Dossier | Contenu |
| --- | --- |
| `src/moteur/` | Moteur de calcul pur : `types.ts` (hypothèses, résultats), `budget.ts` (calcul), `cibles.ts` (hypothèses par niveaux réseau, groupe, magasin), `parametres.ts` (paramètres par défaut, grille des frais), `reel.ts` (synthèse du réel d'une année, familles de la caisse), `saisieReel.ts` (saisie d'un mois à la main), `equipe.ts` (masse salariale chargée personne par personne, réduction générale), `saisieEquipe.ts` (fiche d'un poste), `atterrissage.ts` (atterrissage de l'année depuis le réel, base du budget suivant, frais du magasin), `saisieFrais.ts` (saisie des frais) |
| `src/import/` | Lecture des fichiers mensuels de la DSI (`caisse.ts` : ventes, tickets, aperçu avant import ; format dans [import-caisse.md](import-caisse.md)) |
| `src/data/` | Lecture de la base (`pilotage.ts`), chargement avec nouvelle tentative (`useChargement.ts`) |
| `src/auth/` | Connexion et rôle lu dans la base |
| `src/pages/` | Connexion, Magasins, fiche Magasin (onglets Budget, Atterrissage de l'année en cours, Réel avec choix de l'année et saisie d'un mois, Équipe, Frais), Hypothèses (cibles du réseau et des groupes), Imports de caisse (fichiers de la DSI, codes caisse), Paramètres réseau (dont charges sociales) |
| `src/layout/` | Cadre : barre du haut, menu latéral sur PC, barre basse sur téléphone |
| `supabase/` | Migrations du schéma `pilotage` et leurs tests |
| `tests/` | `moteur/` (calculs, sans navigateur), écrans sur PC et téléphone avec Supabase simulé |

## Flux

1. Connexion avec les identifiants de l'app réseau ; rôle lu par `mon_acces()`.
2. `pilotage.budgets_du_compte(annee)` renvoie les budgets du compte, les cibles du réseau et des groupes ; les
   paramètres viennent de `pilotage.parametres_reseau`.
3. Budget d'un magasin : sa base (réalisé proposé par le siège) passe par `appliquerCibles` (réseau, groupe, ajustements du
   magasin), puis par `calculerBudget`. Un budget validé garde les hypothèses figées à la validation.
4. Réel : chaque mois, le Directeur dépose les fichiers de la DSI (Imports de caisse) ; l'app les lit dans le navigateur,
   rattache les codes caisse aux magasins et remplace chaque mois reçu par `remplacer_reel`. Un mois peut aussi être saisi
   à la main depuis la fiche magasin. `syntheseReel` en tire cumul, marge, poids des familles et panier moyen.
5. Équipe : `chargerBudgets` lit aussi l'équipe des magasins du compte. Quand un magasin en a une, `hypothesesDe` la place
   dans ses hypothèses et `calculerBudget` calcule le personnel par `masseSalariale` (taux de la catégorie moins la
   réduction générale, hausse des salaires des cibles) au lieu des salaires saisis en bloc.
6. Frais : lus avec les budgets (`chargerFrais`) ; comme l'équipe, ils remplacent frais, amortissements et emprunts de la
   base tant que le budget n'est pas validé (`avecEquipeEtFrais`).
7. Atterrissage : `baseDepuisReel` part du réel de l'année (mois passés) et projette les mois restants sur la
   saisonnalité de chaque univers l'année précédente (à défaut, la moyenne réalisée) ; `calculerBudget` en tire le compte
   de résultat. Le Directeur en fait la base du budget de l'an prochain (« Proposer le budget »), que les cibles ajustent.

## Rôles

| Rôle | Voit | Écrit |
| --- | --- | --- |
| Directeur de réseau | Tous les magasins, hypothèses, paramètres, imports | Paramètres, cibles, groupes, budgets (valide, rouvre), réel (import et saisie), codes caisse, équipes, charges sociales |
| Responsable Régional, Coach | Magasins de leur périmètre | Réel, équipe et frais de leurs magasins |
| Franchisé | Ses magasins, avec les cibles qui s'y appliquent | Ajustements de son budget tant qu'il n'est pas validé, réel et équipe de ses magasins |

## Plan par lots

Recadré le 27/10/2026 : le budget se construit dans l'app, magasin par magasin, sans import du prévisionnel Excel.
0 Socle · 1 Cibles par niveaux et accord · 2 Réel de l'année (import DSI, saisie) · 3 Équipe et masse salariale ·
4 Frais et atterrissage · 5 Hypothèses de l'an prochain (travaux, duplication d'un magasin à l'autre, démarque) ·
6 Vue réseau · plus tard, connexion caisse.
