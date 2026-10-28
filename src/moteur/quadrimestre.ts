import type { MoisReel } from './suivi'
import type { Budget } from './types'

// Résultat réel par quadrimestre : le CA vient de la caisse, quelques montants comptables agrégés sont saisis
// (achats de marchandises, variation de stock, charges externes redevance et publicité comprises, impôts et taxes,
// personnel, trésorerie de fin de période) ; marge réelle et EBE en découlent. Rien d'autre à saisir (Joseph, 28/10/2026).
// Marge réelle = CA − (achats − variation de stock) ; comparée à la marge théorique de la caisse, l'écart est la démarque.

export const QUADRIMESTRES = [1, 2, 3] as const
export type Quadrimestre = (typeof QUADRIMESTRES)[number]
export const quadrimestreLibelle: Record<Quadrimestre, string> = { 1: 'Janvier à avril', 2: 'Mai à août', 3: 'Septembre à décembre' }
export const moisDuQuadrimestre = (q: Quadrimestre) => [0, 1, 2, 3].map((k) => (q - 1) * 4 + k)

export interface SaisieQuadrimestre {
  achats: number | null
  variationStock: number | null  // stock de fin − stock de début : une hausse du stock réduit les achats consommés
  chargesExternes: number | null
  impotsTaxes: number | null
  personnel: number | null
  tresorerie: number | null
}

