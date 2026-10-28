import { calculerBudget } from './budget'
import { coutPersonne, type Categorie } from './equipe'
import { tresorerieBudget, type Tresorerie } from './tresorerie'
import type { Budget, Hypotheses, ParametresReseau } from './types'

// Simulation « et si » sur le budget d'un magasin (lot 14, 28/10/2026) : baisse ou hausse du CA, marge, embauche,
// hausse de loyer. Les hypothèses sont copiées, jamais enregistrées : le budget ne bouge pas.

export interface Leviers {
  ca: number                 // variation du CA de toutes les familles (−0,1 = 10 % de moins)
  marge: number              // variation du taux de marge de toutes les familles, en points (−0,01 = 1 point de moins)
  embauche: { brutMensuel: number; heuresHebdo: number; categorie: Categorie; mois: number } | null  // mois d'entrée, 1 à 12
  loyer: number              // hausse du loyer, en euros par an (hors taxes)
}
export const sansLevier: Leviers = { ca: 0, marge: 0, embauche: null, loyer: 0 }

export function hypothesesSimulees(h: Hypotheses, l: Leviers, p: ParametresReseau): Hypotheses {
  const s: Hypotheses = {
    ...h,
    familles: h.familles.map((f) => ({ ...f, evolution: (1 + f.evolution) * (1 + l.ca) - 1, margeCible: f.margeCible + l.marge })),
    frais: l.loyer ? [...h.frais, { code: 'simulation_loyer', libelle: 'Hausse de loyer', rubrique: 'immobilier', annuel: l.loyer }] : h.frais,
  }
  if (l.embauche && l.embauche.brutMensuel > 0) {
    const e = l.embauche
    const entree = e.mois > 1 ? `${h.annee}-${String(e.mois).padStart(2, '0')}` : null
    if (h.equipe?.length) {
      // Le salaire saisi est celui de l'embauche : la hausse des salaires de l'équipe ne s'y ajoute pas
      const brutMensuel = e.brutMensuel / (1 + (h.hausseSalaires ?? 0))
      s.equipe = [...h.equipe, { poste: 'Embauche simulée', categorie: e.categorie, heuresHebdo: e.heuresHebdo, brutMensuel, primes: [], entree, sortie: null }]
    } else {
      // Personnel saisi en bloc : le coût chargé de l'embauche s'ajoute mois par mois
      const c = coutPersonne({ poste: 'Embauche simulée', categorie: e.categorie, heuresHebdo: e.heuresHebdo, brutMensuel: e.brutMensuel, primes: [], entree, sortie: null }, p.charges, h.annee)
      s.personnel = {
        ...h.personnel,
        salairesMensuels: h.personnel.salairesMensuels.map((v, i) => (v ?? 0) + c.cout[i]),
        heuresMensuelles: h.personnel.heuresMensuelles.map((v, i) => (v ?? 0) + c.heures[i]),
      }
    }
  }
  return s
}

export interface Simulation {
  budget: Budget
  simule: Budget
  tresorerie: Tresorerie
  tresorerieSimulee: Tresorerie
}

export function simuler(h: Hypotheses, p: ParametresReseau, l: Leviers, depart = 0): Simulation {
  const budget = calculerBudget(h, p)
  const hs = hypothesesSimulees(h, l, p)
  const simule = calculerBudget(hs, p)
  return {
    budget, simule,
    tresorerie: tresorerieBudget(budget, h, p, p.tresorerie, depart),
    tresorerieSimulee: tresorerieBudget(simule, hs, p, p.tresorerie, depart),
  }
}
