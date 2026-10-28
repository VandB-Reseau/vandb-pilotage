import type { Quadrimestre } from './quadrimestre'
import { dernierMois, type MoisReel } from './suivi'
import type { Budget } from './types'

// Alertes des magasins (lot 13, 28/10/2026) : CA sous le budget, marge qui baisse, réel en retard, trésorerie sous le
// seuil. Seuils réglés par le Directeur dans Paramètres réseau.
// La marge se compare à l'an dernier sur les mêmes mois, marge théorique de la caisse contre marge théorique de la
// caisse : le budget, lui, retire la démarque, il n'est donc pas comparable.

export interface ParametresAlertes {
  ecartCA: number       // CA cumulé plus bas que le budget des mêmes mois de plus de cette part
  baisseMarge: number   // taux de marge plus bas que l'an dernier, mêmes mois, de plus de ces points (0,01 = 1 point)
  moisRetard: number    // mois terminés absents du réel à partir desquels on alerte
  tresorerie: number    // trésorerie (fin du dernier quadrimestre ou point bas du budget à venir) sous ce montant
}

// Valeurs proposées, modifiables : 5 % sous le budget, 1 point de marge, 1 mois de retard, trésorerie sous zéro
export const alertesParDefaut: ParametresAlertes = { ecartCA: 0.05, baisseMarge: 0.01, moisRetard: 1, tresorerie: 0 }

export type TypeAlerte = 'ca' | 'marge' | 'reel' | 'tresorerie'
export const TYPES_ALERTE: TypeAlerte[] = ['ca', 'marge', 'reel', 'tresorerie']

export type Alerte =
  | { magasin: string; type: 'ca'; ecart: number; mois: number }                        // ecart : −0,08 = 8 % sous le budget ; à fin du mois (1 à 12)
  | { magasin: string; type: 'marge'; taux: number; ecart: number; mois: number }        // ecart en points, négatif
  | { magasin: string; type: 'reel'; manquants: number; dernier: number }                // dernier mois présent, 0 : aucun
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

// Les plus graves d'abord : trésorerie, CA, marge, réel ; à type égal, le plus gros écart
const RANG: Record<TypeAlerte, number> = { tresorerie: 0, ca: 1, marge: 2, reel: 3 }
const poids = (a: Alerte) => (a.type === 'ca' || a.type === 'marge' ? a.ecart : a.type === 'reel' ? -a.manquants : a.montant)
export function trierAlertes(l: Alerte[]): Alerte[] {
  return [...l].sort((a, b) => RANG[a.type] - RANG[b.type] || poids(a) - poids(b) || a.magasin.localeCompare(b.magasin, 'fr'))
}
