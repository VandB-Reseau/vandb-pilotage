# Architecture

## Pile

React 19, TypeScript, MUI 9 avec le thème de l'app réseau (charte V and B), react-router en HashRouter (GitHub Pages),
Supabase (même projet que l'app réseau), Playwright. Polices et icônes embarquées.

## Dossiers

| Dossier | Contenu |
| --- | --- |
| `src/moteur/` | Moteur de calcul pur : `types.ts` (hypothèses, résultats), `budget.ts` (calcul), `cibles.ts` (hypothèses par niveaux réseau, groupe, magasin), `parametres.ts` (paramètres par défaut, grille des frais) |
| `src/import/` | Lecture d'un .xlsx sans dépendance (`xlsx.ts`), base d'un magasin tirée de son prévisionnel Excel (`previsionnel.ts`, positions des cellules du modèle) |
| `src/data/` | Lecture de la base (`pilotage.ts`), chargement avec nouvelle tentative (`useChargement.ts`) |
| `src/auth/` | Connexion et rôle lu dans la base |
| `src/pages/` | Connexion, Magasins, fiche Magasin (import, hypothèses, validation), Hypothèses (cibles du réseau et des groupes), Paramètres réseau |
| `src/layout/` | Cadre : barre du haut, menu latéral sur PC, barre basse sur téléphone |
| `supabase/` | Migrations du schéma `pilotage` et leurs tests |
| `tests/` | `moteur/` (calculs, sans navigateur), écrans sur PC et téléphone avec Supabase simulé |

## Flux

1. Connexion avec les identifiants de l'app réseau ; rôle lu par `mon_acces()`.
2. `pilotage.budgets_du_compte(annee)` renvoie les budgets du compte, les cibles du réseau et des groupes ; les
   paramètres viennent de `pilotage.parametres_reseau`.
3. Budget d'un magasin : sa base (prévisionnel Excel importé) passe par `appliquerCibles` (réseau, groupe, ajustements du
   magasin), puis par `calculerBudget`. Un budget validé garde les hypothèses figées à la validation.

## Rôles

| Rôle | Voit | Écrit |
| --- | --- | --- |
| Directeur de réseau | Tous les magasins, hypothèses, paramètres | Paramètres, cibles, groupes, budgets (importe, valide, rouvre), réel |
| Responsable Régional, Coach | Magasins de leur périmètre | Rien pour l'instant |
| Franchisé | Ses magasins, avec les cibles qui s'y appliquent | Ajustements de son budget tant qu'il n'est pas validé |

## Plan par lots

0 Socle · 1 Budget (import, cibles par niveaux, accord) · 2 Réel et tableau de bord · 3 Quadrimestre ·
4 Trésorerie · 5 Vue réseau · 6 Connexion caisse.
