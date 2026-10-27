# Journal des versions

Ce qui a changé dans l'app de pilotage, lot par lot, du plus récent au plus ancien. La mention « Base » signale
une migration à passer dans Supabase (voir [supabase/README.md](supabase/README.md)).

## À venir

## Lot 6 — Refonte visuelle (27/10/2026)

Esprit Pennylane, couleurs de la charte V and B (Joseph, 27/10/2026).

- Fond clair et chaud, cartes sans bordure appuyée, marges plus larges ; tableaux aux chiffres alignés.
- Fiche magasin : nouvel onglet Synthèse, ouvert par défaut. Quatre cartes (CA HT cumulé et écart sur l'an dernier,
  marge commerciale, masse salariale sur marge, EBE attendu) avec leur courbe, alertes si l'équipe ou les frais manquent,
  graphique du CA mois par mois (réel, projection, an dernier) avec infobulle au survol.
- Compte de résultat sur 12 mois (budget et atterrissage) : rubriques repliées, dépliables d'un clic ou toutes ensemble,
  en-têtes et libellés figés au défilement, mois projetés en italique, total et part du CA.
- Accueil du Directeur, du RR et du Coach : budgets de l'année en quatre cartes (validés, CA et EBE budgétés, fiches à compléter).
- Saisie d'un mois de réel et d'un poste de l'équipe directement dans la page, sans fenêtre.
- Pas de migration.

## Lot 5 — Ergonomie (27/10/2026)

Tous les rôles travaillent sur PC (Joseph, 27/10/2026) : confort PC d'abord, téléphone tenu propre.

- Saisie jamais perdue : changer d'onglet, revenir à la liste, passer à un autre magasin ou fermer la page avec des
  modifications non enregistrées (frais, ajustements du budget, hypothèses, charges sociales, import en cours) demande
  confirmation.
- Accueil : filtres avec leur nombre (sans budget, proposés, en discussion, validés, équipe à renseigner, frais à
  renseigner), recherche sans accents au-delà de cinq magasins, choix du groupe ; les filtres restent au retour d'une
  fiche ; toute la ligne du tableau ouvre la fiche. Un franchisé qui n'a qu'un magasin arrive directement sur sa fiche.
- Fiche magasin : pastille sur les onglets où il manque quelque chose (budget à proposer pour le Directeur, réel en
  retard, équipe ou frais à renseigner) ; magasin précédent et suivant dans la liste filtrée, en restant sur le même onglet.
- Saisie rapide : Entrée passe au montant suivant ; les montants s'affichent avec les milliers (« 60 000 »).
- Vitesse : budgets, paramètres et réel gardés une minute en mémoire ; toute écriture et la déconnexion vident la mémoire.
- Pas de migration.

## Lot 4 — Frais et atterrissage (27/10/2026)

- Onglet Frais de la fiche magasin : les frais de l'année ligne par ligne sur la grille du réseau, regroupés par rubrique,
  chaque ligne en euros par an ou en part du CA ; emprunts et amortissements à part. Départ possible des lignes
  courantes (loyer, énergie, honoraires…). Saisie par le Directeur, le RR, le Coach ou le franchisé sur leurs magasins.
- Onglet Atterrissage de l'année en cours : réel des mois passés, mois restants projetés sur la saisonnalité de l'an
  dernier (ou la moyenne des mois réalisés), avec l'équipe et les frais du magasin. Compte de résultat et mois par mois,
  mois projetés distingués du réel.
- Le Directeur propose le budget de l'an prochain directement à partir de l'atterrissage ; les cibles du réseau, du
  groupe et du magasin s'y appliquent comme avant.
- Fiche plus légère : un seul onglet Réel avec le choix de l'année ; une seule barre d'enregistrement, en bas d'écran.
- Équipes et frais lus par pages de 1 000 lignes : au-delà, l'API tronquait silencieusement (réseau complet).
- Base : `0005_frais.sql` (table `frais`). À passer avant d'utiliser cette version.

## Lot 3 — Équipe et masse salariale (27/10/2026)

- Onglet Équipe de la fiche magasin : une ligne par poste, sans nom (« Vendeur 1 », « Gérant »), avec catégorie, heures,
  brut mensuel, primes annuelles au mois de versement, arrivée et départ au mois. Saisie par le Directeur, le RR, le Coach
  ou le franchisé, chacun sur ses magasins. Coût chargé de l'année en cours et de l'année budgétée, équivalents temps plein.
- Charges patronales par catégorie (employé, agent de maîtrise, cadre, apprenti, gérant TNS) moins la réduction générale
  dégressive (ex-réduction Fillon), calculée salarié par salarié sur son brut annuel ; pas de réduction pour un gérant
  TNS. Valeurs 2026 par défaut, modifiables par le Directeur dans les Paramètres réseau (décision de Joseph, 27/10/2026).
- Budget : quand le magasin a une équipe, les frais de personnel et le CA par heure viennent d'elle ; la hausse des
  salaires des cibles s'applique au brut de chacun.
- Base : `0004_equipe.sql` (table `equipe`). À passer avant d'utiliser cette version.

## Lot 2 — Réel de l'année (27/10/2026)

- Recadrage de Joseph : l'Excel n'est plus un fichier d'import mais le modèle que l'app reproduit. L'import du
  prévisionnel Excel est retiré.
- Imports de caisse (Directeur) : dépôt des fichiers mensuels de la DSI (ventes par famille, tickets par univers, format
  dans [docs/import-caisse.md](docs/import-caisse.md)), aperçu par magasin et par mois, lignes écartées expliquées, codes
  caisse inconnus à rattacher sur place, chaque mois reçu remplace l'existant. Le même format sert à l'année précédente.
- Fiche magasin : onglets Budget, Réel de l'année en cours et de la précédente (CA, marge théorique, tickets, panier
  moyen, CA par famille et par mois). Saisie ou correction d'un mois à la main par le Directeur, le RR, le Coach ou le
  franchisé, chacun sur ses magasins.
- Base : `0003_reel_annee.sql` (CA TTC, `reel_tickets`, `codes_caisse`, droits de saisie, `remplacer_reel()`). À passer
  avant d'utiliser cette version.

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
