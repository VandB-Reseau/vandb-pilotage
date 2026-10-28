import type { Quadrimestre } from './quadrimestre'
import { dernierMois, UNIVERS_PANIER, type MoisReel, type UniversTickets } from './suivi'
import type { Budget } from './types'

// Alertes des magasins (lot 13, 28/10/2026) : CA sous le budget, marge qui baisse, réel en retard, trésorerie sous le
// seuil. Seuils réglés par le Directeur dans Paramètres réseau.
// La marge se compare à l'an dernier sur les mêmes mois, marge théorique de la caisse contre marge théorique de la
// caisse : le budget, lui, retire la démarque, il n'est donc pas comparable.
// Lot 28 : tickets (fréquentation) et panier moyen TTC (vente additionnelle) de la Cave et du Bar, jamais additionnés, sur
// les 3 derniers mois réalisés face aux mêmes mois de l'an dernier ; chaque mois doit avoir ses tickets les deux années.

export interface ParametresAlertes {
  ecartCA: number       // CA cumulé plus bas que le budget des mêmes mois de plus de cette part
  baisseMarge: number   // taux de marge plus bas que l'an dernier, mêmes mois, de plus de ces points (0,01 = 1 point)
  moisRetard: number    // mois terminés absents du réel à partir desquels on alerte
  tresorerie: number    // trésorerie (fin du dernier quadrimestre ou point bas du budget à venir) sous ce montant
  baisseTickets: number // tickets des 3 derniers mois plus bas que l'an dernier de plus de cette part (lot 28)
  baissePanier: number  // panier moyen TTC des 3 derniers mois plus bas que l'an dernier de plus de cette part (lot 28)
}

// Valeurs proposées, modifiables : 5 % sous le budget, 1 point de marge, 1 mois de retard, trésorerie sous zéro ;
// tickets 5 % et panier 3 % sous l'an dernier (lot 28)
export const alertesParDefaut: ParametresAlertes = { ecartCA: 0.05, baisseMarge: 0.01, moisRetard: 1, tresorerie: 0, baisseTickets: 0.05, baissePanier: 0.03 }
export const MOIS_COMMERCIAUX = 3

export type TypeAlerte = 'ca' | 'marge' | 'reel' | 'tresorerie' | 'tickets' | 'panier'
export const TYPES_ALERTE: TypeAlerte[] = ['ca', 'marge', 'tickets', 'panier', 'reel', 'tresorerie']

export type Alerte =
  | { magasin: string; type: 'ca'; ecart: number; mois: number }                        // ecart : −0,08 = 8 % sous le budget ; à fin du mois (1 à 12)
  | { magasin: string; type: 'marge'; taux: number; ecart: number; mois: number }        // ecart en points, négatif
  | { magasin: string; type: 'reel'; manquants: number; dernier: number }                // dernier mois présent, 0 : aucun
  | { magasin: string; type: 'tickets'; univers: UniversTickets; ecart: number; de: number; mois: number }  // mois de 1 à 12
  | { magasin: string; type: 'panier'; univers: UniversTickets; panier: number; ecart: number; de: number; mois: number }
  | { magasin: string; type: 'tresorerie'; source: 'reel'; montant: number; quadrimestre: Quadrimestre }
  | { magasin: string; type: 'tresorerie'; source: 'budget'; montant: number; mois: number; annee: number } // mois de 1 à 12

