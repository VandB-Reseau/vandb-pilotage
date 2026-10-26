// Hypothèses et résultats du budget d'un magasin. Tous les montants sont HT, en euros ; les taux sont des fractions (0,38 = 38 %).

export type Univers = 'cave' | 'bar' | 'exterieur'
export const UNIVERS: Univers[] = ['cave', 'bar', 'exterieur']
export const universLibelle: Record<Univers, string> = { cave: 'Cave', bar: 'Bar', exterieur: 'Extérieur' }

// Une famille de produits (Bière, Vin, Fût…) dans son univers
export interface Famille {
  univers: Univers
  famille: string
  caRealise: number      // CA HT de l'année en cours, du 1er janvier à la fin du dernier mois réalisé
  margeRealisee: number  // marge théorique de la famille sur la même période
  evolution: number      // évolution visée du CA l'an prochain
  margeCible: number     // marge visée l'an prochain
}

// Flux (nombre de tickets) de la Cave et du Bar : sert à la seconde projection du CA, par flux × panier
export interface Flux { realise: number; evolution: number; panierCibleTTC: number }

export type Rubrique = 'immobilier' | 'energies' | 'entretien' | 'honoraires' | 'communication' | 'deplacements' | 'banque_assurances' | 'autres' | 'impots_taxes'

// Une ligne de frais : montant annuel réparti par douzième, ou pourcentage du CA du mois
export interface LigneFrais { code: string; libelle: string; rubrique: Rubrique; annuel?: number; tauxCA?: number }

export interface Personnel {
  salairesMensuels: number[]    // 12 mois : salaires chargés hors gérance
  remunerationGerance: number   // par mois
  tauxCotisationsGerance: number
  heuresMensuelles: number[]    // 12 mois : heures travaillées, pour la productivité
}

export interface Hypotheses {
  annee: number                       // année budgétée
  moisRealises: number                // mois de l'année en cours déjà réalisés (1 à 11)
  caMensuelReference: number[]        // 12 mois de CA HT de référence : sert à la saisonnalité et à la part réalisée
  partRealisee?: Partial<Record<Univers, number>> // part du CA annuel réalisée à fin de période, si connue par univers
  familles: Famille[]
  flux?: Partial<Record<'cave' | 'bar', Flux>>
  personnel: Personnel
  frais: LigneFrais[]
  amortissements: number              // dotations de l'année
  interets: number                    // intérêts d'emprunts de l'année
  remboursementCapital: number        // capital d'emprunts remboursé dans l'année
  deficitReportable: number
}

// Fixés par le siège chaque année, communs au réseau
export interface ParametresReseau {
  tauxRedevance: number   // 2 % du CA HT, charge externe au-dessus de l'EBE
  tauxPublicite: number   // 1 % du CA HT, charge externe au-dessus de l'EBE
  impot: { tauxReduit: number; plafondTauxReduit: number; tauxNormal: number }
  tvaPanier: Record<'cave' | 'bar', number> // TVA moyenne pour passer d'un panier TTC à un CA HT
}

export interface Mois {
  ca: number
  achats: number
  marge: number
  chargesExternes: number   // frais, redevance et publicité compris
  impotsTaxes: number
  personnel: number
  ebe: number
  resultatExploitation: number
  resultatAvantImpot: number
  productivite: number | null // CA par heure travaillée
}

export interface ResultatFamille extends Famille { atterrissage: number; objectif: number; margeObjectif: number }

export interface Budget {
  familles: ResultatFamille[]
  partRealisee: Record<Univers, number>
  atterrissage: number
  ca: number
  marge: number
  tauxMarge: number
  poids: number[]
  mois: Mois[]
  redevance: number
  publicite: number
  chargesExternes: number
  impotsTaxes: number
  personnel: number
  ebe: number
  resultatExploitation: number
  resultatAvantImpot: number
  impot: number
  resultatNet: number
  capaciteAutofinancement: number
  tresorerieDegagee: number      // capacité d'autofinancement moins capital remboursé
  ratios: { personnelSurMarge: number; personnelSurCA: number; ebeSurCA: number }
  flux: Partial<Record<'cave' | 'bar', { atterrissage: number; objectif: number; caParPanier: number }>>
}
