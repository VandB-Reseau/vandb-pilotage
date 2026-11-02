import { coutPersonne, masseSalariale, type ParametresCharges, type Personne } from './equipe'

// Lot 35 (Joseph, 02/11/2026) : changements de l'équipe dans l'année, dans l'ordre des mois, avec leur effet sur la
// masse salariale chargée de l'année. effet = coût de l'année avec le changement − coût sans lui (charges et réduction
// générale comprises, celle-ci dépendant du brut annuel).
export type TypeChangement = 'hausse_generale' | 'hausse' | 'arrivee' | 'depart' | 'prime'
export interface ChangementEquipe { mois: number; type: TypeChangement; poste: string; id?: number; taux?: number; montant?: number; effet: number }

const ORDRE: Record<TypeChangement, number> = { hausse_generale: 0, hausse: 1, arrivee: 2, depart: 3, prime: 4 }
const dansAnnee = (m: string | null | undefined, annee: number) => !!m && m.startsWith(`${annee}-`)
const moisDe = (m: string) => Number(m.slice(5, 7))

export function changementsEquipe(equipe: Personne[], c: ParametresCharges, annee: number, hausse = 0): ChangementEquipe[] {
  const r: ChangementEquipe[] = []
  const cout = (p: Personne) => coutPersonne(p, c, annee, hausse).coutAnnuel
  const salaries = equipe.filter((p) => !p.enveloppe)
  if (hausse && salaries.length) {
    r.push({ mois: 1, type: 'hausse_generale', poste: 'Toute l’équipe', taux: hausse, effet: masseSalariale(salaries, c, annee, hausse).cout - masseSalariale(salaries, c, annee, 0).cout })
  }
  for (const p of equipe) {
    const avec = cout(p)
    if (dansAnnee(p.entree, annee)) r.push({ mois: moisDe(p.entree!), type: 'arrivee', poste: p.poste, id: p.id, effet: avec })
    if (dansAnnee(p.sortie, annee)) r.push({ mois: moisDe(p.sortie!), type: 'depart', poste: p.poste, id: p.id, effet: avec - cout({ ...p, sortie: null }) })
    ;(p.hausses ?? []).forEach((h, i) => {
      if (dansAnnee(h.mois, annee)) r.push({ mois: moisDe(h.mois), type: 'hausse', poste: p.poste, id: p.id, taux: h.taux, effet: avec - cout({ ...p, hausses: p.hausses!.filter((_, j) => j !== i) }) })
    })
    p.primes.forEach((x, i) => {
      r.push({ mois: x.mois, type: 'prime', poste: p.poste, id: p.id, montant: x.montant, effet: avec - cout({ ...p, primes: p.primes.filter((_, j) => j !== i) }) })
    })
  }
  // Départ : au mois de sortie, dernier mois travaillé
  return r.sort((a, b) => a.mois - b.mois || ORDRE[a.type] - ORDRE[b.type])
}
