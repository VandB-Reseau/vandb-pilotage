import type { Budget } from './types'
import { universLibelle, type Univers } from './types'

// Lot 41, proposition 4 (Joseph, 02/11/2026) : un EBE visé, et ce qu'il faudrait pour l'atteindre, un levier à la fois.
// Leviers : tickets et panier moyen de la Cave et du Bar (univers construits par les tickets), évolution du CA des autres
// univers. Pour chaque levier, la valeur qui donne l'EBE visé, cherchée par dichotomie sur le budget complet (l'EBE
// croît avec chacun de ces leviers tant que la marge est positive). La masse salariale se lit directement : un euro de
// masse salariale en moins, c'est un euro d'EBE en plus. Fonctions pures, testées dans tests/moteur/budget-fluide.spec.ts.

export interface Levier { cle: string; libelle: string; actuelle: number }
export interface CheminLevier extends Levier { valeur: number | null } // null : hors d'atteinte entre −50 % et +100 %

// cle : clé d'écriture des cibles (voir ecrireCible) ; actuelle : valeur du budget affiché
export function leviersDuBudget(b: Budget): Levier[] {
  const l: Levier[] = []
  for (const u of ['cave', 'bar'] as const) {
    const f = b.flux[u]
    if (!f?.parTickets) continue
    l.push({ cle: `flux/${u}`, libelle: `Tickets ${universLibelle[u]}`, actuelle: f.evolution })
    l.push({ cle: `panier/${u}`, libelle: `Panier moyen ${universLibelle[u]}`, actuelle: f.evolutionPanier })
  }
  for (const u of ['cave', 'bar', 'exterieur'] as Univers[]) {
    if (b.flux[u as 'cave' | 'bar']?.parTickets) continue
    const familles = b.familles.filter((f) => f.univers === u)
    const ca = familles.reduce((a, f) => a + f.atterrissage, 0)
    if (ca <= 0) continue
    // Évolution moyenne des familles de l'univers, pondérée par leur CA atterri
    l.push({ cle: `univers/${u}`, libelle: `Évolution du CA ${universLibelle[u]}`, actuelle: familles.reduce((a, f) => a + f.atterrissage * f.evolution, 0) / ca })
  }
  return l
}

// Valeur x telle que ebe(x) = cible, entre bas et haut ; null si la cible est hors de portée
export function chercher(ebe: (x: number) => number, cible: number, bas = -0.5, haut = 1): number | null {
  let a = bas, b = haut
  const fa = ebe(a) - cible, fb = ebe(b) - cible
  if (fa > 0 || fb < 0) return null
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2
    if (ebe(m) - cible < 0) a = m
    else b = m
  }
  return Math.round(((a + b) / 2) * 1e4) / 1e4 // au centième de point
}

export function cheminsVersEbe(b: Budget, cible: number, ebeAvec: (cle: string, x: number) => number): { manque: number; leviers: CheminLevier[]; masseSalariale: number | null } {
  const manque = cible - b.ebe
  return {
    manque,
    leviers: leviersDuBudget(b).map((l) => ({ ...l, valeur: chercher((x) => ebeAvec(l.cle, x), cible) })),
    // Masse salariale qu'il faudrait : celle du budget moins ce qui manque ; null si elle passerait sous zéro
    masseSalariale: b.personnel - manque >= 0 ? b.personnel - manque : null,
  }
}
