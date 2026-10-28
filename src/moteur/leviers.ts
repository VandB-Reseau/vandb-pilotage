import { UNIVERS_PANIER, type UniversTickets } from './suivi'
import type { Budget } from './types'

// Leviers commerciaux chiffrés (lot 28, 28/10/2026) : ce que rapportent sur un an, Cave et Bar séparés,
// - plus de tickets (fréquentation), en part des tickets de l'année ;
// - un panier plus fort (vente additionnelle), en euros TTC par ticket ;
// - un mix vers les familles les mieux margées, en points de taux de marge de l'univers.
// CA de l'univers × (1 + tickets) × (1 + euros de panier / panier TTC) ; marge au taux de l'univers plus les points de mix.
// Redevance et publicité suivent le CA ; l'équipe et les frais ne bougent pas : l'effet sur l'EBE est un plafond.
// Rien n'est enregistré : c'est un simulateur.

export interface BaseLevier { ca: number; tauxMarge: number; panierTTC: number | null }
export interface Leviers { tickets: number; panier: number; mix: number }  // 0,02 = +2 % ; euros TTC ; 0,005 = +0,5 point
export interface EffetLeviers {
  univers: Partial<Record<UniversTickets, { ca: number; marge: number }>>     // gains de l'univers
  ca: number; marge: number; ebe: number                                      // gains totaux sur un an
}
export const AUCUN_LEVIER: Leviers = { tickets: 0, panier: 0, mix: 0 }

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

// Base d'un budget (ou d'un atterrissage) : CA et marge visés des familles de l'univers, panier TTC visé (ou réalisé)
export function baseLeviers(b: Budget): Partial<Record<UniversTickets, BaseLevier>> {
  const r: Partial<Record<UniversTickets, BaseLevier>> = {}
  for (const u of UNIVERS_PANIER) {
    const f = b.familles.filter((x) => x.univers === u)
    const ca = somme(f.map((x) => x.objectif))
    if (ca <= 0) continue
    const panier = b.flux[u]?.panierObjectifTTC || b.flux[u]?.panierRealiseTTC || 0
    r[u] = { ca, tauxMarge: somme(f.map((x) => x.margeObjectif)) / ca, panierTTC: panier > 0 ? panier : null }
  }
  return r
}

export function effetLeviers(
  base: Partial<Record<UniversTickets, BaseLevier>>,
  leviers: Partial<Record<UniversTickets, Leviers>>,
  p: { tauxRedevance: number; tauxPublicite: number },
): EffetLeviers {
  const univers: EffetLeviers['univers'] = {}
  for (const u of UNIVERS_PANIER) {
    const b = base[u], l = leviers[u]
    if (!b || !l) continue
    const panier = b.panierTTC ? l.panier / b.panierTTC : 0
    const ca = b.ca * (1 + l.tickets) * (1 + panier)
    univers[u] = { ca: ca - b.ca, marge: ca * (b.tauxMarge + l.mix) - b.ca * b.tauxMarge }
  }
  const ca = somme(Object.values(univers).map((x) => x.ca)), marge = somme(Object.values(univers).map((x) => x.marge))
  return { univers, ca, marge, ebe: marge - ca * (p.tauxRedevance + p.tauxPublicite) }
}