export interface ResultatQuadrimestre {
  complet: boolean               // les quatre charges sont saisies et la caisse couvre les quatre mois
  moisCaisse: number             // mois de la période présents dans le réel de caisse
  ca: number
  achatsConsommes: number | null
  marge: number | null
  tauxMarge: number | null
  tauxMargeBudget: number | null
  tauxMargeCaisse: number | null // marge théorique de la caisse, sur les familles qui la donnent
  ecartMargeCaisse: number | null // marge réelle − marge caisse, en points : la démarque constatée est négative
  chargesExternes: number | null
  impotsTaxes: number | null
  personnel: number | null
  ebe: number | null
  ebeSurCA: number | null
  personnelSurMarge: number | null
  tresorerie: number | null
  budget: { ca: number; marge: number; chargesExternes: number; impotsTaxes: number; personnel: number; ebe: number } | null
  ecartEBE: number | null
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const ratio = (a: number, b: number) => (b ? a / b : null)

export function resultatPeriode(mois: number[], reel: MoisReel[], saisies: SaisieQuadrimestre[], budget: Budget | null): ResultatQuadrimestre {
  const r = mois.map((i) => reel[i])
  const ca = somme(r.map((m) => m?.caHT ?? 0))
  const moisCaisse = r.filter((m) => (m?.caHT ?? 0) > 0).length
  const total = (k: keyof SaisieQuadrimestre) => (saisies.length && saisies.every((s) => s[k] !== null) ? somme(saisies.map((s) => s[k]!)) : null)
  // Variation de stock non renseignée : comptée nulle, période par période
  const achats = total('achats'), variation = somme(saisies.map((s) => s.variationStock ?? 0))
  const achatsConsommes = achats === null ? null : achats - variation
  const chargesExternes = total('chargesExternes'), impotsTaxes = total('impotsTaxes'), personnel = total('personnel')
  const marge = achatsConsommes === null || !moisCaisse ? null : ca - achatsConsommes
  const caAvecMarge = somme(r.map((m) => m?.caAvecMarge ?? 0))
  const tauxMarge = marge === null ? null : ratio(marge, ca)
  const tauxMargeCaisse = ratio(somme(r.map((m) => m?.margeHT ?? 0)), caAvecMarge)
  const ebe = marge === null || chargesExternes === null || impotsTaxes === null || personnel === null ? null : marge - chargesExternes - impotsTaxes - personnel
  const duBudget = (k: 'ca' | 'marge' | 'chargesExternes' | 'impotsTaxes' | 'personnel' | 'ebe') => somme(mois.map((i) => budget!.mois[i][k]))
  const b = budget ? { ca: duBudget('ca'), marge: duBudget('marge'), chargesExternes: duBudget('chargesExternes'), impotsTaxes: duBudget('impotsTaxes'), personnel: duBudget('personnel'), ebe: duBudget('ebe') } : null
  return {
    complet: ebe !== null && moisCaisse === mois.length, moisCaisse, ca, achatsConsommes, marge, tauxMarge,
    tauxMargeBudget: b ? ratio(b.marge, b.ca) : null, tauxMargeCaisse,
    ecartMargeCaisse: tauxMarge !== null && tauxMargeCaisse !== null ? tauxMarge - tauxMargeCaisse : null,
    chargesExternes, impotsTaxes, personnel, ebe, ebeSurCA: ebe === null ? null : ratio(ebe, ca),
    personnelSurMarge: personnel === null || marge === null ? null : ratio(personnel, marge),
    // Trésorerie : celle de la dernière période saisie
    tresorerie: [...saisies].reverse().find((s) => s.tresorerie !== null)?.tresorerie ?? null,
    budget: b, ecartEBE: ebe !== null && b ? ebe - b.ebe : null,
  }
}

// Les trois quadrimestres et le cumul des quadrimestres saisis jusqu'au dernier renseigné
export function resultatsQuadrimestres(reel: MoisReel[], saisies: Partial<Record<Quadrimestre, SaisieQuadrimestre>>, budget: Budget | null) {
  const parQuadrimestre = QUADRIMESTRES.map((q) => (saisies[q] ? resultatPeriode(moisDuQuadrimestre(q), reel, [saisies[q]!], budget) : null))
  const saisis = QUADRIMESTRES.filter((q) => saisies[q])
  const dernier = saisis.length ? Math.max(...saisis) as Quadrimestre : null
  const jusquA = dernier ? QUADRIMESTRES.filter((q) => q <= dernier) : []
  const cumul = dernier && jusquA.every((q) => saisies[q])
    ? resultatPeriode(jusquA.flatMap(moisDuQuadrimestre), reel, jusquA.map((q) => saisies[q]!), budget)
    : null
  return { parQuadrimestre, cumul, dernier, moisCumul: cumul ? jusquA.flatMap(moisDuQuadrimestre) : [] }
}

// Cumul face au budget et à la même période de l'an passé (lot 26), ligne par ligne. Sans quadrimestres saisis l'an
// passé, seul le CA de la caisse se compare. Écart au budget : réel − budget (pour une charge, un écart positif coûte).
export interface LigneComparaison {
  cle: string; libelle: string; charge: boolean
  reel: number | null; budget: number | null; ecartBudget: number | null; n1: number | null; evolution: number | null
}
export function comparaisonPeriode(r: ResultatQuadrimestre, n1: ResultatQuadrimestre | null): LigneComparaison[] {
  const lignes: [string, string, boolean, (x: ResultatQuadrimestre) => number | null, keyof NonNullable<ResultatQuadrimestre['budget']>][] = [
    ['ca', 'CA HT', false, (x) => x.ca, 'ca'],
    ['marge', 'Marge réelle', false, (x) => x.marge, 'marge'],
    ['chargesExternes', 'Charges externes', true, (x) => x.chargesExternes, 'chargesExternes'],
    ['impotsTaxes', 'Impôts et taxes', true, (x) => x.impotsTaxes, 'impotsTaxes'],
    ['personnel', 'Frais de personnel', true, (x) => x.personnel, 'personnel'],
    ['ebe', 'EBE', false, (x) => x.ebe, 'ebe'],
  ]
  return lignes.map(([cle, libelle, charge, f, k]) => {
    const reel = f(r), budget = r.budget ? r.budget[k] : null
    const avant = n1 ? f(n1) : null
    return {
      cle, libelle, charge, reel, budget,
      ecartBudget: reel !== null && budget !== null ? reel - budget : null,
      n1: avant ? avant : null,
      evolution: reel !== null && avant && avant > 0 ? reel / avant - 1 : null,   // sans sens face à un montant négatif
    }
  })
}

// Même période l'an passé : caisse de l'an passé et quadrimestres saisis alors, s'ils le sont tous
export function memePeriode(mois: number[], reelN1: MoisReel[], saisiesN1: Partial<Record<Quadrimestre, SaisieQuadrimestre>>): ResultatQuadrimestre | null {
  if (!mois.length || !mois.some((i) => (reelN1[i]?.caHT ?? 0) > 0)) return null
  const quadrimestres = QUADRIMESTRES.filter((q) => moisDuQuadrimestre(q).some((i) => mois.includes(i)))
  const toutes = quadrimestres.every((q) => saisiesN1[q])
  return resultatPeriode(mois, reelN1, toutes ? quadrimestres.map((q) => saisiesN1[q]!) : [], null)
}
