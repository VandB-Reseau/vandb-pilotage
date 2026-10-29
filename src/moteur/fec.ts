import { LIGNES_SUR_CA, lignesFrais } from './parametres'
import { moisDuQuadrimestre, type Quadrimestre, type SaisieQuadrimestre } from './quadrimestre'

// FEC du comptable (fichier des écritures comptables, lot 19, 28/10/2026) ramené aux montants d'un quadrimestre.
// Tous les cabinets suivent le plan comptable général : les racines des comptes sont les mêmes, seuls les sous-comptes
// changent. Correspondance par défaut sur les racines, règles fixes pour les cas connus (redevance en 651, intérim en
// 621, gérant non salarié en 644 et 646), puis exceptions par magasin choisies une fois et gardées pour les imports suivants.

export interface EcritureFEC { compte: string; libelle: string; date: string; solde: number } // date AAAA-MM-JJ, solde = débit − crédit
export type RubriqueFEC = 'achats' | 'variationStock' | 'chargesExternes' | 'impotsTaxes' | 'personnel' | 'horsEBE'
export const RUBRIQUES_FEC: RubriqueFEC[] = ['achats', 'variationStock', 'chargesExternes', 'impotsTaxes', 'personnel', 'horsEBE']
export const rubriqueFECLibelle: Record<RubriqueFEC, string> = {
  achats: 'Achats de marchandises', variationStock: 'Variation de stock', chargesExternes: 'Charges externes',
  impotsTaxes: 'Impôts et taxes', personnel: 'Personnel', horsEBE: 'Hors EBE',
}

// Racine la plus longue d'abord. Les achats de marchandises comprennent les matières du bar (601, 602), les frais
// accessoires et les remises obtenues (608, 609) ; la variation de stock est le compte 603.
const RACINES: [string, RubriqueFEC][] = [
  ['6037', 'variationStock'], ['6031', 'variationStock'], ['6032', 'variationStock'], ['603', 'variationStock'],
  ['601', 'achats'], ['602', 'achats'], ['607', 'achats'], ['6081', 'achats'], ['6082', 'achats'], ['6087', 'achats'],
  ['6091', 'achats'], ['6092', 'achats'], ['6097', 'achats'],
  ['604', 'chargesExternes'], ['605', 'chargesExternes'], ['606', 'chargesExternes'], ['608', 'chargesExternes'], ['609', 'chargesExternes'],
  ['61', 'chargesExternes'], ['62', 'chargesExternes'], ['651', 'chargesExternes'],
  ['63', 'impotsTaxes'], ['64', 'personnel'],
  ['66', 'horsEBE'], ['67', 'horsEBE'], ['68', 'horsEBE'], ['69', 'horsEBE'],
]
// Autres charges de gestion (65 hors redevances) : selon les cabinets, à ranger par le magasin

// Rubrique d'un compte de charges ; null : à classer. Les autres classes ne rentrent pas dans les charges.
export function rubriqueParDefaut(compte: string): RubriqueFEC | null {
  for (const [racine, r] of RACINES) if (compte.startsWith(racine)) return r
  return null
}
export const estCharge = (compte: string) => compte.startsWith('6')
export const estCA = (compte: string) => compte.startsWith('70')
export const estTresorerie = (compte: string) => compte.startsWith('51') || compte.startsWith('53')

const debutMois = (annee: number, mois: number) => `${annee}-${String(mois + 1).padStart(2, '0')}-01`
const finMois = (annee: number, mois: number) => `${annee}-${String(mois + 1).padStart(2, '0')}-${String(new Date(annee, mois + 1, 0).getDate()).padStart(2, '0')}`

// Quadrimestres de l'année couverts par le fichier : il commence au plus tard le premier jour, et a des écritures le dernier mois
export function quadrimestresCouverts(ecritures: EcritureFEC[], annee: number): Quadrimestre[] {
  if (!ecritures.length) return []
  const dates = ecritures.map((e) => e.date).sort()
  const premiere = dates[0], derniere = dates[dates.length - 1]
  return ([1, 2, 3] as const).filter((q) => {
    const m = moisDuQuadrimestre(q)
    return premiere <= debutMois(annee, m[0]) && derniere >= debutMois(annee, m[3])
  })
}

