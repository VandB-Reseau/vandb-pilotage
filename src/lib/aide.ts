// Textes des icônes d'aide (lot 25), tous ici pour être relus d'un coup. Trois lignes par sujet : ce que c'est, comment le
// remplir, comment il entre dans le calcul. L'aide ne s'affiche qu'à la demande, derrière l'icône.
export interface TexteAide { titre: string; quoi: string; remplir?: string; calcul: string }

export const AIDE = {
  tickets: {
    titre: 'Évolution du nombre de tickets',
    quoi: 'La hausse ou la baisse du nombre de passages en caisse sur l’année, face au rythme actuel du magasin.',
    remplir: 'En pourcentage. Sans saisie, la valeur proposée par le siège pour l’ancienneté du magasin s’applique. Monte-la si une action fera venir plus de clients : animation, communication, nouveau quartier.',
    calcul: 'CA de l’univers = base × (1 + tickets) × (1 + panier).',
  },
  panier: {
    titre: 'Évolution du panier moyen',
    quoi: 'La hausse ou la baisse du montant moyen d’un ticket, TTC.',
    remplir: 'En pourcentage. Elle comprend la hausse des prix proposée par le siège et ce qu’apporte la vente additionnelle.',
    calcul: 'CA de l’univers = base × (1 + tickets) × (1 + panier).',
  },
  mix: {
    titre: 'Part de la famille dans son univers',
    quoi: 'Le poids de la famille dans le CA de la Cave ou du Bar.',
    remplir: 'Laisse vide pour garder la part actuelle. Change-la si tu développes une famille (mise en avant, plus de linéaire) : les familles laissées vides se partagent le reste.',
    calcul: 'Elle ne change pas le CA de l’univers, seulement la marge : une famille mieux margée qui pèse plus fait monter la marge.',
  },
  evolution: {
    titre: 'Évolution du CA de la famille',
    quoi: 'Pour un univers sans tickets, comme l’Extérieur : la hausse ou la baisse du CA de la famille.',
    remplir: 'En pourcentage, face au CA attendu cette année.',
    calcul: 'CA de la famille = CA attendu × (1 + évolution).',
  },
  univers: {
    titre: 'Évolution du CA par univers',
    quoi: 'L’évolution du CA d’un univers sans tickets, comme l’Extérieur.',
    remplir: 'En pourcentage.',
    calcul: 'Elle s’applique à chaque famille de l’univers qui n’a pas sa propre évolution.',
  },
  marge: {
    titre: 'Marge visée',
    quoi: 'Le taux de marge théorique de la famille, d’après ses prix de vente et d’achat.',
    remplir: 'En pourcentage du CA HT. Sans saisie, celui constaté en caisse.',
    calcul: 'Marge de la famille = CA × (marge visée − démarque).',
  },
  margeUnivers: {
    titre: 'Marge visée de l’univers',
    quoi: 'La moyenne des marges visées des familles de l’univers, pondérée par leur CA.',
    remplir: 'En pourcentage du CA HT. Une saisie décale chaque famille du même nombre de points : l’écart entre familles reste. Pour régler une famille seule, ouvre le détail par famille.',
    calcul: 'Marge de l’univers = somme des familles de CA × (marge visée − démarque).',
  },
  demarqueUnivers: {
    titre: 'Démarque de l’univers',
    quoi: 'Ce qui se perd entre la marge théorique et la marge réelle sur tout l’univers : casse, vol, offerts, erreurs de prix.',
    remplir: 'En pourcentage du CA. La valeur saisie s’applique à chaque famille de l’univers ; le détail par famille permet d’en régler une à part.',
    calcul: 'Marge de la famille = CA × (marge visée − démarque).',
  },
  demarque: {
    titre: 'Démarque',
    quoi: 'Ce qui se perd entre la marge théorique et la marge réelle : casse, vol, offerts, erreurs de prix.',
    remplir: 'En pourcentage du CA de la famille. Repère : l’écart entre la marge de caisse et la marge des comptes.',
    calcul: 'Marge de la famille = CA × (marge visée − démarque).',
  },
  hausseSalaires: {
    titre: 'Hausse des salaires',
    quoi: 'La hausse des salaires de l’équipe sur l’année.',
    remplir: 'En pourcentage : hausse du SMIC et augmentations prévues.',
    calcul: 'Appliquée à chaque salaire de l’équipe ; les charges et la réduction de cotisations sont recalculées personne par personne.',
  },
  inflationFrais: {
    titre: 'Inflation des frais',
    quoi: 'La hausse des frais saisis en euros : loyer, assurances, honoraires…',
    remplir: 'En pourcentage.',
    calcul: 'Frais de l’année × (1 + inflation). Les frais en pourcentage du CA, la redevance et la publicité suivent le CA.',
  },
  base: {
    titre: 'Base du CA',
    quoi: 'Le point de départ du budget : le CA attendu cette année, ou le rythme des 4 derniers mois s’il montre une tendance nette.',
    calcul: 'Rythme = CA des 4 derniers mois ÷ leur poids dans l’année. Retenu d’office si l’écart au CA attendu reste sous 15 %, au-delà sur décision du Directeur de réseau.',
  },
  tempsForts: {
    titre: 'Temps forts',
    quoi: 'Les événements qui font un CA à part : salons, marchés de Noël, soirées, opérations commerciales.',
    remplir: 'Pour chacun : le CA de l’an passé, le CA prévu, les autres charges et le mois où les achats sont payés. Les extras de personnel se saisissent dans Équipe.',
    calcul: 'Le CA de l’an passé sort de la base pour ne pas être compté deux fois ; le CA prévu s’ajoute dans son mois, avec ses charges.',
  },
  ajustements: {
    titre: 'Clients gagnés ou perdus',
    quoi: 'Un changement daté qui n’est pas dans la base : nouveau marché, association, concurrent qui ouvre.',
    remplir: 'Un montant par mois, ou un pourcentage du CA de l’univers, du premier au dernier mois concerné.',
    calcul: 'S’ajoute au CA des mois concernés, ou s’en retire.',
  },
  saisonnalite: {
    titre: 'Saisonnalité',
    quoi: 'La part de chaque mois dans le CA de l’année.',
    remplir: 'Sans saisie, celle de l’an passé. Change un mois qui sera différent : fermeture, nouvel événement.',
    calcul: 'Les parts sont ramenées à 100 % ; le CA de l’année est réparti selon elles.',
  },
  travaux: {
    titre: 'Travaux',
    quoi: 'Une fermeture ou une activité réduite pendant des travaux, et le gain de CA attendu après.',
    remplir: 'L’activité de chaque mois touché, le gain après réouverture, le montant investi et sa durée d’amortissement.',
    calcul: 'CA de chaque mois × part ouverte ; l’investissement s’amortit à partir de la réouverture.',
  },
  tresorerie: {
    titre: 'Trésorerie',
    quoi: 'Le solde bancaire prévu mois par mois.',
    remplir: 'Saisis le solde prévu au 1er janvier.',
    calcul: 'Chaque mois : ventes encaissées TTC − fournisseurs, personnel, frais, TVA, emprunts. Les délais de paiement sont fixés par le siège.',
  },
  versions: {
    titre: 'Versions du budget',
    quoi: 'Des copies du budget enregistrées sous un nom : prudente, ambitieuse, avec un vendeur de plus…',
    remplir: 'Enregistre le budget tel qu’il est, change des hypothèses, puis enregistre une autre version. « Reprendre » remet les hypothèses d’une version dans le budget en cours, sans l’enregistrer.',
    calcul: 'Chaque version se recalcule avec les cibles du siège d’aujourd’hui, et avec l’équipe et les frais du jour où elle a été enregistrée. Les écarts sont donnés face au budget en cours.',
  },
  leviers: {
    titre: 'Leviers commerciaux',
    quoi: 'Ce que rapporteraient sur un an plus de clients, un panier plus fort ou un mix mieux margé, Cave et Bar séparés.',
    remplir: 'Tickets en pourcentage, panier en euros TTC par ticket, mix en points de taux de marge. Rien n’est enregistré : « En faire une action » met le levier au plan d’action.',
    calcul: 'CA de l’univers × (1 + tickets) × (1 + euros de panier ÷ panier TTC) ; marge au taux de l’univers plus les points de mix ; redevance et publicité suivent le CA, l’équipe et les frais ne bougent pas.',
  },
  ficheVisite: {
    titre: 'Fiche de visite',
    quoi: 'Une page A4 à imprimer avant la visite : les chiffres à date, les alertes, le plan d’action et les trois sujets à aborder.',
    calcul: 'Les sujets sont classés par la marge en jeu depuis le 1er janvier : CA manquant face au budget, points de marge perdus, tickets perdus au panier de l’an dernier, euros de panier perdus sur les tickets de l’année.',
  },
  economie: {
    titre: 'Économie du franchisé',
    quoi: 'Le CA à partir duquel le magasin gagne de l’argent (point mort), la marge de sécurité au-dessus, la rémunération du gérant et ce qu’il reste après les emprunts.',
    remplir: 'Rémunération visée : charges comprises, par an. Rien n’est enregistré.',
    calcul: 'Coûts variables : achats, redevance, publicité et frais en part du CA. Tout le reste jusqu’au résultat avant impôt est fixe. Point mort = coûts fixes ÷ taux de marge sur coûts variables. Reste disponible = capacité d’autofinancement − capital remboursé.',
  },
  familles: {
    titre: 'Familles face au réseau',
    quoi: 'Le poids de chaque famille dans le CA de son univers et sa marge, face à la médiane des magasins qui ont cet univers. Une famille absente compte pour 0 %.',
    calcul: 'Potentiel : si le magasin pèse moins que la médiane sur une famille mieux margée que le reste de l’univers, (poids médian − poids) × CA de l’univers × (taux de la famille − taux du reste). CA réalisé de l’année en cours.',
  },
  semaine: {
    titre: 'Ma semaine',
    quoi: 'Les magasins du périmètre classés par la marge en jeu depuis janvier, pour savoir où aller en premier.',
    calcul: 'Marge en jeu : la somme des trois sujets de la fiche de visite (CA sous le budget, points de marge perdus, tickets et panier en baisse face à l’an dernier).',
  },
  objectifsMois: {
    titre: 'Objectifs du mois',
    quoi: 'Le budget du mois traduit pour l’équipe : clients par jour et panier moyen visés, Cave et Bar séparés, face au même mois de l’an dernier.',
    remplir: 'Choisis le mois et corrige les jours d’ouverture si le magasin ferme un autre jour que le dimanche.',
    calcul: 'Clients du mois = CA HT du budget × (1 + TVA moyenne) ÷ panier visé ; par jour = ÷ jours d’ouverture. Un euro de plus par client = nombre de clients du mois.',
  },
  extras: {
    titre: 'Extras',
    quoi: 'Les heures faites par des extras sur l’année, comme un poste de l’équipe : renforts du samedi, de décembre, des temps forts.',
    remplir: 'Les heures moyennes d’extras par semaine ou par mois, toutes personnes confondues, et le taux horaire brut, congés payés compris. Arrivée et départ pour une saison seulement.',
    calcul: 'Brut du mois = heures moyennes du mois × taux horaire. Charges au taux de la catégorie, moins la réduction générale calculée sur le taux horaire. Les heures comptent dans le CA par heure travaillée.',
  },

  // Lot 32 : comment se calcule chaque chiffre (picto (i) à côté du chiffre, Joseph 29/10/2026)
  achatsConsommes: {
    titre: 'Achats consommés',
    quoi: 'Le coût d’achat HT des marchandises vendues sur la période.',
    calcul: 'Budget : CA × (1 − marge visée de chaque famille), démarque comprise. Réel : achats − variation de stock.',
  },
  margeCommerciale: {
    titre: 'Marge commerciale',
    quoi: 'Ce que rapportent les ventes une fois les marchandises payées, avant tous les frais.',
    calcul: 'CA HT − achats consommés. Budget : somme des familles de CA × (marge visée − démarque). Taux = marge ÷ CA.',
  },
  margeTheorique: {
    titre: 'Marge théorique',
    quoi: 'La marge calculée par la caisse sur les prix d’achat en fiche, sans la casse, le vol ni les offerts.',
    calcul: 'Somme des marges HT de la caisse ÷ CA HT des familles dont la marge est connue.',
  },
  margeReelle: {
    titre: 'Marge réelle',
    quoi: 'La marge tirée des chiffres du comptable, démarque comprise.',
    calcul: 'CA de la caisse − (achats − variation de stock). L’écart avec la marge théorique de la caisse est la démarque constatée.',
  },
  publiciteRedevance: {
    titre: 'Redevance et publicité',
    quoi: 'Les contributions dues à la franchise, facturées sur le CA du mois.',
    calcul: 'CA HT × 2 % pour la redevance et × 1 % pour la publicité (taux réglés dans Paramètres réseau).',
  },
  demarqueConsignes: {
    titre: 'Démarque de consignes',
    quoi: 'Les consignes (fûts, caisses, gaz) payées aux fournisseurs et jamais remboursées : vides perdus ou cassés.',
    calcul: 'Achats de l’univers × taux de consigne × démarque de consignes (Paramètres réseau), répartie selon le CA du mois.',
  },
  fraisPersonnel: {
    titre: 'Frais de personnel',
    quoi: 'Le coût de l’équipe : salaires bruts, charges patronales et rémunération du gérant.',
    calcul: 'Pour chaque poste : brut × (1 + taux de charges de sa catégorie) − réduction générale, plus les primes. Hausse des salaires appliquée au brut.',
  },
  ebe: {
    titre: 'Excédent brut d’exploitation (EBE)',
    quoi: 'Ce que gagne l’activité du magasin, avant amortissements, intérêts et impôt.',
    calcul: 'Marge commerciale − charges externes (redevance et publicité comprises) − impôts et taxes − frais de personnel.',
  },
  ebeReel: {
    titre: 'EBE réel',
    quoi: 'L’EBE tiré des quadrimestres du comptable.',
    calcul: 'CA de la caisse − (achats − variation de stock) − charges externes − impôts et taxes − personnel, cumulés depuis janvier.',
  },
  amortissements: {
    titre: 'Dotations aux amortissements',
    quoi: 'La part de l’année des investissements passés et des travaux prévus.',
    calcul: 'Amortissements saisis dans les frais + investissement des travaux ÷ durée d’amortissement, à partir de leur mois.',
  },
  resultatExploitation: {
    titre: 'Résultat d’exploitation',
    quoi: 'Le résultat de l’activité une fois les investissements comptés.',
    calcul: 'EBE − dotations aux amortissements.',
  },
  impotSocietes: {
    titre: 'Impôt sur les sociétés',
    quoi: 'L’impôt dû sur le résultat de l’année.',
    calcul: '(Résultat avant impôt − déficit reportable) × 15 % jusqu’à 42 500 €, 25 % au-delà (taux réglés dans Paramètres réseau). Zéro si le résultat est négatif.',
  },
  resultatNet: {
    titre: 'Résultat net',
    quoi: 'Ce qui reste de l’année une fois tout payé, impôt compris.',
    calcul: 'Résultat d’exploitation − intérêts des emprunts − impôt sur les sociétés.',
  },
  tresorerieDegagee: {
    titre: 'Trésorerie dégagée après emprunts',
    quoi: 'L’argent que l’activité de l’année laisse en banque, emprunts remboursés.',
    calcul: 'Résultat net + amortissements (qui ne sortent pas de la banque) − capital des emprunts remboursé.',
  },
  productivite: {
    titre: 'CA par heure travaillée',
    quoi: 'La productivité de l’équipe : ce que rapporte une heure de présence.',
    calcul: 'CA HT ÷ heures travaillées de l’équipe (heures par semaine de chaque poste, extras compris). Sur l’année : CA total ÷ heures totales.',
  },
  masseSurMarge: {
    titre: 'Masse salariale / marge',
    quoi: 'La part de la marge mangée par l’équipe : le premier ratio de rentabilité d’un magasin.',
    calcul: 'Frais de personnel (gérant compris) ÷ marge commerciale.',
  },
  masseChargee: {
    titre: 'Masse salariale chargée',
    quoi: 'Le coût complet de l’équipe sur l’année.',
    calcul: 'Somme des postes : brut annuel + charges patronales − réduction générale + primes chargées. L’année du budget reprend l’équipe avec la hausse des salaires.',
  },
  chargesPatronales: {
    titre: 'Charges patronales',
    quoi: 'Le taux de charges réellement payé par l’employeur, réduction générale déduite.',
    calcul: '(Charges patronales − réduction générale) ÷ brut. La réduction se calcule salarié par salarié selon son salaire face au SMIC.',
  },
  etp: {
    titre: 'Équivalents temps plein',
    quoi: 'L’équipe ramenée à des postes à 35 heures sur toute l’année.',
    calcul: 'Pour chaque poste : heures par semaine ÷ 35 × mois de présence ÷ 12.',
  },
  pointMort: {
    titre: 'Point mort',
    quoi: 'Le CA de l’année à partir duquel le magasin ne perd plus d’argent.',
    calcul: 'Coûts fixes ÷ taux de marge sur coûts variables. Variables : achats, redevance, publicité, frais en % du CA ; fixes : tout le reste jusqu’au résultat avant impôt.',
  },
  margeSecurite: {
    titre: 'Marge de sécurité',
    quoi: 'De combien le CA peut baisser avant d’atteindre le point mort.',
    calcul: '(CA − point mort) ÷ CA.',
  },
  gerant: {
    titre: 'Rémunération du gérant',
    quoi: 'Ce que coûte le gérant au magasin sur l’année.',
    calcul: 'Postes « gérant non salarié » de l’équipe, cotisations comprises ; sinon la rémunération de gérance des frais.',
  },
  resteDisponible: {
    titre: 'Reste disponible',
    quoi: 'L’argent laissé par l’année une fois les emprunts remboursés : pour investir, rembourser le compte courant ou se verser plus.',
    calcul: 'Résultat net + amortissements − capital des emprunts remboursé.',
  },
  tresorerieFin: {
    titre: 'Trésorerie de fin d’année',
    quoi: 'Le solde en banque attendu fin décembre.',
    calcul: 'Trésorerie au 1er janvier + encaissements − décaissements de chaque mois, TVA et délais de paiement compris.',
  },
  pointBas: {
    titre: 'Point bas',
    quoi: 'Le mois où la banque descend le plus bas : c’est lui qui dit s’il faut un découvert ou un financement.',
    calcul: 'Plus petite trésorerie de fin de mois de l’année.',
  },
  consignesAvancees: {
    titre: 'Consignes avancées aux fournisseurs',
    quoi: 'L’argent bloqué chez les fournisseurs en consignes pas encore remboursées : une part du besoin en fonds de roulement.',
    calcul: 'Consignes payées avec les achats et pas encore remboursées, en moyenne des fins de mois. Remboursement après l’écoulement du fût et le délai réglés dans Paramètres réseau.',
  },
  encaissements: {
    titre: 'Encaissements des ventes',
    quoi: 'L’argent des ventes qui arrive en banque.',
    calcul: 'CA HT × (1 + TVA moyenne des ventes), encaissé le mois de la vente.',
  },
  fournisseurs: {
    titre: 'Fournisseurs de marchandises',
    quoi: 'Le paiement des achats de marchandises.',
    calcul: 'Achats HT × (1 + TVA des achats), payés selon le délai fournisseurs (30 jours fin de mois par défaut) ; certains achats payés à l’avance (Extérieur, opérations du réseau).',
  },
  fraisTreso: {
    titre: 'Frais, redevance et publicité',
    quoi: 'Le paiement des frais du magasin et des contributions à la franchise.',
    calcul: 'Frais du mois avec leur TVA (sauf banque, assurances, impôts et taxes) ; redevance et publicité payées selon leur délai.',
  },
  salairesTreso: {
    titre: 'Salaires et cotisations',
    quoi: 'Ce qui sort de la banque pour l’équipe.',
    calcul: 'Coût du personnel du mois, dont une part (cotisations) payée le mois suivant, selon Paramètres réseau.',
  },
  tvaTreso: {
    titre: 'TVA reversée',
    quoi: 'La TVA encaissée sur les ventes moins celle payée sur les achats et les frais.',
    calcul: 'TVA collectée − TVA déductible, reversée le mois suivant (ou chaque trimestre selon Paramètres réseau). Négative : crédit de TVA.',
  },
  empruntsTreso: {
    titre: 'Emprunts',
    quoi: 'Les échéances des emprunts.',
    calcul: '(Intérêts + capital remboursé de l’année) ÷ 12.',
  },
  consignesTreso: {
    titre: 'Consignes',
    quoi: 'Les consignes payées aux fournisseurs avec les achats, et remboursées quand les vides sont rendus. Hors compte de résultat.',
    calcul: 'Versées : achats × taux de consigne de l’univers. Remboursées : après l’écoulement du fût et le délai de remboursement, moins la démarque de consignes.',
  },
  tresorerieGlissante: {
    titre: 'Trésorerie prévue',
    quoi: 'La banque des mois à venir, en partant de la trésorerie réelle du dernier quadrimestre.',
    calcul: 'Trésorerie de fin de quadrimestre + flux de chaque mois suivant tirés de l’atterrissage de l’année (même calcul que la trésorerie du budget).',
  },
  caCumule: {
    titre: 'CA à date',
    quoi: 'Le CA HT réel depuis janvier, d’après la caisse.',
    calcul: 'Somme des mois importés ou saisis. Face au budget : CA réel ÷ budget des mêmes mois − 1 ; sinon face aux mêmes mois de l’an dernier.',
  },
  ecartBudget: {
    titre: 'Écart au budget',
    quoi: 'L’avance ou le retard du réel sur le budget, sur les mêmes mois.',
    calcul: 'Réel cumulé − budget cumulé des mois réalisés (en euros ou en pourcentage du budget). Pour la marge, en points de taux.',
  },
  atterrissageCA: {
    titre: 'Atterrissage',
    quoi: 'Où l’année devrait finir si le magasin garde son rythme.',
    calcul: 'Réalisé depuis janvier ÷ part de l’année déjà faite (saisonnalité du magasin, sinon médiane du réseau). Magasin de moins de 18 mois : rythme des 4 derniers mois × saisonnalité du réseau.',
  },
  ticketsPanier: {
    titre: 'Tickets et panier moyen',
    quoi: 'Le nombre de passages en caisse et le montant moyen d’un ticket, Cave et Bar séparés.',
    calcul: 'Panier moyen TTC = CA TTC de l’univers ÷ tickets. Évolution face aux mêmes mois de l’an dernier.',
  },
  fec: {
    titre: 'FEC du comptable',
    quoi: 'Le fichier des écritures comptables, au format fixé par l’administration fiscale : tous les logiciels comptables l’exportent à l’identique. L’exemple montre une facture d’achat, le stock, le loyer, la paie et une remise en banque.',
    remplir: 'Demande au cabinet le FEC de l’année en cours, arrêté à la fin du quadrimestre. Il est lu dans le navigateur et n’est pas enregistré.',
    calcul: 'Achats (601, 602, 607), variation de stock (603, signe inversé), charges externes (604 à 62, 651), impôts et taxes (63), personnel (64), trésorerie (soldes 51 et 53).',
  },
  fraisAnnee: {
    titre: 'Frais de l’année',
    quoi: 'Les frais saisis ligne par ligne, hors personnel.',
    calcul: 'Somme des frais en euros par an, plus les frais en % du CA, la redevance et la publicité.',
  },
} satisfies Record<string, TexteAide>

export type SujetAide = keyof typeof AIDE

// Sujet d'aide d'une clé d'hypothèse (« flux/cave », « marge/cave/Bière », « hausseSalaires »…)
export function sujetDeCle(cle: string): SujetAide | null {
  const t = cle.split('/')[0]
  const parType: Record<string, SujetAide> = { flux: 'tickets', panier: 'panier', mix: 'mix', evolution: 'evolution', univers: 'univers', marge: 'marge', demarque: 'demarque', hausseSalaires: 'hausseSalaires', inflationFrais: 'inflationFrais' }
  return parType[t] ?? null
}
