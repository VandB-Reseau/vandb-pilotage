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

## `quadrimestres_AAAA-Q.csv` (comptables)

Tous les 4 mois, un fichier pour un ou plusieurs magasins, déposé par le Directeur dans **Imports de caisse**. Une ligne
par magasin et par quadrimestre ; un montant vide reste à saisir dans la fiche magasin. Réimporter remplace la ligne.

| Colonne | Contenu |
| --- | --- |
| `code_magasin` | Code caisse du magasin, ou son nom |
| `annee` | Année |
| `quadrimestre` | `1` (janvier à avril), `2` (mai à août), `3` (septembre à décembre) |
| `achats` | Achats de marchandises HT de la période |
| `variation_stock` | Stock de fin − stock de début (négatif si le stock baisse) |
| `charges_externes` | Charges externes HT, redevance et publicité comprises |
| `impots_taxes` | Impôts et taxes |
| `personnel` | Frais de personnel (salaires et charges, rémunération du gérant comprise) |
| `tresorerie` | Trésorerie en fin de période |

```
code_magasin;annee;quadrimestre;achats;variation_stock;charges_externes;impots_taxes;personnel;tresorerie
0101;2027;1;130000;8000;30000;3000;35000;25000
```

## FEC du comptable (fiche magasin, onglet Quadrimestres)

Export standard des logiciels comptables (article A47 A-1 du livre des procédures fiscales) : une écriture par ligne,
champs séparés par une tabulation ou une barre verticale, encodage UTF-8 ou Windows. Colonnes lues : `CompteNum`,
`CompteLib`, `EcritureDate` (AAAAMMJJ), `Debit` et `Credit`, ou `Montant` et `Sens`. Le fichier est lu dans le
navigateur et n'est pas enregistré : seuls les six montants du quadrimestre sont repris dans la saisie.

| Montant | Comptes (racines du plan comptable général) |
| --- | --- |
| Achats de marchandises | 601, 602, 607, 6081, 6082, 6087, 6091, 6092, 6097 |
| Variation de stock (fin − début) | 603, signe inversé ; vide si aucun stock n'est passé sur la période |
| Charges externes | 604, 605, 606, 608, 609 (autres), 61, 62 (intérim 621 compris), 651 (redevance) |
| Impôts et taxes | 63 |
| Personnel | 64 (gérant non salarié 644 et 646 compris) |
| Hors EBE | 66, 67, 68, 69 |
| À ranger par le magasin | 65 hors 651 ; le choix est gardé pour les imports suivants (`correspondances_fec`) |
| Trésorerie de fin de période | Solde des comptes 51 et 53 à la dernière date du quadrimestre, à-nouveaux compris |

Un quadrimestre est proposé si le fichier commence au plus tard le premier jour et a des écritures le dernier mois.
Le CA du FEC (comptes 70) est comparé au CA de la caisse ; au-delà de 2 % d'écart, une alerte s'affiche.

## Contrôles à l'import

Une ligne illisible (date, univers, montant) est écartée et citée avec son numéro ; le reste du fichier s'importe. Un
fichier sans les colonnes attendues est refusé en entier.