export interface CompteFEC { compte: string; libelle: string; montant: number; rubrique: RubriqueFEC | null; parDefaut: RubriqueFEC | null }
export interface SyntheseFEC {
  montants: SaisieQuadrimestre    // variation de stock nulle si aucun stock n'est passé sur la période
  comptes: CompteFEC[]            // comptes de charges mouvementés sur la période, du plus grand montant au plus petit
  aClasser: CompteFEC[]
  caFEC: number                   // comptes 70, en positif
  stockPasse: boolean
}

export function syntheseFEC(ecritures: EcritureFEC[], annee: number, q: Quadrimestre, exceptions: Record<string, RubriqueFEC> = {}): SyntheseFEC {
  const m = moisDuQuadrimestre(q)
  const debut = debutMois(annee, m[0]), fin = finMois(annee, m[3])
  const parCompte = new Map<string, { libelle: string; montant: number }>()
  let caFEC = 0, tresorerie: number | null = null
  for (const e of ecritures) {
    if (estTresorerie(e.compte) && e.date <= fin) tresorerie = (tresorerie ?? 0) + e.solde
    if (e.date < debut || e.date > fin) continue
    if (estCA(e.compte)) caFEC -= e.solde
    if (!estCharge(e.compte)) continue
    const c = parCompte.get(e.compte) ?? { libelle: e.libelle, montant: 0 }
    c.montant += e.solde
    if (!c.libelle) c.libelle = e.libelle
    parCompte.set(e.compte, c)
  }
  const comptes: CompteFEC[] = [...parCompte.entries()]
    .map(([compte, c]) => ({ compte, libelle: c.libelle, montant: arrondi(c.montant), parDefaut: rubriqueParDefaut(compte), rubrique: exceptions[compte] ?? rubriqueParDefaut(compte) }))
    .sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant) || a.compte.localeCompare(b.compte))
  const somme = (r: RubriqueFEC) => arrondi(comptes.filter((c) => c.rubrique === r).reduce((a, c) => a + c.montant, 0))
  const stockPasse = comptes.some((c) => c.rubrique === 'variationStock')
  return {
    montants: {
      achats: somme('achats'),
      // Compte 603 débiteur : le stock a baissé. La saisie attend stock de fin − stock de début, d'où le signe inversé.
      variationStock: stockPasse ? arrondi(-somme('variationStock')) || 0 : null,
      chargesExternes: somme('chargesExternes'),
      impotsTaxes: somme('impotsTaxes'),
      personnel: somme('personnel'),
      tresorerie: tresorerie === null ? null : arrondi(tresorerie),
    },
    comptes,
    aClasser: comptes.filter((c) => c.rubrique === null),
    caFEC: arrondi(caFEC),
    stockPasse,
  }
}

