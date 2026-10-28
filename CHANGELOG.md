# Journal des versions

Ce qui a changé dans l'app de pilotage, lot par lot, du plus récent au plus ancien. La mention « Base » signale
une migration à passer dans Supabase (voir [supabase/README.md](supabase/README.md)).

## À venir

### Lot 24 — Projection du CA : rythme de sortie, ancienneté, temps forts

- **Base : `0014_ouvertures.sql`** (table `ouvertures`, date d'ouverture de chaque magasin, écrite par le Directeur).
- Budget, carte « Base du CA » : pour la Cave et le Bar, rythme de sortie de l'année (4 derniers mois réalisés ÷ leur
  poids dans la saisonnalité) face à l'atterrissage hors temps forts. Retenu d'office jusqu'à 15 % d'écart, au-delà
  sur confirmation du Directeur, qui peut aussi garder l'atterrissage. Le Directeur y renseigne la date d'ouverture ;
  l'ancienneté (année 1, 2, 3, 4 et plus) s'affiche. Les budgets déjà proposés n'ont pas de rythme mesuré : il apparaît
  à la prochaine mise à jour de la proposition depuis l'atterrissage.
- Hypothèses du réseau : hausse tarifaire (valeur par défaut du panier) et tableau « Selon l'ancienneté du magasin »
  (tickets et panier en plus des prix, Cave et Bar), avec la médiane constatée dans le réseau à partir de 8 magasins.
  Ordre des valeurs : magasin, groupe, ancienneté, réseau, hausse tarifaire, réalisé.
- Budget, carte « Temps forts » (événement extérieur, soirée en magasin, opération commerciale) : CA de l'an passé
  retiré de la base, CA du budget ajouté dans son mois, extras de personnel, autres charges, mois de paiement des achats.
- Budget, carte « Clients gagnés ou perdus » : montant HT par mois ou part du CA de l'univers, de tel mois à tel mois.
- Trésorerie : achats de l'Extérieur payés un mois avant la vente (réglable) ; opérations du réseau dans les
  Paramètres réseau (mois de vente, mois de paiement, part des achats avancée). Le compte de résultat détaille le CA
  de chaque univers mois par mois.

### Lot 23 — Frais de l'onglet FFBUD

- Onglet Frais : les lignes de l'onglet FFBUD du prévisionnel, dans son ordre, en trois blocs avec leur total
  (charges externes, impôts et taxes, autres charges), puis sous l'EBE : dotations aux amortissements, intérêts et
  charges assimilées (emprunts, comptes courants, agios) et capital remboursé, et le total des frais prévisionnels.
  Publicité franchise et royalties apparaissent à leur place, calculées sur le CA. Nouvelles lignes : participation à
  la formation continue, taxe d'apprentissage, CSG déductible GC et AC, intérêts des comptes courants, agios.
- Compte de résultat : « Autres charges » (droits d'auteur, charges diverses) sur sa ligne, au-dessus de l'EBE ;
  « Royalties » et « Publicité franchise » dans les charges externes.
- Import du FEC : chaque compte de charges indique sa ligne de frais.
- Sans migration.

### Lot 22 — Cave et Bar séparés, tickets, panier et mix comme leviers du budget

- Budget : le CA de la Cave et celui du Bar se construisent chacun par CA attendu × (1 + évolution des tickets) ×
  (1 + évolution du panier moyen). Les familles d'un univers s'y répartissent par leur part (réglable : les parts
  fixées restent, les autres se partagent le reste comme cette année). Le compte de résultat reste celui du magasin :
  marge et démarque par famille, achats et charges inchangés. La grille d'hypothèses montre les tickets et le panier
  de chaque univers, réalisés et visés ; cibles du réseau et des groupes : tickets, panier et parts des familles.
- Les anciennes évolutions de CA par univers ou par famille ne s'appliquent plus à la Cave et au Bar d'un magasin
  qui a ses tickets : à ressaisir en tickets et panier. Les budgets enregistrés avant restent calculés comme alors.
- Réel, vue Réseau, médianes et export Excel : tickets, panier TTC et évolution des tickets sur l'an dernier pour la
  Cave et pour le Bar, jamais additionnés.
- **Base : migration `0013_cave_bar_separes.sql` à passer.** Sans elle, la vue Réseau n'affiche pas les paniers.

### Lot 21 — Plan d'action relié aux alertes

- Synthèse du magasin : « Agir » sur une alerte (Directeur, RR, Coach) ajoute une action au plan : quoi, qui
  (franchisé, Coach, Responsable Régional, Directeur), pour quand. L'action garde la mesure du jour (écart au budget,
  points de marge, mois manquants, trésorerie) et montre celle d'aujourd'hui, en vert si elle s'améliore. Actions sans
  alerte possibles. Le franchisé voit le plan de son magasin, marque ses actions faites ou abandonnées, et les retrouve
  dans son « À faire ». Accueil et vue Réseau : « Action en cours » à côté des alertes déjà prises en main.
