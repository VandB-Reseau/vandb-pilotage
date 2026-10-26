# V and B Pilotage — consignes pour Claude

Outil de pilotage financier des magasins (budget, réel, quadrimestre, trésorerie). Mêmes règles que l'app réseau
(dépôt `VandB-Reseau/vandb-reseau`, son CLAUDE.md fait référence) pour pouvoir y être fusionné plus tard.

## Pile
React 19 + TypeScript + MUI 9 (thème `src/theme/theme.ts`, copie de l'app réseau), react-router (HashRouter, GitHub Pages),
Supabase (base partagée avec l'app réseau, schéma `pilotage`), Playwright.

## Règles
- Français partout dans l'interface. Vocabulaire de l'app réseau : Coach, RR / Responsable Régional, Directeur de réseau,
  magasin, Franchisé. Pas d'abréviation non expliquée, jamais « CS » ni « DR ».
- Aucun texte sous 12 px, zones tactiles ≥ 48 px sur téléphone (vérifié par les tests). Icônes `@mui/icons-material`, pas d'emojis.
- Pas de texte d'explication de l'outil dans l'interface. Aucune erreur technique à l'écran : messages humains, états vides
  qui expliquent et proposent l'action.
- PC = usage principal (menu latéral, tableaux complets) ; téléphone soigné.
- Montants HT dans tous les calculs ; le TTC ne sert qu'à la trésorerie et aux paniers saisis. Redevance 2 % et publicité 1 %
  du CA HT, au-dessus de l'EBE (Joseph, 26/10/2026). Année de 12 mois, poids mensuels à 100 %.
- Tout calcul financier passe par le moteur pur `src/moteur/` (aucun calcul dans les écrans), testé dans `tests/moteur/`
  avec un magasin fictif dont chaque résultat est vérifié à la main.
- Rôles : lus dans la base (`mon_acces()` de l'app réseau). Directeur : tous les magasins, propose et valide les budgets,
  tient les paramètres. Coach et RR : lisent les magasins de leur périmètre. Franchisé : son magasin, modifie ses hypothèses
  (le budget passe « en discussion »), ne valide pas. « Le siège propose, on se met d'accord. »
- Base : tout changement = une **nouvelle** migration `supabase/migrations/NNNN_sujet.sql` dans le schéma `pilotage`,
  réexécutable, sans jamais rouvrir un accès si elle est rejouée seule. On ne touche pas aux tables de l'app réseau ;
  ses fonctions utilisées sont copiées dans `supabase/tests/dependances_reseau.sql`. Dans la même demande de fusion :
  `docs/base-de-donnees.md` à jour, contrôle dans `supabase/tests/regles_acces.sql` si un accès change, `npm run test:base` vert.
  Aucune règle `USING (true)`. Chaque migration ajoute sa ligne dans `pilotage.journal_migrations`.
- Journal : chaque demande de fusion ajoute sa ligne dans `CHANGELOG.md`, avec la migration à passer s'il y en a une.
- Chaque fonctionnalité livrée a ses tests Playwright sur `pc` et `telephone`, avec Supabase simulé (`tests/supabase-simule.ts`).
- Dépôt **public** : aucune donnée réelle ni clé. Le prévisionnel Excel des magasins ne va jamais dans le dépôt.

## Commandes
- `npm run dev`, `npm run build`, `npm test`, `npm run test:moteur`, `npm run test:base`
- Sans téléchargement de navigateur : `CHROMIUM=/chemin/vers/chrome npm test`