// Ligne de frais de l'onglet FFBUD d'un compte de charges (lot 23) : la plus longue racine l'emporte ; null hors des
// frais (achats, stock, personnel) ou compte inconnu. Les cabinets détaillent plus ou moins : c'est un repère, pas une saisie.
const RACINES_FRAIS: [string, string][] = ([
  ...lignesFrais.flatMap((g) => g.racines.map((r): [string, string] => [r, g.libelle])),
  ['651', LIGNES_SUR_CA.redevance.libelle], ['681', 'Dotations aux amortissements'],
  ['6611', 'Intérêts sur emprunts'], ['6615', 'Intérêts des comptes courants'], ['6616', 'Agios'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length)
export function ligneFraisDuCompte(compte: string): string | null {
  if (!estCharge(compte) || /^(60[1-3]|607|64)/.test(compte)) return null
  return RACINES_FRAIS.find(([r]) => compte.startsWith(r))?.[1] ?? null
}

// Exceptions à garder : seulement les comptes rangés autrement que par défaut
export const exceptionsDe = (comptes: CompteFEC[]): Record<string, RubriqueFEC> =>
  Object.fromEntries(comptes.filter((c) => c.rubrique !== null && c.rubrique !== c.parDefaut).map((c) => [c.compte, c.rubrique!]))

const arrondi = (v: number) => Math.round(v * 100) / 100

// Frais repris du FEC (lot 33) : chaque compte de charges rangé sur une ligne de la grille des frais (racine la plus
// longue), amortissements et intérêts à part, puis le tout ramené à l'année (× 12 ÷ mois couverts par le fichier).
// Restent hors des frais : achats et stock, personnel, taxes comptées dans la masse salariale (lot 23), royalties
// calculées sur le CA, charges exceptionnelles et impôt sur les bénéfices. Les autres comptes sont listés, à ranger à la main.
export type FinanceFEC = 'amortissements' | 'interets' | 'interetsComptesCourants' | 'agios'
type CibleCompte = { code: string } | { finance: FinanceFEC } | { exclu: string }
const EXCLUS: [string, string][] = [
  ...['601', '602', '603', '607', '6081', '6082', '6087', '6091', '6092', '6097'].map((r): [string, string] => [r, 'Achats de marchandises']),
  ['64', 'Personnel'], ['6312', 'Comptée dans la masse salariale'], ['6333', 'Comptée dans la masse salariale'],
  ['651', 'Royalties calculées sur le CA'], ['66', 'Autres charges financières'], ['67', 'Charges exceptionnelles'],
  ['68', 'Autres dotations'], ['69', 'Impôt sur les bénéfices'],
]
// À longueur égale, l'exclusion l'emporte (tri stable) : formation continue et taxe d'apprentissage restent dans la masse salariale
const CIBLES_COMPTES: [string, CibleCompte][] = ([
  ...EXCLUS.map(([r, raison]): [string, CibleCompte] => [r, { exclu: raison }]),
  ...lignesFrais.flatMap((g) => g.racines.map((r): [string, CibleCompte] => [r, { code: g.code }])),
  ['681', { finance: 'amortissements' }], ['6611', { finance: 'interets' }], ['6615', { finance: 'interetsComptesCourants' }], ['6616', { finance: 'agios' }],
] as [string, CibleCompte][]).sort((a, b) => b[0].length - a[0].length)

export interface LigneFEC { code: string; libelle: string; annuel: number; comptes: string[] }
export interface FraisFEC {
  mois: number                                       // mois couverts par le fichier, de la première à la dernière écriture
  lignes: LigneFEC[]                                 // dans l'ordre de la grille
  finances: Partial<Record<FinanceFEC, number>>      // annuels
  aRanger: { compte: string; libelle: string; annuel: number }[]
  exclus: { compte: string; libelle: string; annuel: number; raison: string }[]
}

export function fraisDepuisFEC(ecritures: EcritureFEC[]): FraisFEC {
  const charges = ecritures.filter((e) => estCharge(e.compte) && /^\d{4}-\d{2}/.test(e.date))
  const rang = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1
  const dates = ecritures.map((e) => e.date).filter((d) => /^\d{4}-\d{2}/.test(d)).sort()
  const mois = dates.length ? rang(dates[dates.length - 1]) - rang(dates[0]) + 1 : 0
  const facteur = mois ? 12 / mois : 0
  const parCompte = new Map<string, { libelle: string; montant: number }>()
  for (const e of charges) {
    const c = parCompte.get(e.compte) ?? { libelle: e.libelle, montant: 0 }
    c.montant += e.solde
    if (!c.libelle) c.libelle = e.libelle
    parCompte.set(e.compte, c)
  }
  const lignes = new Map<string, LigneFEC>()
  const finances: Partial<Record<FinanceFEC, number>> = {}
  const aRanger: FraisFEC['aRanger'] = [], exclus: FraisFEC['exclus'] = []
  for (const [compte, c] of [...parCompte.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const annuel = arrondi(c.montant * facteur)
    if (!annuel) continue
    const cible = CIBLES_COMPTES.find(([r]) => compte.startsWith(r))?.[1]
    if (!cible) aRanger.push({ compte, libelle: c.libelle, annuel })
    else if ('exclu' in cible) exclus.push({ compte, libelle: c.libelle, annuel, raison: cible.exclu })
    else if ('finance' in cible) finances[cible.finance] = arrondi((finances[cible.finance] ?? 0) + annuel)
    else {
      const g = lignesFrais.find((x) => x.code === cible.code)!
      const l = lignes.get(g.code) ?? { code: g.code, libelle: g.libelle, annuel: 0, comptes: [] }
      l.annuel = arrondi(l.annuel + annuel)
      l.comptes.push(compte)
      lignes.set(g.code, l)
    }
  }
  const ordre = (code: string) => lignesFrais.findIndex((g) => g.code === code)
  return { mois, lignes: [...lignes.values()].sort((a, b) => ordre(a.code) - ordre(b.code)), finances, aRanger, exclus }
}
