import { syntheseReel, type LigneReel, type TicketsReel } from './reel'
import type { Budget } from './types'

// Santé d'un magasin en un coup d'œil : cumul réel de l'année comparé aux mêmes mois de l'an dernier,
// marge réelle, et résultat attendu (atterrissage). Séries mensuelles pour les courbes.
export interface Sante {
  moisRealises: number
  caCumule: number
  caCumuleN1: number | null          // mêmes mois l'an dernier (null : l'an dernier n'a pas de CA chacun de ces mois)
  evolution: number | null           // caCumule / caCumuleN1 − 1
  tauxMarge: number | null           // marge réelle / CA des familles dont la marge est connue
  margeCumulee: number
  serieN: (number | null)[]          // CA réel par mois (null après le dernier mois réalisé)
  serieN1: (number | null)[]         // CA de l'an dernier par mois (null si inconnu)
  projection: (number | null)[]      // CA projeté des mois restants (null sur les mois réalisés)
  atterrissage: Budget | null
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

export function santeMagasin(n: { lignes: LigneReel[]; tickets: TicketsReel[] }, n1: { lignes: LigneReel[]; tickets: TicketsReel[] }, atterrissage: Budget | null): Sante {
  const s = syntheseReel(n.lignes, n.tickets)
  const s1 = syntheseReel(n1.lignes, n1.tickets)
  const m = s.moisRenseignes
  const caCumule = somme(s.parMois.slice(0, m).map((x) => x.caHT))
  const aN1 = s1.caHT > 0
  // Lot 27 : l'évolution n'a de sens que si l'an dernier a du CA chacun des mêmes mois (pas un magasin ouvert en cours d'année)
  const comparable = aN1 && m > 0 && s1.parMois.slice(0, m).every((x) => x.caHT > 0)
  const caCumuleN1 = comparable ? somme(s1.parMois.slice(0, m).map((x) => x.caHT)) : null
  // Marge : seules les lignes dont la marge est renseignée comptent, pour ne pas sous-estimer le taux
  const avecMarge = n.lignes.filter((l) => l.mois <= m && l.margeHT !== null)
  const caAvecMarge = somme(avecMarge.map((l) => l.caHT))
  const margeCumulee = somme(avecMarge.map((l) => l.margeHT ?? 0))
  return {
    moisRealises: m,
    caCumule,
    caCumuleN1,
    evolution: caCumuleN1 ? caCumule / caCumuleN1 - 1 : null,
    tauxMarge: caAvecMarge > 0 ? margeCumulee / caAvecMarge : null,
    margeCumulee,
    serieN: s.parMois.map((x, i) => (i < m ? x.caHT : null)),
    serieN1: s1.parMois.map((x) => (aN1 ? x.caHT : null)),
    projection: atterrissage ? atterrissage.mois.map((x, i) => (i < m ? null : x.ca)) : Array(12).fill(null),
    atterrissage,
  }
}

// Synthèse d'un périmètre à partir des budgets de chaque magasin
export interface MagasinSynthese { statut: string | null; budget: Budget | null; aEquipe: boolean; aFrais: boolean }
export function syntheseBudgets(l: MagasinSynthese[]) {
  const avec = l.filter((m) => m.budget)
  const ca = somme(avec.map((m) => m.budget!.ca))
  const ebe = somme(avec.map((m) => m.budget!.ebe))
  return {
    magasins: l.length,
    valides: l.filter((m) => m.statut === 'valide').length,
    avecBudget: avec.length,
    ca, ebe, ebeSurCA: ca ? ebe / ca : 0,
    aCompleter: l.filter((m) => !m.aEquipe || !m.aFrais).length,
  }
}

// Cumul mois après mois (lot 27, CA cumulé de la synthèse) : null au-delà de la série
export function cumul(valeurs: (number | null)[]): (number | null)[] {
  let total = 0
  return valeurs.map((v) => (v === null ? null : (total += v)))
}
// Cumul d'une série qui en prolonge une autre : la projection part du dernier cumul réalisé
export function cumulApres(realise: (number | null)[], suite: (number | null)[]): (number | null)[] {
  const m = realise.reduce<number>((d, v, i) => (v !== null ? i + 1 : d), 0)
  let total = realise.slice(0, m).reduce<number>((a, v) => a + (v ?? 0), 0)
  return suite.map((v, i) => (i < m - 1 ? null : i === m - 1 ? total : v === null ? null : (total += v)))
}

// Ligne Total de la liste des magasins (lot 27) : sommes et ratios recalculés sur les sommes, jamais la moyenne des ratios
export function totalBudgets(budgets: Budget[]) {
  const ca = somme(budgets.map((b) => b.ca))
  const marge = somme(budgets.map((b) => b.marge))
  const personnel = somme(budgets.map((b) => b.personnel))
  const ebe = somme(budgets.map((b) => b.ebe))
  return { magasins: budgets.length, ca, marge, ebe, tauxMarge: ca ? marge / ca : 0, personnelSurMarge: marge ? personnel / marge : 0, ebeSurCA: ca ? ebe / ca : 0 }
}
