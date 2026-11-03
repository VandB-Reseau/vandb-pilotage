import type { Cibles } from './cibles'
import { universLibelle, type Univers } from './types'

// Lot 41, proposition 3 (Joseph, 02/11/2026) : ce que le magasin a changé par rapport à la position du siège, ligne par
// ligne, avec l'effet de chaque changement sur l'EBE. La position du siège est la photo des ajustements du magasin prise
// quand le Directeur les a écrits pour la dernière fois (colonne ajustements_siege, migration 0022).
// Effet d'un changement : EBE avec la position du siège et ce seul changement, moins l'EBE de la position du siège.
// Les effets ne s'additionnent pas toujours exactement (une marge visée et une évolution du CA se multiplient) : le total
// est l'EBE avec tous les changements, moins celui du siège.

export type Nature = 'taux' | 'montant' | 'liste'
export interface Changement {
  cle: string            // chemin dans les ajustements : « hausseSalaires », « evolutionFlux/cave », « margeFamille/cave/Bière »
  libelle: string
  nature: Nature
  avant: unknown         // valeur du siège (undefined : celle du réseau ou du réalisé)
  apres: unknown         // valeur du magasin (undefined : retirée)
  cibles: Cibles         // position du siège avec ce seul changement
}

// Clés dont chaque entrée se lit à part ; les autres (saisonnalité, travaux, temps forts…) comptent pour un changement
const PAR_ENTREE = ['evolutionUnivers', 'evolutionFamille', 'margeFamille', 'demarqueFamille', 'mixFamille', 'evolutionFlux', 'evolutionPanier', 'rythme', 'fraisBudget'] as const
type CleEntree = (typeof PAR_ENTREE)[number]
const estParEntree = (k: string): k is CleEntree => (PAR_ENTREE as readonly string[]).includes(k)

const nomFamille = (cle: string) => { const [u, ...n] = cle.split('/'); return `${n.join('/')} (${universLibelle[u as Univers] ?? u})` }
const nomUnivers = (u: string) => universLibelle[u as Univers] ?? u

function libelleDe(k: string, entree: string | null, nomsFrais: Record<string, string>): { libelle: string; nature: Nature } {
  switch (k) {
    case 'evolutionUnivers': return { libelle: `Évolution du CA ${nomUnivers(entree!)}`, nature: 'taux' }
    case 'evolutionFamille': return { libelle: `Évolution du CA ${nomFamille(entree!)}`, nature: 'taux' }
    case 'margeFamille': return { libelle: `Marge visée ${nomFamille(entree!)}`, nature: 'taux' }
    case 'demarqueFamille': return { libelle: `Démarque ${nomFamille(entree!)}`, nature: 'taux' }
    case 'mixFamille': return { libelle: `Part de ${nomFamille(entree!)}`, nature: 'taux' }
    case 'evolutionFlux': return { libelle: `Tickets ${nomUnivers(entree!)}`, nature: 'taux' }
    case 'evolutionPanier': return { libelle: `Panier moyen ${nomUnivers(entree!)}`, nature: 'taux' }
    case 'rythme': return { libelle: `Rythme de sortie ${nomUnivers(entree!)}`, nature: 'liste' }
    case 'fraisBudget': return { libelle: `Frais : ${nomsFrais[entree!] ?? entree}`, nature: 'liste' }
    case 'hausseSalaires': return { libelle: 'Hausse générale des salaires', nature: 'taux' }
    case 'inflationFrais': return { libelle: 'Inflation des frais', nature: 'taux' }
    case 'tresorerieDepart': return { libelle: 'Trésorerie au 1er janvier', nature: 'montant' }
    case 'poidsMois': return { libelle: 'Saisonnalité', nature: 'liste' }
    case 'travaux': return { libelle: 'Travaux', nature: 'liste' }
    case 'tempsForts': return { libelle: 'Temps forts', nature: 'liste' }
    case 'ajustementsCA': return { libelle: 'Clients gagnés ou perdus', nature: 'liste' }
    default: return { libelle: k, nature: 'liste' }
  }
}
// Ordre de lecture : ventes, marge, équipe, frais, calendrier, trésorerie
const ORDRE = ['evolutionFlux', 'evolutionPanier', 'evolutionUnivers', 'evolutionFamille', 'mixFamille', 'margeFamille', 'demarqueFamille', 'hausseSalaires', 'inflationFrais', 'fraisBudget', 'poidsMois', 'rythme', 'travaux', 'tempsForts', 'ajustementsCA', 'tresorerieDepart']
const rang = (k: string) => { const i = ORDRE.indexOf(k); return i < 0 ? ORDRE.length : i }

const pareil = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function avecValeur(c: Cibles, k: string, entree: string | null, v: unknown): Cibles {
  const r = { ...c } as Record<string, unknown>
  if (entree === null) {
    if (v === undefined) delete r[k]
    else r[k] = v
    return r as Cibles
  }
  const o = { ...((r[k] as Record<string, unknown> | undefined) ?? {}) }
  if (v === undefined) delete o[entree]
  else o[entree] = v
  if (Object.keys(o).length) r[k] = o
  else delete r[k]
  return r as Cibles
}

