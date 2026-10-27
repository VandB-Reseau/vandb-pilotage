import { nombre } from '../import/caisse'
import { FAMILLES_PAR_UNIVERS, type LigneReel, type TicketsReel } from './reel'
import { UNIVERS, universLibelle, type Univers } from './types'

// Saisie d'un mois du réel à la main : CA HT, CA TTC et marge par famille, tickets par univers.
// Les champs restent du texte (« 12 500,40 ») jusqu'à l'enregistrement.

export interface ChampsVente { caHT: string; caTTC: string; margeHT: string }
export interface SaisieMois { ventes: Record<string, ChampsVente>; tickets: Partial<Record<Univers, string>> }
export const cleVente = (univers: Univers, famille: string) => `${univers}/${famille}`
export const UNIVERS_TICKETS: Univers[] = ['cave', 'bar']

const enTexte = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','))

// Champs pré-remplis avec le réel déjà enregistré pour le mois
export function saisieDepuisReel(lignes: LigneReel[], tickets: TicketsReel[], mois: number): SaisieMois {
  const s: SaisieMois = { ventes: {}, tickets: {} }
  for (const l of lignes) if (l.mois === mois) s.ventes[cleVente(l.univers, l.famille)] = { caHT: enTexte(l.caHT), caTTC: enTexte(l.caTTC), margeHT: enTexte(l.margeHT) }
  for (const t of tickets) if (t.mois === mois) s.tickets[t.univers] = enTexte(t.tickets)
  return s
}

// Familles à saisir, par univers : la liste du réseau, plus celles déjà présentes (une famille propre à la caisse du magasin)
export function famillesASaisir(s: SaisieMois): { univers: Univers; familles: string[] }[] {
  return UNIVERS.map((u) => {
    const deja = Object.keys(s.ventes).filter((k) => k.startsWith(`${u}/`)).map((k) => k.slice(u.length + 1))
    return { univers: u, familles: [...new Set([...FAMILLES_PAR_UNIVERS[u], ...deja])] }
  })
}

export function lireSaisie(s: SaisieMois): { lignes: Omit<LigneReel, 'mois'>[]; tickets: Omit<TicketsReel, 'mois'>[]; erreurs: string[] } {
  const lignes: Omit<LigneReel, 'mois'>[] = []
  const tickets: Omit<TicketsReel, 'mois'>[] = []
  const erreurs: string[] = []
  for (const { univers, familles } of famillesASaisir(s)) {
    for (const famille of familles) {
      const c = s.ventes[cleVente(univers, famille)]
      if (!c) continue
      const nom = `${famille} (${universLibelle[univers]})`
      const [caHT, caTTC, margeHT] = [nombre(c.caHT), nombre(c.caTTC), nombre(c.margeHT)]
      if ([caHT, caTTC, margeHT].some((v) => Number.isNaN(v))) { erreurs.push(`${nom} : un montant est illisible.`); continue }
      if (caHT === null) {
        if (caTTC !== null || margeHT !== null) erreurs.push(`${nom} : le CA HT manque.`)
        continue
      }
      lignes.push({ univers, famille, caHT, caTTC, margeHT })
    }
  }
  for (const u of UNIVERS) {
    const t = nombre(s.tickets[u])
    if (t === null) continue
    if (Number.isNaN(t) || t < 0 || !Number.isInteger(t)) erreurs.push(`Tickets ${universLibelle[u]} : un nombre entier est attendu.`)
    else tickets.push({ univers: u, tickets: t })
  }
  return { lignes, tickets, erreurs }
}
