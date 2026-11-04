# V and B Pilotage

Outil de pilotage financier des magasins du réseau V and B : budget annuel construit par univers et famille de produits,
suivi du réel, recalage tous les quatre mois, trésorerie. Même
base Supabase (mêmes comptes, mêmes magasins), dans le schéma `pilotage` ; depuis la fusion (novembre 2026), ses écrans vivent dans l'app réseau (menu « Budgets ») et l'adresse publique du pilotage y renvoie ; ce dépôt garde la base (schéma `pilotage`).

- Vision, constats et plan par lots : document de cadrage du 26/10/2026 (hors dépôt).
- Architecture : [docs/architecture.md](docs/architecture.md) · Base : [docs/base-de-donnees.md](docs/base-de-donnees.md)
  · Migrations : [supabase/README.md](supabase/README.md) · Journal : [CHANGELOG.md](CHANGELOG.md)

## Commandes

- `npm run dev` : développement
- `npm run build` : vérification TypeScript + construction
- `npm test` : moteur de calcul, puis l'app sur PC et téléphone (captures dans `captures/`)
- `npm run test:moteur` : moteur de calcul seul
- `npm run test:base` : migrations rejouées sur un PostgreSQL local, règles d'accès contrôlées

## Mise en service (une fois)

1. Supabase, éditeur SQL : passer les migrations de `supabase/migrations/` dans l'ordre (`0001`, `0002`, `0003`, `0004`, `0005`…).
2. Supabase, Integrations > Data API > Settings > Exposed schemas : ajouter `pilotage`, puis Save.
3. GitHub, Settings > Secrets and variables > Actions : secret `VITE_SUPABASE_ANON_KEY` (la même clé que l'app réseau).
4. GitHub, Settings > Pages : source « GitHub Actions » ; Settings > General : branche par défaut `main`.

Dépôt public : aucune donnée réelle ni clé dans le dépôt, tests avec des données fictives uniquement.
