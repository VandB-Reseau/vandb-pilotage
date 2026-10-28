import type { LigneReseau } from './suivi'
import type { Budget, Hypotheses } from './types'

// Comparaison d'un magasin à la médiane du réseau ou de son groupe (lot 15, 28/10/2026). La médiane plutôt que la
// moyenne : un magasin hors normes ne la tire pas. Sur le réel de l'année à date, ou sur les budgets de l'an prochain.

// Panier de la Cave et du Bar séparés (lot 22) : deux clientèles, une moyenne des deux ne dit rien
export type CleRatio = 'tauxMarge' | 'personnelSurMarge' | 'loyerSurCA' | 'panierCave' | 'panierBar' | 'ebeSurCA'
export type Ratios = Record<CleRatio, number | null>
export const RATIOS: CleRatio[] = ['tauxMarge', 'personnelSurMarge', 'loyerSurCA', 'panierCave', 'panierBar', 'ebeSurCA']
export const ratioLibelle: Record<CleRatio, string> = {
  tauxMarge: 'Taux de marge', personnelSurMarge: 'Masse salariale / marge', loyerSurCA: 'Loyer / CA', panierCave: 'Panier Cave TTC', panierBar: 'Panier Bar TTC', ebeSurCA: 'EBE / CA',
}
export const enEuros = (k: CleRatio) => k === 'panierCave' || k === 'panierBar'
// Sens favorable : plus haut vaut mieux, sauf pour les charges
export const plusHautMieux: Record<CleRatio, boolean> = { tauxMarge: true, personnelSurMarge: false, loyerSurCA: false, panierCave: true, panierBar: true, ebeSurCA: true }

export function mediane(l: number[]): number | null {
  if (!l.length) return null
  const t = [...l].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

export function medianes(l: Ratios[]): Ratios & { nb: Record<CleRatio, number> } {
  const valeurs = (k: CleRatio) => l.map((r) => r[k]).filter((v): v is number => v !== null)
  return {
    ...Object.fromEntries(RATIOS.map((k) => [k, mediane(valeurs(k))])) as Ratios,
    nb: Object.fromEntries(RATIOS.map((k) => [k, valeurs(k).length])) as Record<CleRatio, number>,
  }
}

// Rang du magasin parmi ceux où le ratio se calcule : 1 = le meilleur
export function rang(v: number | null, l: Ratios[], k: CleRatio): { rang: number; sur: number } | null {
  if (v === null) return null
  const valeurs = l.map((r) => r[k]).filter((x): x is number => x !== null)
  const meilleurs = valeurs.filter((x) => (plusHautMieux[k] ? x > v : x < v)).length
  return { rang: meilleurs + 1, sur: valeurs.length }
}

export const ratiosDuReel = (l: LigneReseau): Ratios => ({
  tauxMarge: l.tauxMarge, personnelSurMarge: l.personnelSurMarge, loyerSurCA: l.loyerSurCA, panierCave: l.panierCave, panierBar: l.panierBar, ebeSurCA: l.ebeSurCA,
})

export function ratiosDuBudget(b: Budget, h: Hypotheses): Ratios {
  const loyers = h.frais.filter((l) => l.code === 'loyer')
  const panier = (u: 'cave' | 'bar') => (b.flux[u]?.panierObjectifTTC ? b.flux[u]!.panierObjectifTTC : null)
  return {
    tauxMarge: b.ca ? b.tauxMarge : null,
    personnelSurMarge: b.marge ? b.ratios.personnelSurMarge : null,
    loyerSurCA: loyers.length && b.ca ? loyers.reduce((a, l) => a + (l.annuel ?? 0) + b.ca * (l.tauxCA ?? 0), 0) / b.ca : null,
    panierCave: panier('cave'),
    panierBar: panier('bar'),
    ebeSurCA: b.ca ? b.ratios.ebeSurCA : null,
  }
}
