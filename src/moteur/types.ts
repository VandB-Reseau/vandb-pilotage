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

// Grille des frais du réseau (lot 23, modifiable depuis Paramètres réseau au lot 40) : une ligne de l'onglet FFBUD, son
// bloc, ses comptes du plan comptable (racines) pour l'import FEC. Courante : proposée d'office à une première saisie.
// Masquée : plus proposée à l'ajout ni retenue à l'import FEC ; les magasins qui l'ont la gardent.
export type BlocFrais = 'charges_externes' | 'impots_taxes' | 'autres_charges'
export interface LigneGrille { code: string; libelle: string; rubrique: Rubrique; bloc: BlocFrais; racines: string[]; courante?: boolean; masquee?: boolean }

// Règles de calcul de l'atterrissage, du budget, des médianes et des alertes (lot 40), modifiables depuis Paramètres réseau
export interface ReglesCalcul {
  jeuneMagasin: number          // mois d'activité sous lesquels le magasin monte encore en charge (18)
  moisRythme: number            // derniers mois réalisés qui donnent le rythme (4)
  ecartRythme: number           // atterrissage : écart au-delà duquel le rythme récent n'est pas suivi d'office (15 %)
  seuilRythme: number           // budget : écart sous lequel le rythme de sortie est appliqué d'office (15 %)
  magasinsSaisonnalite: number  // magasins complets pour publier la saisonnalité médiane du réseau (3)
  magasinsCalage: number        // magasins pour publier les valeurs par ancienneté (8)
  magasinsFamille: number       // magasins pour publier les médianes des familles (3)
  moisCommerciaux: number       // mois comparés à l'an dernier pour les alertes tickets et panier (3)
}

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
  // 29/10/2026 (Joseph) : les mêmes 12 mois univers par univers (réalisé puis projeté), pour que chaque univers garde
  // sa saisonnalité (l'Extérieur l'été…). Absent des bases enregistrées avant : saisonnalité du total pour tous
  caMensuelUnivers?: Partial<Record<Univers, number[]>>
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
  // Investissements & Financements (Joseph, 03/11/2026) : achats amortis, nouveaux emprunts, apport, dernier mois des
  // emprunts déjà en cours (intérets et remboursementCapital ci-dessus) ; voir moteur/financement
  investissements?: Investissement[]
  emprunts?: Emprunt[]
  apport?: Apport
  finEmpruntsEnCours?: number
  // Prêts du magasin (03/11/2026) : leurs intérêts et leur capital de l'année remplacent la ligne « Intérêts sur
  // emprunts » et le capital remboursé des frais ; interets ne garde alors que les comptes courants et les agios
  prets?: Pret[]
  // Lot 42 : masse salariale ou frais repris des comptes de l'année en cours, faute d'équipe ou de frais saisis
  reprise?: { annee: number; mois: number; personnel: boolean; frais: boolean }
  // Lot 42 : trésorerie au 1er janvier estimée, figée avec le budget à sa validation (le franchisé n'avait pas saisi la sienne)
  departEstime?: { montant: number; depuis: number; quadrimestre: 1 | 2 | 3; annee: number }
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
// Client gagné ou perdu, concurrent, horaires : montant HT par mois, ou part du CA de l'univers, de tel mois à tel mois.
// Joseph (03/11/2026) : un client extérieur se saisit face à l'an passé, CA HT de l'an passé et de l'année budgétée sur
// la période (caAnPasse, ca) ; l'écart se répartit à parts égales sur ses mois et remplace montant et taux.
export interface AjustementCA { libelle: string; univers: Univers; de: number; a: number; montant?: number; taux?: number; caAnPasse?: number; ca?: number }

// Investissement de l'année budgétée hors travaux (équipement, matériel, mobilier…) : HT, mis en service et payé le mois
// saisi (1 à 12), amorti en ligne sur sa durée en années à partir de ce mois
export type TypeInvestissement = 'equipement' | 'mobilier' | 'informatique' | 'autre'
export interface Investissement { libelle: string; type: TypeInvestissement; montant: number; mois: number; duree: number }
// Nouvel emprunt : capital, taux annuel, durée en années, mois de la première échéance (1 à 12) ; échéances mensuelles
// constantes, capital encaissé le mois précédant la première échéance (janvier au plus tôt)
export interface Emprunt { libelle: string; montant: number; taux: number; duree: number; premiereEcheance: number }
// Prêt du magasin (Joseph, 03/11/2026), saisi une fois dans la fiche du magasin et lu par toutes les années.
// « initial » : d'après le tableau d'amortissement de la banque (montant emprunté, durée, date de la 1re échéance, différé
// d'intérêts seuls) ; « restant » : faute du tableau, capital restant dû juste avant l'échéance de « debut » et mensualité.
// Échéances mensuelles. Un prêt saisi est déjà dépensé (Joseph, 03/11/2026) : il n'entre pas en trésorerie.
export interface Pret {
  id?: number
  libelle: string
  mode: 'initial' | 'restant'
  montant: number                     // initial : montant emprunté ; restant : capital restant dû
  taux: number                        // taux annuel
  duree: number                       // initial : durée en années, différé compris
  debut: string                       // AAAA-MM : 1re échéance (initial), prochaine échéance (restant)
  differe?: number                    // initial : mois d'intérêts seuls au début
  mensualite?: number                 // restant : échéance mensuelle (intérêts et capital)
}
// Apport du franchisé ou en compte courant : entre en trésorerie le mois saisi, sans effet sur le résultat
export interface Apport { montant: number; mois: number }

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
  grilleFrais?: LigneGrille[] // lot 40 ; absente : grille par défaut (lignesFrais)
  regles?: ReglesCalcul       // lot 40 ; absentes : règles par défaut (reglesParDefaut)
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
  financement: Financement       // investissements, emprunts et capacité d'autofinancement (03/11/2026)
  ratios: { pctFP: number; ebeSurCA: number } // pctFP : % FP, frais de personnel ÷ CA HT
  // Par univers piloté : tickets atterris et visés, panier TTC réalisé et visé, CA atterri et visé
  flux: Partial<Record<'cave' | 'bar', FluxBudget>>
  sortie?: Partial<Record<UniversTickets, RythmeSortie>>
  tempsForts?: { retire: number; ajoute: number; charges: number; ajustements: number }
  paiementsTempsForts?: { mois: number; vente: number; univers: Univers; montant: number }[] // achats HT, mois de 0 à 11
  detailCA?: Record<Univers, DetailCAUnivers>
}
// Investissements & Financements de l'année : dotations, intérêts et capital (emprunts en cours puis nouveaux), mois par
// mois pour le compte de résultat et la trésorerie ; ce qui reste de la capacité d'autofinancement une fois tout payé
export interface Financement {
  dotationsEnCours: number; dotationsNouvelles: number    // nouvelles : travaux et investissements de l'année
  interetsEnCours: number; interetsNouveaux: number
  capitalEnCours: number; capitalNouveau: number
  interetsMois: number[]; capitalMois: number[]           // 12 mois, emprunts en cours et nouveaux
  investissements: number                                 // HT, travaux compris
  investissementsMois: number[]                           // HT payés chaque mois
  nouveauxEmprunts: number; apport: number
  encaissementsMois: number[]                             // capital emprunté et apport encaissés chaque mois
  echeances: number                                       // intérêts + capital de l'année
  echeancesSurCAF: number | null                          // null sans capacité d'autofinancement positive
  variation: number                                       // trésorerie dégagée − investissements + emprunts + apport
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
