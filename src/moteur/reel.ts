import { UNIVERS, type Univers } from './types'

// Réel de l'année d'un magasin : CA et marge par mois, univers et famille ; tickets par mois et univers.
// Une famille vendue en Cave et au Bar compte deux fois ; un ticket, lui, ne se compte qu'au niveau de l'univers.

// Familles de la caisse, communes au réseau (intitulés de la caisse → libellés de l'app)
export const FAMILLES_CAISSE: Record<string, string> = {
  BIERE: 'Bière', VIN: 'Vin', SPIRITUEUX: 'Spiritueux', 'SANS ALCOOL': 'Sans alcool', ACCESSOIRE: 'Accessoires', FUT: 'Fût',
  ALIMENTAIRE: 'Alimentaire', SOFT: 'Soft', COCKTAIL: 'Cocktail', AUTRE: 'Autre', FACTURES: 'Factures',
}
// Familles proposées à la saisie, par univers
export const FAMILLES_PAR_UNIVERS: Record<Univers, string[]> = {
  cave: ['Bière', 'Vin', 'Spiritueux', 'Sans alcool', 'Accessoires', 'Fût', 'Alimentaire', 'Soft', 'Cocktail', 'Autre'],
  bar: ['Fût', 'Bière', 'Vin', 'Spiritueux', 'Cocktail', 'Sans alcool', 'Soft', 'Alimentaire', 'Accessoires', 'Autre'],
  exterieur: ['Factures'],
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
export const cleCaisse = (s: string) => sansAccents(s).trim().toUpperCase().replace(/\s+/g, ' ')
// Libellé d'une famille de la caisse ; une famille inconnue garde son intitulé, mis en forme
export function libelleFamille(s: string): { libelle: string; connue: boolean } {
  const connu = FAMILLES_CAISSE[cleCaisse(s)]
  if (connu) return { libelle: connu, connue: true }
  const t = s.trim().toLowerCase()
  return { libelle: t.charAt(0).toUpperCase() + t.slice(1), connue: false }
}

export interface LigneReel { mois: number; univers: Univers; famille: string; caHT: number; caTTC: number | null; margeHT: number | null }
export interface TicketsReel { mois: number; univers: Univers; tickets: number }

export interface SyntheseMois { mois: number; caHT: number; margeHT: number; caTTC: number; tickets: number; panierTTC: number | null }
export interface SyntheseFamille { univers: Univers; famille: string; caHT: number; margeHT: number; tauxMarge: number; part: number; parMois: number[] }
export interface SyntheseReel {
  parMois: SyntheseMois[]
  familles: SyntheseFamille[]
  caHT: number
  margeHT: number
  tauxMarge: number
  tickets: number
  panierTTC: number | null
  moisRenseignes: number // dernier mois avec du CA (0 : aucun)
  // Cave et Bar séparés (lot 22) : deux clientèles, deux paniers ; on ne les additionne pas pour piloter
  parUnivers: Record<'cave' | 'bar', SyntheseUnivers>
}
export interface SyntheseUnivers {
  tickets: number
  caTTC: number
  panierTTC: number | null
  parMois: { tickets: number; caTTC: number; panierTTC: number | null }[]
}

// Tickets et panier TTC d'un univers sur les mois donnés (1 à 12) ; le panier ne compte que les mois où CA TTC et
// tickets sont connus
export function cumulUnivers(u: SyntheseUnivers, jusquA = 12): { tickets: number; panierTTC: number | null } {
  const mois = u.parMois.slice(0, jusquA)
  const avec = mois.filter((m) => m.panierTTC !== null)
  const t = avec.reduce((a, m) => a + m.tickets, 0)
  return { tickets: mois.reduce((a, m) => a + m.tickets, 0), panierTTC: t ? avec.reduce((a, m) => a + m.caTTC, 0) / t : null }
}

const ratio = (a: number, b: number) => (b ? a / b : 0)

export function syntheseReel(lignes: LigneReel[], tickets: TicketsReel[]): SyntheseReel {
  const parMois: SyntheseMois[] = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, caHT: 0, margeHT: 0, caTTC: 0, tickets: 0, panierTTC: null }))
  const familles = new Map<string, SyntheseFamille>()
  for (const l of lignes) {
    const m = parMois[l.mois - 1]
    if (!m) continue
    m.caHT += l.caHT
    m.margeHT += l.margeHT ?? 0
    m.caTTC += l.caTTC ?? 0
    const cle = `${l.univers}/${l.famille}`
    const f = familles.get(cle) ?? { univers: l.univers, famille: l.famille, caHT: 0, margeHT: 0, tauxMarge: 0, part: 0, parMois: Array(12).fill(0) }
    f.caHT += l.caHT
    f.margeHT += l.margeHT ?? 0
    f.parMois[l.mois - 1] += l.caHT
    familles.set(cle, f)
  }
  for (const t of tickets) if (parMois[t.mois - 1]) parMois[t.mois - 1].tickets += t.tickets
  const univers = (u: 'cave' | 'bar'): SyntheseUnivers => {
    const pm = Array.from({ length: 12 }, () => ({ tickets: 0, caTTC: 0, panierTTC: null as number | null }))
    for (const l of lignes) if (l.univers === u && pm[l.mois - 1]) pm[l.mois - 1].caTTC += l.caTTC ?? 0
    for (const t of tickets) if (t.univers === u && pm[t.mois - 1]) pm[t.mois - 1].tickets += t.tickets
    for (const m of pm) m.panierTTC = m.tickets > 0 && m.caTTC > 0 ? m.caTTC / m.tickets : null
    const r = { tickets: 0, caTTC: pm.reduce((a, m) => a + m.caTTC, 0), panierTTC: null, parMois: pm }
    return { ...r, ...cumulUnivers(r) }
  }
  // Panier moyen TTC : seulement les mois où CA TTC et tickets sont connus
  for (const m of parMois) m.panierTTC = m.tickets > 0 && m.caTTC > 0 ? m.caTTC / m.tickets : null

  const caHT = parMois.reduce((a, m) => a + m.caHT, 0)
  const margeHT = parMois.reduce((a, m) => a + m.margeHT, 0)
  const avecPanier = parMois.filter((m) => m.panierTTC !== null)
  const ticketsPanier = avecPanier.reduce((a, m) => a + m.tickets, 0)
  const liste = [...familles.values()]
    .map((f) => ({ ...f, tauxMarge: ratio(f.margeHT, f.caHT), part: ratio(f.caHT, caHT) }))
    .sort((a, b) => UNIVERS.indexOf(a.univers) - UNIVERS.indexOf(b.univers) || b.caHT - a.caHT)
  const dernier = [...parMois].reverse().find((m) => m.caHT > 0)
  return {
    parMois, familles: liste, caHT, margeHT, tauxMarge: ratio(margeHT, caHT),
    tickets: parMois.reduce((a, m) => a + m.tickets, 0),
    panierTTC: ticketsPanier ? avecPanier.reduce((a, m) => a + m.caTTC, 0) / ticketsPanier : null,
    moisRenseignes: dernier?.mois ?? 0,
    parUnivers: { cave: univers('cave'), bar: univers('bar') },
  }
}
