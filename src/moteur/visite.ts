import { dernierMois, UNIVERS_PANIER, type MoisReel, type UniversTickets } from './suivi'
import type { Budget } from './types'

// Fiche de visite du Coach (lot 28, 28/10/2026) : le magasin à fin du dernier mois réalisé, face au budget et à l'an
// dernier, et les trois sujets à aborder. Les sujets se classent par la marge en jeu sur l'année à date, pour comparer
// des écarts de nature différente (CA, points de marge, tickets, panier) :
// - CA sous le budget : CA manquant × taux de marge
// - marge en baisse : points perdus × CA
// - tickets en baisse : tickets perdus × panier de l'an dernier, ramené en HT, × taux de marge
// - panier en baisse : euros perdus par ticket × tickets de l'année, ramené en HT, × taux de marge
// Tickets et panier : seulement les mois où l'univers a des tickets les deux années. Cave et Bar jamais additionnés.

export interface UniversVisite { tickets: number; ticketsN1: number; panier: number; panierN1: number; mois: number }
export type SujetVisite =
  | { type: 'ca'; ecart: number; enJeu: number }                                    // ecart : −0,08 = 8 % sous le budget
  | { type: 'marge'; ecart: number; enJeu: number }                                 // ecart en points, négatif
  | { type: 'tickets' | 'panier'; univers: UniversTickets; ecart: number; enJeu: number } // ecart sur l'an dernier
export interface FicheVisite {
  mois: number                                   // dernier mois réalisé (1 à 12), 0 : aucun
  ca: number; caBudget: number | null; caN1: number | null
  tauxMarge: number | null; tauxMargeN1: number | null
  univers: Partial<Record<UniversTickets, UniversVisite>>
  sujets: SujetVisite[]                          // trois au plus, le plus d'euros en jeu d'abord
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const tauxDe = (l: MoisReel[]) => { const ca = somme(l.map((m) => m.caAvecMarge)); return ca > 0 ? somme(l.map((m) => m.margeHT)) / ca : null }
export const SUJETS_VISITE = 3

export function ficheVisite(e: { n: MoisReel[]; n1: MoisReel[]; budget: Budget | null }, tvaPanier: Record<UniversTickets, number>): FicheVisite {
  const m = dernierMois(e.n)
  const mois = e.n.slice(0, m), mois1 = e.n1.slice(0, m)
  const ca = somme(mois.map((x) => x.caHT))
  const caN1 = somme(mois1.map((x) => x.caHT)) || null
  const caBudget = m && e.budget ? somme(e.budget.mois.slice(0, m).map((x) => x.ca)) || null : null
  const tauxMarge = tauxDe(mois), tauxMargeN1 = tauxDe(mois1)
  // Sans marge connue, les sujets se classent sur le CA en jeu
  const t = tauxMarge ?? 1

  const univers: FicheVisite['univers'] = {}
  for (const u of UNIVERS_PANIER) {
    const i = mois.map((_, k) => k).filter((k) => (mois[k].univers?.[u].tickets ?? 0) > 0 && (mois1[k]?.univers?.[u].tickets ?? 0) > 0)
    if (!i.length) continue
    const de = (l: MoisReel[], f: 'tickets' | 'caTTC') => somme(i.map((k) => l[k].univers![u][f]))
    const tickets = de(mois, 'tickets'), ticketsN1 = de(mois1, 'tickets')
    univers[u] = { tickets, ticketsN1, panier: de(mois, 'caTTC') / tickets, panierN1: de(mois1, 'caTTC') / ticketsN1, mois: i.length }
  }

  const sujets: SujetVisite[] = []
  if (caBudget && ca < caBudget) sujets.push({ type: 'ca', ecart: ca / caBudget - 1, enJeu: (caBudget - ca) * t })
  if (tauxMarge !== null && tauxMargeN1 !== null && tauxMarge < tauxMargeN1) {
    sujets.push({ type: 'marge', ecart: tauxMarge - tauxMargeN1, enJeu: (tauxMargeN1 - tauxMarge) * somme(mois.map((x) => x.caAvecMarge)) })
  }
  for (const u of UNIVERS_PANIER) {
    const v = univers[u]
    if (!v) continue
    const ht = 1 / (1 + tvaPanier[u])
    if (v.tickets < v.ticketsN1) sujets.push({ type: 'tickets', univers: u, ecart: v.tickets / v.ticketsN1 - 1, enJeu: (v.ticketsN1 - v.tickets) * v.panierN1 * ht * t })
    if (v.panier < v.panierN1) sujets.push({ type: 'panier', univers: u, ecart: v.panier / v.panierN1 - 1, enJeu: (v.panierN1 - v.panier) * v.tickets * ht * t })
  }
  sujets.sort((a, b) => b.enJeu - a.enJeu)
  return { mois: m, ca, caBudget, caN1, tauxMarge, tauxMargeN1, univers, sujets: sujets.slice(0, SUJETS_VISITE) }
}
