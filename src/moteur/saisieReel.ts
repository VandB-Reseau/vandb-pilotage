import { nombre } from '../import/caisse'
import { FAMILLES_PAR_UNIVERS, type LigneReel, type TicketsReel } from './reel'
import { familleUnique, NON_DETAILLE, repartirLigne, type Reference } from './repartition'
import { UNIVERS, universLibelle, type Univers } from './types'

// Saisie d'un mois du réel à la main : par univers (CA HT, CA TTC, marge, tickets ; 03/11/2026) ou, au choix et
// conseillé, par famille. Les champs restent du texte (« 12 500,40 ») jusqu'à l'enregistrement.
// Par univers : une ligne « Non détaillé », répartie à la lecture (repartition.ts) ; CA TTC vide = CA HT × rapport TTC/HT
// de la référence ; l'Extérieur, à famille unique, va directement sur sa famille.

export interface ChampsVente { caHT: string; caTTC: string; margeHT: string }
export interface SaisieMois {
  ventes: Record<string, ChampsVente>
  tickets: Partial<Record<Univers, string>>
  parUnivers?: Partial<Record<Univers, ChampsVente>>
  detail?: Partial<Record<Univers, boolean>>   // vrai : saisie par famille pour cet univers
}
export const cleVente = (univers: Univers, famille: string) => `${univers}/${famille}`
export const UNIVERS_TICKETS: Univers[] = ['cave', 'bar']

const enTexte = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','))

// Champs pré-remplis avec le réel déjà enregistré pour le mois
// (lignes telles qu'enregistrées : une ligne « Non détaillé » remplit la saisie par univers). Un univers déjà détaillé
// s'ouvre en détail ; un univers vide s'ouvre par univers.
export function saisieDepuisReel(lignes: LigneReel[], tickets: TicketsReel[], mois: number): SaisieMois {
  const s: SaisieMois = { ventes: {}, tickets: {}, parUnivers: {}, detail: {} }
  for (const l of lignes) {
    if (l.mois !== mois) continue
    const champs = { caHT: enTexte(l.caHT), caTTC: enTexte(l.caTTC), margeHT: enTexte(l.margeHT) }
    if (l.famille === NON_DETAILLE) { s.parUnivers![l.univers] = champs; continue }
    s.ventes[cleVente(l.univers, l.famille)] = champs
    if (l.famille === familleUnique(l.univers)) s.parUnivers![l.univers] = champs
    else s.detail![l.univers] = true
  }
  for (const t of tickets) if (t.mois === mois) s.tickets[t.univers] = enTexte(t.tickets)
  return s
}

// Passage au détail d'un univers : les familles pré-remplies avec la répartition du total saisi, pour n'avoir qu'à corriger
export function detaillerUnivers(s: SaisieMois, u: Univers, ref: Reference | null): SaisieMois {
  const t = s.parUnivers?.[u]
  const caHT = nombre(t?.caHT)
  const dejaSaisi = Object.keys(s.ventes).some((k) => k.startsWith(`${u}/`) && s.ventes[k].caHT !== '')
  let ventes = s.ventes
  if (ref && caHT !== null && !Number.isNaN(caHT) && !dejaSaisi) {
    const ttc = nombre(t?.caTTC), marge = nombre(t?.margeHT)
    const lignes = repartirLigne({ mois: 0, univers: u, famille: NON_DETAILLE, caHT, caTTC: ttc === null || Number.isNaN(ttc) ? (ref.ratioTTC ? Math.round(caHT * ref.ratioTTC * 100) / 100 : null) : ttc,
      margeHT: marge === null || Number.isNaN(marge) ? null : marge }, ref)
    ventes = { ...ventes, ...Object.fromEntries(lignes.map((l) => [cleVente(u, l.famille), { caHT: enTexte(l.caHT), caTTC: enTexte(l.caTTC), margeHT: enTexte(l.margeHT) }])) }
  }
  return { ...s, ventes, detail: { ...s.detail, [u]: true } }
}

// Totaux d'un univers saisi par famille (affichés dans la ligne de l'univers)
export function totalFamilles(s: SaisieMois, u: Univers): { caHT: number; caTTC: number; margeHT: number } {
  const t = { caHT: 0, caTTC: 0, margeHT: 0 }
  for (const [k, c] of Object.entries(s.ventes)) {
    if (!k.startsWith(`${u}/`)) continue
    for (const champ of ['caHT', 'caTTC', 'margeHT'] as const) { const v = nombre(c[champ]); if (v !== null && !Number.isNaN(v)) t[champ] += v }
  }
  return t
}

// Familles à saisir, par univers : la liste du réseau, plus celles déjà présentes (une famille propre à la caisse du magasin)
export function famillesASaisir(s: SaisieMois): { univers: Univers; familles: string[] }[] {
  return UNIVERS.map((u) => {
    const deja = Object.keys(s.ventes).filter((k) => k.startsWith(`${u}/`)).map((k) => k.slice(u.length + 1))
    return { univers: u, familles: [...new Set([...FAMILLES_PAR_UNIVERS[u], ...deja])] }
  })
}

export function lireSaisie(s: SaisieMois, ratioTTC: Partial<Record<Univers, number | null>> = {}): { lignes: Omit<LigneReel, 'mois'>[]; tickets: Omit<TicketsReel, 'mois'>[]; erreurs: string[] } {
  const lignes: Omit<LigneReel, 'mois'>[] = []
  const tickets: Omit<TicketsReel, 'mois'>[] = []
  const erreurs: string[] = []
  for (const { univers, familles } of famillesASaisir(s)) {
    // Univers saisi d'un bloc (sans détail) : une seule ligne
    if (s.parUnivers && !s.detail?.[univers]) {
      const c = s.parUnivers[univers]
      if (!c) continue
      const nom = universLibelle[univers]
      const [caHT, caTTC, margeHT] = [nombre(c.caHT), nombre(c.caTTC), nombre(c.margeHT)]
      if ([caHT, caTTC, margeHT].some((v) => Number.isNaN(v))) { erreurs.push(`${nom} : un montant est illisible.`); continue }
      if (caHT === null) {
        if (caTTC !== null || margeHT !== null) erreurs.push(`${nom} : le CA HT manque.`)
        continue
      }
      const r = ratioTTC[univers]
      lignes.push({ univers, famille: familleUnique(univers) ?? NON_DETAILLE, caHT, caTTC: caTTC ?? (r ? Math.round(caHT * r * 100) / 100 : null), margeHT })
      continue
    }
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
