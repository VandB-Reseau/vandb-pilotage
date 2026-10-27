# Fichiers mensuels de la DSI

Format défini le 27/10/2026. Chaque mois, la DSI fournit deux fichiers, déposés par le Directeur dans
**Imports de caisse**. Le même format sert à reprendre l'année précédente (un fichier par mois, ou un seul fichier pour
toute l'année).

## Règles communes

- CSV séparé par des points-virgules, encodage UTF-8 (avec ou sans BOM), première ligne = noms des colonnes.
- Montants HT et TTC en euros, virgule décimale (`1250,40`) ; les espaces de milliers sont acceptés.
- `date` : `AAAA-MM-JJ` (une ligne par jour) ou `AAAA-MM` (une ligne par mois). L'app cumule par mois.
- `univers` : `CAVE`, `BAR` ou `EXTERIEUR` (facturation hors magasin).
- `code_magasin` : code du magasin dans la caisse. Chaque code est rattaché une fois à un magasin dans l'app ; les lignes
  d'un code non rattaché ne sont pas importées.
- Réimporter un mois le remplace entièrement pour les magasins présents dans le fichier.

## `ventes_AAAA-MM.csv`

| Colonne | Contenu |
| --- | --- |
| `code_magasin` | Code caisse du magasin |
| `date` | Jour ou mois |
| `univers` | `CAVE`, `BAR`, `EXTERIEUR` |
| `famille` | `BIERE`, `VIN`, `SPIRITUEUX`, `SANS ALCOOL`, `ACCESSOIRE`, `FUT`, `ALIMENTAIRE`, `SOFT`, `COCKTAIL`, `AUTRE`, `FACTURES` (une autre famille est gardée telle quelle et signalée) |
| `ca_ht` | CA HT |
| `ca_ttc` | CA TTC (facultatif, sert au panier moyen) |
| `marge_ht` | Marge théorique de la caisse, HT |

```
code_magasin;date;univers;famille;ca_ht;ca_ttc;marge_ht
0101;2026-09-01;CAVE;BIERE;1000,00;1200,00;360,00
0101;2026-09-01;BAR;FUT;800,00;960,00;600,00
```

## `tickets_AAAA-MM.csv`

Un ticket se compte par univers, pas par famille.

| Colonne | Contenu |
| --- | --- |
| `code_magasin`, `date`, `univers` | Comme ci-dessus |
| `tickets` | Nombre de tickets (entier) |

```
code_magasin;date;univers;tickets
0101;2026-09-01;CAVE;40
0101;2026-09-01;BAR;30
```

## Contrôles à l'import

Une ligne illisible (date, univers, montant) est écartée et citée avec son numéro ; le reste du fichier s'importe. Un
fichier sans les colonnes attendues est refusé en entier.
