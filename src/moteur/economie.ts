import { masseSalariale } from './equipe'
import type { Budget, Hypotheses, ParametresReseau } from './types'

// Économie du franchisé (lot 29, 28/10/2026) : à partir de quel CA le magasin gagne de l'argent, et ce qu'il reste.
// Coûts variables : achats (la marge les retire), redevance, publicité et frais saisis en part du CA.
// Coûts fixes : tout le reste jusqu'au résultat avant impôt (personnel, frais annuels, impôts et taxes, amortissements,
// intérêts), d'où fixes = marge sur coûts variables − résultat avant impôt.
// Point mort : CA où le résultat avant impôt est nul = fixes ÷ taux de marge sur coûts variables.

export interface EconomieFranchise {
  ca: number
  mcv: number; tauxMCV: number          // marge sur coûts variables et son taux
  fixes: number
  pointMort: number | null              // null si la marge sur coûts variables est nulle ou négative
  margeSecurite: number | null          // (CA − point mort) ÷ CA
  gerant: number                        // rémunération du gérant, charges comprises
  resteDisponible: number               // capacité d'autofinancement moins capital remboursé
}

// Gérant : postes « gérant non salarié » de l'équipe, sinon la gérance des hypothèses
export function coutGerant(h: Hypotheses, p: Pick<ParametresReseau, 'charges'>): number {
  const gerants = h.equipe?.filter((x) => x.categorie === 'gerant_tns') ?? []
  if (h.equipe?.length) return gerants.length ? masseSalariale(gerants, p.charges, h.annee, h.hausseSalaires ?? 0).cout : 0
  return h.personnel.remunerationGerance * 12 * (1 + h.personnel.tauxCotisationsGerance)
}

export function economieFranchise(b: Budget, h: Hypotheses, p: Pick<ParametresReseau, 'charges'>): EconomieFranchise {
  const tauxFrais = h.frais.reduce((a, l) => a + (l.tauxCA ?? 0), 0)
  const mcv = b.marge - b.redevance - b.publicite - tauxFrais * b.ca
  const tauxMCV = b.ca > 0 ? mcv / b.ca : 0
  const fixes = mcv - b.resultatAvantImpot
  const pointMort = tauxMCV > 0 ? fixes / tauxMCV : null
  return {
    ca: b.ca, mcv, tauxMCV, fixes, pointMort,
    margeSecurite: pointMort !== null && b.ca > 0 ? (b.ca - pointMort) / b.ca : null,
    gerant: coutGerant(h, p), resteDisponible: b.tresorerieDegagee,
  }
}

// CA à atteindre pour porter la rémunération du gérant à la cible, au même résultat : chaque euro de plus pour le gérant
// est un coût fixe de plus, couvert par la marge sur coûts variables
export function caPourRemuneration(e: EconomieFranchise, cible: number): { ca: number; ecart: number } | null {
  if (e.tauxMCV <= 0 || e.ca <= 0) return null
  const ca = e.ca + (cible - e.gerant) / e.tauxMCV
  return { ca, ecart: ca / e.ca - 1 }
}
