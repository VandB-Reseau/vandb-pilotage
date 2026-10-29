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
  extras: {
    titre: 'Extras',
    quoi: 'Les heures faites par des extras sur l’année, comme un poste de l’équipe : renforts du samedi, de décembre, des temps forts.',
    remplir: 'Les heures moyennes d’extras par semaine ou par mois, toutes personnes confondues, et le taux horaire brut, congés payés compris. Arrivée et départ pour une saison seulement.',
    calcul: 'Brut du mois = heures moyennes du mois × taux horaire. Charges au taux de la catégorie, moins la réduction générale calculée sur le taux horaire. Les heures comptent dans le CA par heure travaillée.',
  },
} satisfies Record<string, TexteAide>

export type SujetAide = keyof typeof AIDE

// Sujet d'aide d'une clé d'hypothèse (« flux/cave », « marge/cave/Bière », « hausseSalaires »…)
export function sujetDeCle(cle: string): SujetAide | null {
  const t = cle.split('/')[0]
  const parType: Record<string, SujetAide> = { flux: 'tickets', panier: 'panier', mix: 'mix', evolution: 'evolution', univers: 'univers', marge: 'marge', demarque: 'demarque', hausseSalaires: 'hausseSalaires', inflationFrais: 'inflationFrais' }
  return parType[t] ?? null
}