export interface EntreeAlertes {
  magasin: string
  n: MoisReel[]                 // réel de l'année en cours
  n1: MoisReel[]                // réel de l'année précédente
  budget: Budget | null         // budget de l'année en cours
  moisTermines: number          // mois terminés de l'année en cours (0 en janvier)
  tresorerieReelle: { montant: number; quadrimestre: Quadrimestre } | null   // dernier quadrimestre renseigné
  tresorerieBudget: { montant: number; mois: number; annee: number } | null  // point bas du budget à venir, mois de 0 à 11
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const tauxMarge = (l: MoisReel[]) => { const ca = somme(l.map((m) => m.caAvecMarge)); return ca > 0 ? somme(l.map((m) => m.margeHT)) / ca : null }

export function alertesMagasin(e: EntreeAlertes, s: ParametresAlertes): Alerte[] {
  const alertes: Alerte[] = []
  const m = dernierMois(e.n)
  const mois = e.n.slice(0, m)

  if (m && e.budget) {
    const ca = somme(mois.map((x) => x.caHT)), caBudget = somme(e.budget.mois.slice(0, m).map((x) => x.ca))
    const ecart = caBudget > 0 ? ca / caBudget - 1 : null
    if (ecart !== null && ecart < -s.ecartCA) alertes.push({ magasin: e.magasin, type: 'ca', ecart, mois: m })
  }
  if (m) {
    const t = tauxMarge(mois), t1 = tauxMarge(e.n1.slice(0, m))
    // Tolérance des arrondis : un écart d'un point tout juste n'alerte pas sous un seuil d'un point
    if (t !== null && t1 !== null && t - t1 < -s.baisseMarge - 1e-9) alertes.push({ magasin: e.magasin, type: 'marge', taux: t, ecart: t - t1, mois: m })
  }
  // Tickets et panier des 3 derniers mois, Cave et Bar séparés
  if (m >= MOIS_COMMERCIAUX) {
    const de = m - MOIS_COMMERCIAUX
    for (const u of UNIVERS_PANIER) {
      const n = e.n.slice(de, m).map((x) => x.univers?.[u]), n1 = e.n1.slice(de, m).map((x) => x.univers?.[u])
      if (![...n, ...n1].every((x) => x && x.tickets > 0)) continue
      const t = somme(n.map((x) => x!.tickets)), t1 = somme(n1.map((x) => x!.tickets))
      const panier = somme(n.map((x) => x!.caTTC)) / t, panier1 = somme(n1.map((x) => x!.caTTC)) / t1
      if (t / t1 - 1 < -s.baisseTickets - 1e-9) alertes.push({ magasin: e.magasin, type: 'tickets', univers: u, ecart: t / t1 - 1, de: de + 1, mois: m })
      if (panier1 > 0 && panier / panier1 - 1 < -s.baissePanier - 1e-9) {
        alertes.push({ magasin: e.magasin, type: 'panier', univers: u, panier, ecart: panier / panier1 - 1, de: de + 1, mois: m })
      }
    }
  }
  const manquants = e.moisTermines - m
  if (s.moisRetard > 0 && manquants >= s.moisRetard) alertes.push({ magasin: e.magasin, type: 'reel', manquants, dernier: m })
  if (e.tresorerieReelle && e.tresorerieReelle.montant < s.tresorerie) {
    alertes.push({ magasin: e.magasin, type: 'tresorerie', source: 'reel', ...e.tresorerieReelle })
  }
  if (e.tresorerieBudget && e.tresorerieBudget.montant < s.tresorerie) {
    alertes.push({ magasin: e.magasin, type: 'tresorerie', source: 'budget', montant: e.tresorerieBudget.montant, mois: e.tresorerieBudget.mois + 1, annee: e.tresorerieBudget.annee })
  }
  return alertes
}

// Les plus graves d'abord : trésorerie, CA, marge, tickets, panier, réel ; à type égal, le plus gros écart
const RANG: Record<TypeAlerte, number> = { tresorerie: 0, ca: 1, marge: 2, tickets: 3, panier: 4, reel: 5 }
const poids = (a: Alerte) => (a.type === 'reel' ? -a.manquants : a.type === 'tresorerie' ? a.montant : a.ecart)
export function trierAlertes(l: Alerte[]): Alerte[] {
  return [...l].sort((a, b) => RANG[a.type] - RANG[b.type] || poids(a) - poids(b) || a.magasin.localeCompare(b.magasin, 'fr'))
}

// Plan d'action (lot 21) : une action rattachée à une alerte garde la mesure du jour où elle est prise ; la mesure
// d'aujourd'hui, calculée de la même façon sans seuil, en montre l'effet sur les mois suivants.
export type TypeAction = TypeAlerte | 'autre'
export interface Mesure { valeur: number; mois: number | null } // ca : écart au budget ; marge : points sur l'an dernier ; reel : mois manquants ; tresorerie : montant ; tickets, panier : écart sur l'an dernier
export const plusHautMieuxAction: Record<TypeAlerte, boolean> = { ca: true, marge: true, tresorerie: true, reel: false, tickets: true, panier: true }

export function mesuresMagasin(e: EntreeAlertes): Partial<Record<TypeAlerte, Mesure>> {
  const toutes = alertesMagasin(e, { ecartCA: -Infinity, baisseMarge: -Infinity, moisRetard: 1, tresorerie: Infinity, baisseTickets: -Infinity, baissePanier: -Infinity })
  const r: Partial<Record<TypeAlerte, Mesure>> = {}
  for (const a of toutes) {
    if (a.type === 'ca' || a.type === 'marge') r[a.type] = { valeur: a.ecart, mois: a.mois }
    // Tickets et panier : l'univers le plus en baisse (une action se rattache au type, pas à l'univers)
    else if (a.type === 'tickets' || a.type === 'panier') { if (!r[a.type] || a.ecart < r[a.type]!.valeur) r[a.type] = { valeur: a.ecart, mois: a.mois } }
    else if (a.type === 'reel') r.reel = { valeur: a.manquants, mois: a.dernier || null }
    else if (!r.tresorerie) r.tresorerie = { valeur: a.montant, mois: a.source === 'reel' ? a.quadrimestre * 4 : null } // le réel d'abord
  }
  if (!r.reel && e.moisTermines > 0) r.reel = { valeur: 0, mois: dernierMois(e.n) || null }
  return r
}

// Mesure de départ d'une alerte, pour l'action qu'on y rattache
export function mesureDeAlerte(a: Alerte): Mesure {
  switch (a.type) {
    case 'ca': case 'marge': case 'tickets': case 'panier': return { valeur: a.ecart, mois: a.mois }
    case 'reel': return { valeur: a.manquants, mois: a.dernier || null }
    case 'tresorerie': return { valeur: a.montant, mois: a.source === 'reel' ? a.quadrimestre * 4 : null }
  }
}

// Effet : différence d'aujourd'hui au départ, et si elle va dans le bon sens
export function effetAction(type: TypeAlerte, depart: number, aujourdhui: number): { ecart: number; favorable: boolean | null } {
  const ecart = aujourdhui - depart
  return { ecart, favorable: Math.abs(ecart) < 1e-9 ? null : (ecart > 0) === plusHautMieuxAction[type] }
}
