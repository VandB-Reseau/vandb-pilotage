import type { Campagne } from './campagne'
import type { ParametresCharges, Personne } from './equipe'
import type { ParametresAlertes } from './alertes'
import type { ParametresTresorerie } from './tresorerie'

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
  demarque?: number      // démarque l'an prochain, en part du CA de la famille, déduite de la marge visée
  part?: number          // Cave et Bar pilotés par les tickets : part visée de la famille dans le CA de l'univers
}

// Fréquentation (nombre de tickets) et panier de la Cave et du Bar (lot 22, 28/10/2026) : le CA de l'univers se construit
// par tickets × panier ; les familles en donnent le mix et la marge. panierCibleTTC : panier TTC réalisé, point de départ.
export interface Flux { realise: number; evolution: number; panierCibleTTC: number; evolutionPanier?: number }

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
  // Lot 22 : Cave et Bar construits par tickets × panier. Absent des budgets enregistrés avant : calculés comme alors
  caParTickets?: boolean
  personnel: Personnel
  frais: LigneFrais[]
  amortissements: number              // dotations de l'année
  interets: number                    // intérêts d'emprunts de l'année
  remboursementCapital: number        // capital d'emprunts remboursé dans l'année
  deficitReportable: number
  equipe?: Personne[]                 // équipe du magasin : remplace salaires, gérance et heures du personnel
  hausseSalaires?: number             // indexation appliquée aux salaires de l'équipe
  poidsMois?: number[]                // saisonnalité propre au magasin (12 parts) ; sinon celle du CA de référence
  travaux?: Travaux
  // Lot 24 : rythme de sortie de l'année en cours (posé par l'atterrissage), choix de l'appliquer (posé par les cibles :
  // absent pour l'atterrissage lui-même), temps forts et ajustements datés du CA
  sortie?: Partial<Record<UniversTickets, Sortie>>
  rythme?: Partial<Record<UniversTickets, ChoixRythme>>
  tempsForts?: TempsFort[]
  ajustementsCA?: AjustementCA[]
}

export type UniversTickets = 'cave' | 'bar'

// CA HT des derniers mois réalisés de l'univers (mois de début et de fin, 1 à 12) et leur poids dans la saisonnalité
export interface Sortie { ca: number; poids: number; de: number; a: number }
// auto : appliqué si l'écart à l'atterrissage reste dans le seuil ; applique : confirmé par le Directeur ; ignore : atterrissage gardé
export type ChoixRythme = 'auto' | 'applique' | 'ignore'

// Temps fort du magasin (lot 24, Joseph 28/10/2026) : événement extérieur, soirée en magasin ou opération commerciale propre.
// Le CA de l'an passé sort de la base, celui du budget entre dans son mois ; ses charges propres et le mois où ses achats
// sont payés sont sur la ligne. Mois de 1 à 12, montants HT.
export type TypeTempsFort = 'exterieur' | 'soiree' | 'operation'
export interface TempsFort {
  nom: string; type: TypeTempsFort; mois: number; univers: Univers
  caAnPasse: number; ca: number; autresCharges: number; moisAchats: number
  extrasPersonnel?: number // retiré le 29/10/2026 : les extras se saisissent dans l'équipe ; ignoré s'il reste enregistré
}
// Client gagné ou perdu, concurrent, horaires : montant HT par mois, ou part du CA de l'univers, de tel mois à tel mois
export interface AjustementCA { libelle: string; univers: Univers; de: number; a: number; montant?: number; taux?: number }

// Travaux de l'année budgétée : activité de chaque mois (1 normal, 0 fermé), gain de CA après la réouverture,
// investissement amorti à partir de la réouverture
export interface Travaux { activite: number[]; gain: number; investissement: number; dureeAmortissement: number }

// Fixés par le siège chaque année, communs au réseau
export interface ParametresReseau {
  tauxRedevance: number   // 2 % du CA HT, charge externe au-dessus de l'EBE
  tauxPublicite: number   // 1 % du CA HT, charge externe au-dessus de l'EBE
  impot: { tauxReduit: number; plafondTauxReduit: number; tauxNormal: number }
  tvaPanier: Record<'cave' | 'bar', number> // TVA moyenne pour passer d'un panier TTC à un CA HT
  charges: ParametresCharges
  tresorerie: ParametresTresorerie
  alertes: ParametresAlertes
  campagne?: Campagne     // dates de la campagne des budgets de l'année (lot 28) ; absentes : dates d'exemple
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
  univers?: Record<Univers, { ca: number; achats: number; achatsTempsForts: number }> // détail du mois (lot 24)
  autresChargesTempsForts?: number
  demarqueConsignes?: number // vides jamais remboursés, dans les charges externes (29/10/2026)
}

export interface ResultatFamille extends Famille { atterrissage: number; objectif: number; margeObjectif: number }

export interface Budget {
  familles: ResultatFamille[]
  partRealisee: Record<Univers, number>
  atterrissage: number
  ca: number
  marge: number
  tauxMarge: number
  poids: number[]               // saisonnalité (12 parts, total 100 %), avant l'effet des travaux
  activite: number[]            // effet des travaux sur chaque mois (1 sans travaux)
  amortissements: number        // dotations de l'année, travaux compris
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
  // Par univers piloté : tickets atterris et visés, panier TTC réalisé et visé, CA atterri et visé
  flux: Partial<Record<'cave' | 'bar', FluxBudget>>
  sortie?: Partial<Record<UniversTickets, RythmeSortie>>
  tempsForts?: { retire: number; ajoute: number; charges: number; ajustements: number }
  paiementsTempsForts?: { mois: number; vente: number; univers: Univers; montant: number }[] // achats HT, mois de 0 à 11
  detailCA?: Record<Univers, DetailCAUnivers>
}
// Étapes du CA d'un univers, pour « D'où vient ce chiffre ? » (lot 25) :
// atterri → hors temps forts passés → base (rythme de sortie s'il est retenu) × évolutions × ouverture + temps forts + ajustements
export interface DetailCAUnivers {
  atterri: number; horsTempsForts: number; base: number; rythme: boolean
  tickets?: number; panier?: number   // évolutions, Cave et Bar construits par les tickets
  evolution: number                   // évolution des familles (sans tickets), 0 sinon
  ouverture: number                   // part de l'année ouverte (travaux), 1 sans travaux
  tempsForts: number; ajustements: number; ca: number
}
// Base du CA d'un univers : atterrissage hors temps forts passés, rythme de sortie annualisé, écart et ce qui est retenu
export interface RythmeSortie {
  atterri: number; annuel: number; acquis: number; de: number; a: number
  statut: 'applique' | 'a_confirmer' | 'ignore'
}
export interface FluxBudget {
  atterrissage: number; objectif: number; evolution: number
  panierRealiseTTC: number; panierObjectifTTC: number; evolutionPanier: number
  caAtterri: number; ca: number
  parTickets: boolean   // CA de l'univers construit par les tickets (faux pour un budget enregistré avant le lot 22)
}
