# Architecture

## Pile

React 19, TypeScript, MUI 9 avec le thème de l'app réseau (charte V and B), react-router en HashRouter (GitHub Pages),
Supabase (même projet que l'app réseau), Playwright. Polices et icônes embarquées.

## Dossiers

| Dossier | Contenu |
| --- | --- |
| `src/moteur/` | Moteur de calcul pur : `types.ts` (hypothèses, résultats), `budget.ts` (calcul), `parametres.ts` (paramètres par défaut, grille des frais) |
| `src/data/` | Lecture de la base (`pilotage.ts`), chargement avec nouvelle tentative (`useChargement.ts`) |
| `src/auth/` | Connexion et rôle lu dans la base |
| `src/pages/` | Connexion, Magasins, fiche Magasin, Paramètres réseau |
| `src/layout/` | Cadre : barre du haut, menu latéral sur PC, barre basse sur téléphone |
| `supabase/` | Migrations du schéma `pilotage` et leurs tests |
| `tests/` | `moteur/` (calculs, sans navigateur), écrans sur PC et téléphone avec Supabase simulé |

## Flux

1. Connexion avec les identifiants de l'app réseau ; rôle lu par `mon_acces()`.
2. `pilotage.magasins_du_compte(annee)` renvoie les magasins du compte et leur budget ; les paramètres viennent de
   `pilotage.parametres_reseau`.
3. Chaque écran passe les hypothèses au moteur (`calculerBudget`) : le compte de résultat est recalculé dans le
   navigateur, rien n'est stocké en double.

## Rôles

| Rôle | Voit | Écrit |
| --- | --- | --- |
| Directeur de réseau | Tous les magasins, paramètres | Paramètres, budgets (propose, valide), réel |
| Responsable Régional, Coach | Magasins de leur périmètre | Rien pour l'instant |
| Franchisé | Ses magasins | Hypothèses de son budget tant qu'il n'est pas validé |

## Plan par lots

0 Socle (ce lot) · 1 Budget (saisie, proposition, accord) · 2 Réel et tableau de bord · 3 Quadrimestre ·
4 Trésorerie · 5 Vue réseau · 6 Connexion caisse.
