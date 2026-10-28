import type { LigneReseau } from './suivi'
import type { Budget, Hypotheses } from './types'

// Comparaison d'un magasin à la médiane du réseau ou de son groupe (lot 15, 28/10/2026). La médiane plutôt que la
// moyenne : un magasin hors normes ne la tire pas. Sur le réel de l'année à date, ou sur les budgets de l'an prochain.

export type CleRatio = 'tauxMarge' | 'personnelSurMarge' | 'loyerSurCA' | 'panierTTC' | 'ebeSurCA'
export type Ratios = Record<CleRatio, number | null>
export const RATIOS: CleRatio[] = ['tauxMarge', 'personnelSurMarge', 'loyerSurCA', 'panierTTC', 'ebeSurCA']
export const ratioLibelle: Record<CleRatio, string> = {
  tauxMarge: 'Taux de marge', personnelSurMarge: 'Masse salariale / marge', loyerSurCA: 'Loyer / CA', panierTTC: 'Panier moyen TTC', ebeSurCA: 'EBE / CA',
}
// Sens favorable : plus haut vaut mieux, sauf pour les charges
export const plusHautMieux: Record<CleRatio, boolean> = { tauxMarge: true, personnelSurMarge: false, loyerSurCA: false, panierTTC: true, ebeSurCA: true }

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
  tauxMarge: l.tauxMarge, personnelSurMarge: l.personnelSurMarge, loyerSurCA: l.loyerSurCA, panierTTC: l.panierTTC, ebeSurCA: l.ebeSurCA,
})

export function ratiosDuBudget(b: Budget, h: Hypotheses): Ratios {
  const loyers = h.frais.filter((l) => l.code === 'loyer')
  // Panier : moyenne des paniers visés de la Cave et du Bar, pondérée par les tickets visés
  const flux = (['cave', 'bar'] as const).map((u) => ({ tickets: b.flux[u]?.objectif ?? 0, panier: h.flux?.[u]?.panierCibleTTC ?? 0 })).filter((f) => f.tickets > 0 && f.panier > 0)
  const tickets = flux.reduce((a, f) => a + f.tickets, 0)
  return {
    tauxMarge: b.ca ? b.tauxMarge : null,
    personnelSurMarge: b.marge ? b.ratios.personnelSurMarge : null,
    loyerSurCA: loyers.length && b.ca ? loyers.reduce((a, l) => a + (l.annuel ?? 0) + b.ca * (l.tauxCA ?? 0), 0) / b.ca : null,
    panierTTC: tickets ? flux.reduce((a, f) => a + f.tickets * f.panier, 0) / tickets : null,
    ebeSurCA: b.ca ? b.ratios.ebeSurCA : null,
  }
}
