import { moisDuQuadrimestre, QUADRIMESTRES, type Quadrimestre, type SaisieQuadrimestre } from './quadrimestre'
import type { MoisReel } from './suivi'
import type { Budget } from './types'

// Réel complété mois par mois (Joseph, 03/11/2026). La caisse donne chaque mois le CA et la marge théorique ; les charges
// et la marge réelle n'arrivent qu'au quadrimestre. Pour lire un EBE à date sans attendre, chaque mois réalisé est complété :
// - mois d'un quadrimestre saisi (« réparti ») : le total saisi est réparti entre ses 4 mois, et la somme des 4 mois vaut
//   exactement ce total. Marge réelle : la démarque constatée (marge caisse − marge réelle) est portée par chaque mois au
//   prorata de son CA. Personnel, charges externes, impôts et taxes : au prorata du budget de chaque mois (choix de Joseph,
//   le loyer et les salaires ne suivent pas le CA) ; sans budget sur la période, au prorata du nombre de jours ;
// - autre mois réalisé (« estimé ») : marge = marge caisse moins la démarque du budget ; charges = budget du mois, la
//   redevance et la publicité étant recalculées sur le CA réel.
// Rien n'est enregistré : dès qu'un vrai chiffre arrive (quadrimestre saisi ou importé), il remplace l'estimation.
// La trésorerie n'est pas répartie : elle reste un point de fin de quadrimestre (Joseph, 02/11/2026).

export type SourceChiffre = 'reel' | 'reparti' | 'estime'
export interface Chiffre { valeur: number; source: SourceChiffre }
export const CLES_COMPLETEES = ['ca', 'marge', 'personnel', 'chargesExternes', 'impotsTaxes', 'ebe'] as const
export type CleComplete = (typeof CLES_COMPLETEES)[number]
export type LignesCompletes = Record<CleComplete, Chiffre>

export interface MoisComplete extends LignesCompletes { mois: number; quadrimestre: Quadrimestre | null }
export interface ReelComplete {
  realises: number                       // mois complétés depuis janvier
  mois: (MoisComplete | null)[]          // 12 cases, null après le dernier mois réalisé
  cumul: LignesCompletes | null          // janvier à la fin du dernier mois réalisé
  budget: Record<CleComplete, number>    // budget des mêmes mois
  moisRepartis: number                   // mois dont toutes les lignes viennent d'un quadrimestre
  moisEstimes: number                    // mois dont au moins une ligne est estimée
}
export interface TauxCalcules { tauxRedevance: number; tauxPublicite: number }

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const ORDRE: SourceChiffre[] = ['reel', 'reparti', 'estime']
// Une valeur faite de plusieurs sources prend la moins sûre
export const sourceDe = (...l: SourceChiffre[]): SourceChiffre => ORDRE[Math.max(...l.map((s) => ORDRE.indexOf(s)))]
const joursDuMois = (annee: number, i: number) => new Date(Date.UTC(annee, i + 1, 0)).getUTCDate()

// Démarque visée par le budget, en part du CA : moyenne des familles pondérée par leur CA visé
export function demarqueBudget(b: Budget): number {
  const f = b.familles ?? []
  const ca = somme(f.map((x) => x.objectif))
  return ca > 0 ? somme(f.map((x) => x.objectif * (x.demarque ?? 0))) / ca : 0
}

export function reelComplete(reel: MoisReel[], saisies: Partial<Record<Quadrimestre, SaisieQuadrimestre>>, budget: Budget, taux: TauxCalcules, annee: number): ReelComplete {
  // Mois réalisés : jusqu'au dernier mois de caisse, ou jusqu'à la fin du dernier quadrimestre saisi s'il va plus loin
  const qSaisis = QUADRIMESTRES.filter((q) => saisies[q])
  const caisse = reel.reduce((d, m, i) => (m.caHT > 0 ? i + 1 : d), 0)
  const realises = Math.min(12, Math.max(caisse, ...qSaisis.map((q) => q * 4)))
  const t = taux.tauxRedevance + taux.tauxPublicite
  const dB = demarqueBudget(budget)
  const ca = (i: number) => reel[i]?.caHT ?? 0
  const tauxBudget = (i: number) => (budget.mois[i].ca > 0 ? budget.mois[i].marge / budget.mois[i].ca : budget.tauxMarge)
  // Marge caisse du mois sur tout le CA (taux des familles dont la marge est connue) ; sans marge en caisse, celle du budget
  // avant démarque
  const margeCaisse = (i: number) => {
    const r = reel[i]
    return r && r.caAvecMarge > 0 ? ca(i) * r.margeHT / r.caAvecMarge : ca(i) * (tauxBudget(i) + dB)
  }

  const mois: (MoisComplete | null)[] = Array.from({ length: 12 }, () => null)
  for (let i = 0; i < realises; i++) {
    const caM = ca(i)
    const est = (valeur: number): Chiffre => ({ valeur, source: 'estime' })
    mois[i] = {
      mois: i, quadrimestre: null,
      ca: { valeur: caM, source: 'reel' },
      marge: est(margeCaisse(i) - caM * dB),
      personnel: est(budget.mois[i].personnel),
      chargesExternes: est(budget.mois[i].chargesExternes + (caM - budget.mois[i].ca) * t),
      impotsTaxes: est(budget.mois[i].impotsTaxes),
      ebe: est(0),
    }
  }
  for (const q of qSaisis) {
    const s = saisies[q]!
    const l = moisDuQuadrimestre(q).filter((i) => i < realises)
    const caQ = somme(l.map(ca))
    if (s.achats !== null) {
      const margeReelle = caQ - (s.achats - (s.variationStock ?? 0))
      const demarque = somme(l.map(margeCaisse)) - margeReelle
      for (const i of l) mois[i]!.marge = { valeur: margeCaisse(i) - demarque * (caQ > 0 ? ca(i) / caQ : 1 / l.length), source: 'reparti' }
    }
    for (const k of ['personnel', 'chargesExternes', 'impotsTaxes'] as const) {
      const v = s[k]
      if (v === null) continue
      const poids = l.map((i) => budget.mois[i][k])
      const parJours = !(somme(poids) > 0)
      const base = parJours ? l.map((i) => joursDuMois(annee, i)) : poids
      const total = somme(base)
      l.forEach((i, j) => { mois[i]![k] = { valeur: v * base[j] / total, source: 'reparti' } })
    }
    for (const i of l) mois[i]!.quadrimestre = q
  }
  for (const m of mois) {
    if (!m) continue
    m.ebe = {
      valeur: m.marge.valeur - m.personnel.valeur - m.chargesExternes.valeur - m.impotsTaxes.valeur,
      source: sourceDe(m.marge.source, m.personnel.source, m.chargesExternes.source, m.impotsTaxes.source),
    }
  }

  const faits = mois.slice(0, realises) as MoisComplete[]
  const cumul = faits.length
    ? Object.fromEntries(CLES_COMPLETEES.map((k) => [k, { valeur: somme(faits.map((m) => m[k].valeur)), source: sourceDe(...faits.map((m) => m[k].source)) }])) as LignesCompletes
    : null
  const budgetCumul = Object.fromEntries(CLES_COMPLETEES.map((k) => [k, somme(budget.mois.slice(0, realises).map((m) => m[k]))])) as Record<CleComplete, number>
  return {
    realises, mois, cumul, budget: budgetCumul,
    moisRepartis: faits.filter((m) => m.ebe.source !== 'estime').length,
    moisEstimes: faits.filter((m) => m.ebe.source === 'estime').length,
  }
}