- **Base : migration `0012_actions.sql` à passer (après `0011`).**

### Lot 20 — Échanges sur le budget

- Onglet Budget : messages entre le siège, le RR, le Coach et le franchisé, par sujet (général, CA, marge, personnel,
  frais, travaux, trésorerie) ; chacun retire ses propres messages. Historique du budget : une version à chaque
  proposition, ajustement, validation ou réouverture, avec qui, quand, le CA, l'EBE et l'écart d'EBE à la version
  précédente (recalculés avec les cibles du moment).
- **Base : migration `0011_echanges_budget.sql` à passer.**

### Lot 19 — Import du FEC

- Onglet Quadrimestres : « Importer le FEC » du comptable. Montants du quadrimestre calculés sur les racines du plan
  comptable (achats, variation de stock, charges externes, impôts et taxes, personnel, trésorerie), comptes inconnus à
  ranger une fois par magasin, contrôle du CA face à la caisse, alerte si aucun stock n'est passé sur la période.
  Le fichier n'est pas enregistré ; les montants sont repris dans la saisie avant d'enregistrer.
- **Base : migration `0010_correspondances_fec.sql` à passer.** Sans elle, l'import marche, sans garder le classement.

### Lot 18 — Espace franchisé

- Synthèse du magasin, pour le franchisé : liste « À faire » (réel du dernier mois terminé, quadrimestre fini à saisir,
  budget proposé par le siège ou en discussion, équipe, frais), chaque ligne ouvre l'onglet ; « Tout est à jour »
  sinon. Rien de changé pour l'équipe.
- Pas de migration.

### Lot 16 — Atterrissage sans réel de l'an dernier

- Atterrissage d'un magasin : tableau « Projection des mois restants » par univers (réalisé, méthode, part de l'année
  réalisée, atterrissage). Sans réel de l'an dernier, la part de l'année réalisée peut être saisie par univers, comme
  dans le prévisionnel Excel (CA atterri = réalisé / part) ; à défaut, la saisonnalité médiane du réseau l'an dernier
  (au moins 3 magasins avec leurs 12 mois), puis la moyenne des mois réalisés. Repris dans la synthèse.
- **Base : migration `0009_parts_realisees.sql` à passer.**

### Lot 17 — Trésorerie glissante

- Onglet Quadrimestres : trésorerie prévue jusqu'à décembre, à partir de la dernière trésorerie saisie (fin avril ou
  fin août) et des flux de l'atterrissage de l'année (mêmes délais et TVA que la trésorerie du budget). Point bas prévu,
  mois à découvert, trésorerie de fin décembre ; suit la saisie sans enregistrer.
- Pas de migration.

### Lot 12 — Quadrimestres : résultat réel tous les 4 mois

- Fiche magasin, onglet Quadrimestres : six montants comptables par période (achats de marchandises, variation de
  stock, charges externes redevance et publicité comprises, impôts et taxes, frais de personnel, trésorerie de fin de
  période). Le CA vient de la caisse ; l'app calcule la marge réelle (CA − achats + variation de stock), l'écart à la
  marge théorique de la caisse (démarque constatée), l'EBE réel, l'EBE / CA et l'écart à l'EBE du budget, par
  quadrimestre et en cumul. Saisie par le Directeur, le RR, le Coach et le franchisé sur leurs magasins.
