# Journal des versions

Ce qui a changé dans l'app de pilotage, lot par lot, du plus récent au plus ancien. La mention « Base » signale
une migration à passer dans Supabase (voir [supabase/README.md](supabase/README.md)).

## À venir

## Lot 1 — Construire le budget (26/10/2026)

- Hypothèses par niveaux (décision de Joseph) : le Directeur fixe les cibles du réseau (évolution du CA par univers et
  par famille, marge visée par famille, hausse des salaires, inflation des frais, évolution des tickets), crée des groupes
  libres de magasins avec leurs propres cibles, et voit l'effet sur le CA et l'EBE totaux. Chaque magasin reprend la
  cible la plus proche (magasin, groupe, réseau) ; sans cible, son réalisé.
- Import du prévisionnel Excel d'un magasin (modèle du réseau) depuis sa fiche : réalisé par famille, salaires, frais,
  emprunts. Le budget passe « proposé par le siège ». Lecture du fichier dans le navigateur, sans dépendance. Recoupé
  sur un fichier réel (hors dépôt) : même CA, même marge.
- Fiche magasin : hypothèses avec leur origine, écarts aux cibles du siège comptés ; le franchisé ajuste (le budget passe
  en discussion), le Directeur valide (hypothèses figées) ou rouvre la discussion. Coach et RR en lecture.
- Base : `0002_hypotheses_par_niveaux.sql` (groupes, cibles du réseau et des groupes, base et ajustements du budget,
  `budgets_du_compte()`). À passer avant d'utiliser cette version.

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
