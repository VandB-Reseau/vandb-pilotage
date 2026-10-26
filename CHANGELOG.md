# Journal des versions

Ce qui a changé dans l'app de pilotage, lot par lot, du plus récent au plus ancien. La mention « Base » signale
une migration à passer dans Supabase (voir [supabase/README.md](supabase/README.md)).

## À venir

## Lot 0 — Socle (26/10/2026)

- Socle de l'app : connexion avec les comptes de l'app réseau, rôle lu dans la base, liste des magasins du compte avec
  l'avancement des budgets (validés, en discussion, proposés, sans budget), fiche magasin (indicateurs clés, compte de
  résultat, mois par mois), paramètres réseau pour le Directeur. Tests sur PC et téléphone.
- Moteur de calcul du budget (`src/moteur/`) : atterrissage au poids réel de l'année (plus de 13e mois), poids mensuels à
  100 %, achats HT dans le compte de résultat, redevance 2 % et publicité 1 % au-dessus de l'EBE, impôt sur les sociétés
  calculé, seconde projection par flux × panier. Recoupé avec le prévisionnel Excel corrigé d'un magasin (hors dépôt) :
  même CA et même marge ; le reste de l'écart vient de lignes que l'Excel oubliait ou plaçait sous l'EBE.
- Base : `0001_socle_pilotage.sql` (schéma `pilotage`, paramètres réseau, budgets avec circuit proposé / en discussion /
  validé, réel mensuel, journal). Après passage : ajouter `pilotage` aux schémas exposés de l'API.
