import type { Cibles } from './cibles'
import { UNIVERS, type Budget, type Univers } from './types'

// Joseph (03/11/2026) : une carte d'hypothèses dit ce qu'il reste à faire, par des questions fermées ; « Rien de prévu »
// est une réponse (gardée dans les ajustements, sans effet sur le calcul), une saisie aussi.
// Évènements & Temps forts : temps forts, clients extérieurs ; Investissements & Financements : travaux, achats, emprunts.
export const QUESTIONS_CALENDRIER = ['tempsForts', 'ajustementsCA'] as const
export const QUESTIONS_INVESTISSEMENTS = ['travaux', 'investissements', 'emprunts'] as const
export type QuestionCalendrier = (typeof QUESTIONS_CALENDRIER)[number] | (typeof QUESTIONS_INVESTISSEMENTS)[number]
const TOUTES: readonly QuestionCalendrier[] = [...QUESTIONS_INVESTISSEMENTS, ...QUESTIONS_CALENDRIER]
export type Reponse = 'saisie' | 'rien' | 'aRepondre'
export type EtatCarte = 'aFaire' | 'aVerifier' | 'fait'

// Nombre d'éléments saisis pour une question : mois touchés par des travaux, achats, emprunts (apport compris), temps
// forts, clients
export function saisiesQuestion(c: Cibles, q: QuestionCalendrier): number {
  if (q === 'travaux') return c.travaux ? 1 : 0
  if (q === 'investissements') return c.investissements?.length ?? 0
  if (q === 'emprunts') return (c.emprunts?.length ?? 0) + (c.apport ? 1 : 0)
  if (q === 'tempsForts') return c.tempsForts?.length ?? 0
  return c.ajustementsCA?.length ?? 0
}

export function reponseQuestion(c: Cibles, q: QuestionCalendrier): Reponse {
  if (saisiesQuestion(c, q) > 0) return 'saisie'
  return (c.rienPrevu ?? []).includes(q) ? 'rien' : 'aRepondre'
}

// « Rien de prévu » coché ou retiré ; la liste vide disparaît des ajustements
export function marquerRienPrevu(c: Cibles, q: QuestionCalendrier, rien: boolean): Cibles {
  const l = new Set(c.rienPrevu ?? [])
  if (rien) l.add(q)
  else l.delete(q)
  const { rienPrevu: _, ...reste } = c
  return l.size ? { ...reste, rienPrevu: TOUTES.filter((x) => l.has(x)) } : reste
}

export function etatCalendrier(c: Cibles): EtatCarte {
  return QUESTIONS_CALENDRIER.every((q) => reponseQuestion(c, q) !== 'aRepondre') ? 'fait' : 'aFaire'
}
export function etatInvestissements(c: Cibles): EtatCarte {
  return QUESTIONS_INVESTISSEMENTS.every((q) => reponseQuestion(c, q) !== 'aRepondre') ? 'fait' : 'aFaire'
}

// Équipe : à faire sans équipe ni masse salariale reprise des comptes ; reprise des comptes, à vérifier
export function etatEquipe(sansEquipe: boolean, reprisePersonnel: boolean): EtatCarte {
  return reprisePersonnel ? 'aVerifier' : sansEquipe ? 'aFaire' : 'fait'
}

// Frais : repris des comptes, à vérifier ; sans aucune ligne de frais, à faire
export function etatFrais(sansFrais: boolean, repriseFrais: boolean): EtatCarte {
  return repriseFrais ? 'aVerifier' : sansFrais ? 'aFaire' : 'fait'
}

// Carte d'un univers sur « Construire » : CA de départ et budgété, évolutions retenues, marge visée
export interface ResumeUnivers {
  univers: Univers
  depart: number; ca: number; ecart: number | null
  tickets?: number; panier?: number    // Cave et Bar construits par les tickets
  evolution?: number                   // autres univers : évolution moyenne du CA, pondérée par le CA de départ
  marge: number | null                 // marge visée avant démarque, en part du CA budgété
}
export function resumeUnivers(b: Budget): ResumeUnivers[] {
  return UNIVERS.flatMap((u) => {
    const l = b.familles.filter((f) => f.univers === u)
    if (!l.length) return []
    const depart = l.reduce((a, f) => a + f.atterrissage, 0)
    const ca = l.reduce((a, f) => a + f.objectif, 0)
    const fl = u === 'exterieur' ? undefined : b.flux[u]
    const r: ResumeUnivers = {
      univers: u, depart, ca, ecart: depart ? ca / depart - 1 : null,
      marge: ca ? l.reduce((a, f) => a + f.objectif * f.margeCible, 0) / ca : null,
    }
    if (fl?.parTickets) { r.tickets = fl.evolution; r.panier = fl.evolutionPanier }
    else r.evolution = depart ? l.reduce((a, f) => a + f.atterrissage * f.evolution, 0) / depart : 0
    return [r]
  })
}