export function changementsCibles(siege: Cibles, magasin: Cibles, nomsFrais: Record<string, string> = {}): Changement[] {
  const s = siege as Record<string, unknown>, m = magasin as Record<string, unknown>
  const l: Changement[] = []
  for (const k of [...new Set([...Object.keys(s), ...Object.keys(m)])].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))) {
    if (k === 'accords') continue // lot 42 : thèmes acceptés par le franchisé, pas une hypothèse
    if (estParEntree(k)) {
      const a = (s[k] ?? {}) as Record<string, unknown>, b = (m[k] ?? {}) as Record<string, unknown>
      for (const e of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => x.localeCompare(y, 'fr'))) {
        if (pareil(a[e], b[e])) continue
        l.push({ cle: `${k}/${e}`, ...libelleDe(k, e, nomsFrais), avant: a[e], apres: b[e], cibles: avecValeur(siege, k, e, b[e]) })
      }
    } else if (!pareil(s[k], m[k])) {
      l.push({ cle: k, ...libelleDe(k, null, nomsFrais), avant: s[k], apres: m[k], cibles: avecValeur(siege, k, null, m[k]) })
    }
  }
  return l
}

// Effets sur l'EBE : ebe(cibles) calcule l'EBE du budget avec ces ajustements du magasin
export function effetsChangements(siege: Cibles, magasin: Cibles, changements: Changement[], ebe: (c: Cibles) => number): { effets: (Changement & { effet: number })[]; total: number; ebeSiege: number; ebeMagasin: number } {
  const ebeSiege = ebe(siege), ebeMagasin = ebe(magasin)
  return { effets: changements.map((c) => ({ ...c, effet: ebe(c.cibles) - ebeSiege })), total: ebeMagasin - ebeSiege, ebeSiege, ebeMagasin }
}

// Ce que la validation doit signaler avant de figer le budget
export interface PointValidation { cle: 'tresorerie' | 'pointBas' | 'envoi'; texte: string }
export function pointsAvantValidation(e: { tresorerieDepart: number | undefined; pointBas: { montant: number; mois: number } | null; changementsNonEnvoyes: boolean; estimee?: string }, mois: readonly string[]): PointValidation[] {
  const p: PointValidation[] = []
  // Lot 42 : trésorerie estimée depuis les comptes ; la validation la fige, le solde bancaire reste plus sûr
  if (e.tresorerieDepart === undefined && e.estimee) p.push({ cle: 'tresorerie', texte: `La trésorerie au 1er janvier n’est pas saisie : elle est estimée à ${e.estimee} depuis les comptes, et sera figée à ce montant.` })
  else if (e.tresorerieDepart === undefined) p.push({ cle: 'tresorerie', texte: 'La trésorerie au 1er janvier n’est pas saisie : le plan de trésorerie part de zéro.' })
  if (e.pointBas && e.pointBas.montant < 0) p.push({ cle: 'pointBas', texte: `La trésorerie passe sous zéro en ${mois[e.pointBas.mois]} (point bas du plan).` })
  if (e.changementsNonEnvoyes) p.push({ cle: 'envoi', texte: 'Le franchisé a des changements enregistrés qu’il n’a pas encore envoyés.' })
  return p
}

// Lot 42 (proposition 6) : budgets envoyés au siège sans aucun changement par rapport à sa proposition (la trésorerie au
// 1er janvier saisie n'en est pas un : c'est un constat, pas un désaccord). Le Responsable
// Régional ou le Directeur peut les valider ensemble ; les autres se revoient un par un.
export interface BudgetAValider { magasin: string; statut: string | null; envoyeLe: string | null; siege: Cibles | null; ajustements: Cibles }
export function pretsAValider<T extends BudgetAValider>(budgets: T[]): T[] {
  return budgets.filter((b) => b.statut === 'en_discussion' && !!b.envoyeLe && changementsCibles(b.siege ?? {}, b.ajustements).every((c) => c.cle === 'tresorerieDepart'))
}

// Lot 42 : avancement du franchisé, thème par thème (« D'accord » ou un changement dans le thème)
export const THEMES_ACCORD = ['ventes', 'calendrier', 'equipe', 'fraisBudget', 'tresoBudget'] as const
export type ThemeAccord = (typeof THEMES_ACCORD)[number]
const CLES_THEME: Record<ThemeAccord, string[]> = {
  ventes: ['evolutionFlux', 'evolutionPanier', 'evolutionUnivers', 'evolutionFamille', 'mixFamille', 'margeFamille', 'demarqueFamille', 'rythme'],
  calendrier: ['poidsMois', 'travaux', 'tempsForts', 'ajustementsCA'],
  equipe: ['hausseSalaires'],
  fraisBudget: ['inflationFrais', 'fraisBudget'],
  tresoBudget: ['tresorerieDepart'],
}
export function themeDeCle(cle: string): ThemeAccord | null {
  const racine = cle.split('/')[0]
  return THEMES_ACCORD.find((t) => CLES_THEME[t].includes(racine)) ?? null
}
// Un thème est vu quand le franchisé l'a accepté ou y a changé quelque chose
export function themesVus(siege: Cibles, magasin: Cibles): ThemeAccord[] {
  const changes = new Set(changementsCibles(siege, magasin).map((c) => themeDeCle(c.cle)).filter((t): t is ThemeAccord => !!t))
  return THEMES_ACCORD.filter((t) => changes.has(t) || (magasin.accords ?? []).includes(t))
}
