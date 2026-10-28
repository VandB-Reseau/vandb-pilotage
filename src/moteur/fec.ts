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