- Imports de caisse : fichier des comptables (plusieurs magasins d'un coup, code caisse ou nom du magasin).
- **Base : migration `0008_quadrimestres.sql` à passer.**

### Lot 13 — Alertes

- Accueil, vue Réseau (selon les filtres) et synthèse d'un magasin : CA cumulé sous le budget, taux de marge en baisse
  sur l'an dernier aux mêmes mois (marge de caisse contre marge de caisse), réel en retard, trésorerie sous le seuil
  (fin du dernier quadrimestre, ou point bas du budget à venir quand la trésorerie de départ est saisie). Les plus
  graves d'abord, filtre par type, lien vers l'onglet concerné.
- Paramètres réseau : seuils modifiables (5 % sous le budget, 1 point de marge, 1 mois de retard, trésorerie sous 0 €
  par défaut). Pas d'alerte de retard tant qu'aucun réel de l'année n'est importé.
- Pas de migration (seuils dans `parametres_reseau.valeur`).

### Lot 14 — Et si…

- Fiche magasin, onglet « Et si… » : variation du CA, du taux de marge, hausse du loyer, embauche (salaire, heures,
  catégorie, mois d'arrivée, charges moins la réduction générale). Effet sur la marge, le personnel, l'EBE, le résultat
  net, la trésorerie de fin d'année et son point bas, face au budget. Rien n'est enregistré.
- Pas de migration.

### Lot 15 — Face au réseau

- Synthèse d'un magasin (Directeur, RR, Coach) : taux de marge, masse salariale / marge, loyer / CA, panier moyen et
  EBE / CA face à la médiane du groupe et du réseau, avec le rang ; sur le réel à date ou sur les budgets de l'an
  prochain. Au moins 3 magasins pour une médiane.
- Vue Réseau : colonne Loyer / CA (aussi dans l'export Excel) et ligne de la médiane de la sélection (un filtre par
  groupe donne la médiane du groupe).
- Pas de migration.

## Lot 11 — Consignes dans la trésorerie (28/10/2026)

- Trésorerie du budget : consignes versées aux fournisseurs avec les achats (fûts, caisses, gaz) et remboursées une
  fois le fût écoulé et rendu, à 30 jours fin de mois ; hors TVA et hors compte de résultat. Carte « Consignes avancées
  aux fournisseurs » : argent bloqué en moyenne et au plus haut. Lignes dans l'export Excel. Les cautions des clients
  (empreintes bancaires) ne sont pas encaissées et ne comptent pas.
- Paramètres réseau : consigne en part des achats de chaque univers (Cave 3 %, Bar et Extérieur 15 % par défaut),
  temps pour écouler un fût (1 mois) et délai de remboursement (1 mois), tous modifiables.
- Pas de migration.

## Lot 10 — Trésorerie du budget (28/10/2026)

- Budget d'un magasin : trésorerie mois par mois en montants TTC (encaissements, fournisseurs, frais, redevance et
  publicité, salaires et cotisations, TVA, emprunts, acomptes d'impôt, travaux), solde de fin de mois, point bas et mois
  à découvert. Trésorerie au 1er janvier saisie par magasin, enregistrée avec les ajustements (non copiée d'un magasin
  à l'autre). Onglet Trésorerie dans l'export Excel, soldes en formules.
- Liste des magasins : colonne Point bas de trésorerie, en rouge sous zéro.
- Paramètres réseau : délais de paiement des fournisseurs et de la redevance, TVA des ventes, des achats et des frais,
  déclaration de TVA mensuelle ou trimestrielle, part du coût du personnel payée le mois suivant. Valeurs par défaut :
  30 jours fin de mois, TVA mensuelle, 40 % de cotisations le mois suivant, à confirmer par Joseph.
- Pas de migration : paramètres dans `parametres_reseau.valeur`, trésorerie de départ dans les ajustements.

## Lot 9 — Export Excel, impression, filtre par Responsable Régional (28/10/2026)

**Base : passer `supabase/migrations/0007_filtre_rr.sql`** (remplace la fonction de lecture de la vue réseau, aucune table).

- Budget d'un magasin : bouton Exporter en Excel (compte de résultat sur 12 mois et hypothèses par famille ; totaux, parts
  du CA et marge de chaque famille en formules) et bouton Imprimer (A4 paysage, sans menus ni boutons).
- Vue Réseau : export Excel de la sélection affichée (filtres et tri compris) et impression, avec la sélection et la
  date en tête.
- Vue Réseau, Directeur : filtre et colonne Responsable Régional, noms lus dans la fiche des RR de l'app réseau.

## Lot 8 — Budgets 2027 complets (28/10/2026)

- Démarque par famille, en part du CA, déduite de la marge visée : colonne de la grille des hypothèses du magasin, et
  cible possible pour le réseau ou un groupe (page Hypothèses).
- Saisonnalité propre au magasin : part du CA de chaque mois saisie dans la cellule, CA du mois recalculé ; un total
  différent de 100 % bloque l'enregistrement ; retour possible au CA de référence.
- Travaux : activité de chaque mois (fermé, réduit), gain de CA après réouverture, investissement amorti à partir de la
  réouverture ; effet sur le CA et dotation affichés, compte de résultat à jour.
- Directeur : copie des hypothèses d'un magasin vers d'autres magasins au budget proposé ou en discussion (les travaux
  de chacun restent).
- Pas de migration : les nouvelles hypothèses vivent dans les ajustements déjà enregistrés.

## Lot 7 — Pilotage du réel face au budget (27/10/2026)

**Base : passer `supabase/migrations/0006_suivi_reseau.sql`** (une fonction de lecture, aucune table).

- Fiche magasin : onglet Suivi du budget de l'année en cours. Réel face au budget mois par mois (CA, marge, écarts en
  euros), cartes du cumul (écart en %, mois sous le budget, taux de marge en points, écart de marge), graphique réel et
  budget avec infobulle. La marge ne compte que sur les mois où la caisse la donne pour toutes les familles.
- Vue Réseau (Directeur, RR, Coach) : chaque magasin à la fin de son dernier mois réalisé, avec CA, évolution sur l'an
  dernier, écart au budget, taux de marge, panier moyen, masse salariale sur marge et EBE estimé à date ; total du réseau
  pondéré par le CA ; tri par colonne, recherche, filtres par groupe et par Coach ; écarts négatifs en rouge.
- Budget : hypothèses en grille famille par famille (CA attendu, évolution, CA visé, marge visée, marge), saisies dans
  la cellule, totaux par univers recalculés à chaque frappe.

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
