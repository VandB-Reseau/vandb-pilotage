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
    remplir: 'Pour chacun : le CA de l’an passé, le CA prévu, les extras de personnel, les autres charges et le mois où les achats sont payés.',
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
} satisfies Record<string, TexteAide>

export type SujetAide = keyof typeof AIDE

// Sujet d'aide d'une clé d'hypothèse (« flux/cave », « marge/cave/Bière », « hausseSalaires »…)
export function sujetDeCle(cle: string): SujetAide | null {
  const t = cle.split('/')[0]
  const parType: Record<string, SujetAide> = { flux: 'tickets', panier: 'panier', mix: 'mix', evolution: 'evolution', univers: 'univers', marge: 'marge', demarque: 'demarque', hausseSalaires: 'hausseSalaires', inflationFrais: 'inflationFrais' }
  return parType[t] ?? null
}
