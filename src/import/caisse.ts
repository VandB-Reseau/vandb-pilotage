import { cleCaisse, libelleFamille } from '../moteur/reel'
import type { Univers } from '../moteur/types'

// Fichiers mensuels de la DSI (format défini le 27/10/2026, voir docs/import-caisse.md) :
// - ventes_AAAA-MM.csv : code_magasin;date;univers;famille;ca_ht;ca_ttc;marge_ht
// - tickets_AAAA-MM.csv : code_magasin;date;univers;tickets
// Une ligne par jour (ou par mois, daté du 1er) ; l'app cumule par mois. Le même format sert à l'année précédente.

export interface VenteMois { code: string; mois: string; univers: Univers; famille: string; caHT: number; caTTC: number | null; margeHT: number | null }
export interface TicketsMois { code: string; mois: string; univers: Univers; tickets: number }
export interface Lecture<T> { lignes: T[]; erreurs: string[]; alertes: string[]; nbLignes: number }

export class FichierInattendu extends Error {
  manquantes: string[]
  constructor(manquantes: string[]) { super('colonnes manquantes'); this.manquantes = manquantes }
}

const UNIVERS_CAISSE: Record<string, Univers> = { CAVE: 'cave', BAR: 'bar', EXTERIEUR: 'exterieur' }

// Découpe un CSV au point-virgule (ou à la virgule si c'est le seul séparateur), guillemets compris
function lignesCsv(texte: string): string[][] {
  const t = texte.replace(/^﻿/, '')
  const premiere = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = premiere.includes(';') ? ';' : premiere.includes('\t') ? '\t' : ','
  const lignes: string[][] = []
  let champ = '', ligne: string[] = [], guillemets = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i++ }
      else if (c === '"') guillemets = false
      else champ += c
    } else if (c === '"') guillemets = true
    else if (c === sep) { ligne.push(champ); champ = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      ligne.push(champ); champ = ''
      if (ligne.some((x) => x.trim() !== '')) lignes.push(ligne)
      ligne = []
    } else champ += c
  }
  ligne.push(champ)
  if (ligne.some((x) => x.trim() !== '')) lignes.push(ligne)
  return lignes
}

// « 1 250,40 », « 1250.40 », « 1.250,40 » → 1250.4 ; vide → null ; illisible → NaN
export function nombre(s: string | undefined): number | null {
  const t = (s ?? '').replace(/[\s  €]/g, '')
  if (t === '') return null
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN
}

// « 2026-10-03 », « 2026-10 », « 03/10/2026 » → « 2026-10 »
export function moisDe(s: string | undefined): string | null {
  const t = (s ?? '').trim()
  let m = t.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/)
  if (m) return Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${m[1]}-${m[2].padStart(2, '0')}` : null
  m = t.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/)
  if (m) return Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${m[2]}-${m[1].padStart(2, '0')}` : null
  return null
}

function lire<T>(texte: string, attendues: string[], ligneVers: (v: Record<string, string>, n: number, erreurs: string[], alertes: Set<string>) => T | null): Lecture<T> {
  const lignes = lignesCsv(texte)
  const entete = (lignes[0] ?? []).map((x) => x.trim().toLowerCase())
  const manquantes = attendues.filter((a) => !entete.includes(a))
  if (manquantes.length) throw new FichierInattendu(manquantes)
  const erreurs: string[] = []
  const alertes = new Set<string>()
  const sortie: T[] = []
  lignes.slice(1).forEach((l, i) => {
    const v = Object.fromEntries(entete.map((c, j) => [c, (l[j] ?? '').trim()]))
    const r = ligneVers(v, i + 2, erreurs, alertes)
    if (r) sortie.push(r)
  })
  return { lignes: sortie, erreurs, alertes: [...alertes], nbLignes: lignes.length - 1 }
}

function communs(v: Record<string, string>, n: number, erreurs: string[]): { code: string; mois: string; univers: Univers } | null {
  const code = v.code_magasin
  const mois = moisDe(v.date)
  const univers = UNIVERS_CAISSE[cleCaisse(v.univers ?? '')]
  if (!code) { erreurs.push(`Ligne ${n} : code magasin vide.`); return null }
  if (!mois) { erreurs.push(`Ligne ${n} : date « ${v.date} » illisible (attendu AAAA-MM-JJ).`); return null }
  if (!univers) { erreurs.push(`Ligne ${n} : univers « ${v.univers} » inconnu (CAVE, BAR ou EXTERIEUR).`); return null }
  return { code, mois, univers }
}

export function lireVentes(texte: string): Lecture<VenteMois> {
  const cumuls = new Map<string, VenteMois>()
  const lecture = lire(texte, ['code_magasin', 'date', 'univers', 'famille', 'ca_ht', 'marge_ht'], (v, n, erreurs, alertes) => {
    const c = communs(v, n, erreurs)
    if (!c) return null
    const caHT = nombre(v.ca_ht)
    const caTTC = nombre(v.ca_ttc)
    const margeHT = nombre(v.marge_ht)
    if (caHT === null || Number.isNaN(caHT)) { erreurs.push(`Ligne ${n} : CA HT « ${v.ca_ht} » illisible.`); return null }
    if (Number.isNaN(caTTC) || Number.isNaN(margeHT)) { erreurs.push(`Ligne ${n} : montant illisible.`); return null }
    if (!v.famille) { erreurs.push(`Ligne ${n} : famille vide.`); return null }
    const f = libelleFamille(v.famille)
    if (!f.connue) alertes.add(`Famille « ${v.famille} » absente de la liste du réseau : gardée telle quelle.`)
    const cle = `${c.code}|${c.mois}|${c.univers}|${f.libelle}`
    const cumul = cumuls.get(cle) ?? { ...c, famille: f.libelle, caHT: 0, caTTC: null, margeHT: null }
    cumul.caHT += caHT
    if (caTTC !== null) cumul.caTTC = (cumul.caTTC ?? 0) + caTTC
    if (margeHT !== null) cumul.margeHT = (cumul.margeHT ?? 0) + margeHT
    cumuls.set(cle, cumul)
    return null
  })
  return { ...lecture, lignes: [...cumuls.values()].map((l) => ({ ...l, caHT: arrondi(l.caHT), caTTC: l.caTTC === null ? null : arrondi(l.caTTC), margeHT: l.margeHT === null ? null : arrondi(l.margeHT) })) }
}

export function lireTickets(texte: string): Lecture<TicketsMois> {
  const cumuls = new Map<string, TicketsMois>()
  const lecture = lire(texte, ['code_magasin', 'date', 'univers', 'tickets'], (v, n, erreurs) => {
    const c = communs(v, n, erreurs)
    if (!c) return null
    const tickets = nombre(v.tickets)
    if (tickets === null || Number.isNaN(tickets) || tickets < 0 || !Number.isInteger(tickets)) { erreurs.push(`Ligne ${n} : nombre de tickets « ${v.tickets} » illisible.`); return null }
    const cle = `${c.code}|${c.mois}|${c.univers}`
    const cumul = cumuls.get(cle) ?? { ...c, tickets: 0 }
    cumul.tickets += tickets
    cumuls.set(cle, cumul)
    return null
  })
  return { ...lecture, lignes: [...cumuls.values()] }
}

// Quadrimestres des comptables (format du 28/10/2026, voir docs/import-caisse.md) :
// code_magasin;annee;quadrimestre;achats;variation_stock;charges_externes;impots_taxes;personnel;tresorerie
// Une ligne par magasin et par quadrimestre ; un montant vide reste à saisir.
export interface QuadrimestreLu {
  code: string; annee: number; quadrimestre: 1 | 2 | 3
  achats: number | null; variationStock: number | null; chargesExternes: number | null; impotsTaxes: number | null; personnel: number | null; tresorerie: number | null
}
const COLONNES_QUADRIMESTRE = { achats: 'achats', variationStock: 'variation_stock', chargesExternes: 'charges_externes', impotsTaxes: 'impots_taxes', personnel: 'personnel', tresorerie: 'tresorerie' } as const
export function lireQuadrimestres(texte: string): Lecture<QuadrimestreLu> {
  return lire(texte, ['code_magasin', 'annee', 'quadrimestre', ...Object.values(COLONNES_QUADRIMESTRE)], (v, n, erreurs) => {
    const annee = Number(v.annee), quadrimestre = Number(v.quadrimestre)
    if (!v.code_magasin) { erreurs.push(`Ligne ${n} : code magasin vide.`); return null }
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) { erreurs.push(`Ligne ${n} : année « ${v.annee} » illisible.`); return null }
    if (![1, 2, 3].includes(quadrimestre)) { erreurs.push(`Ligne ${n} : quadrimestre « ${v.quadrimestre} » inconnu (1, 2 ou 3).`); return null }
    const montants = Object.fromEntries(Object.entries(COLONNES_QUADRIMESTRE).map(([cle, col]) => [cle, nombre(v[col])])) as Record<keyof typeof COLONNES_QUADRIMESTRE, number | null>
    if (Object.values(montants).some((m) => Number.isNaN(m))) { erreurs.push(`Ligne ${n} : montant illisible.`); return null }
    if ((['achats', 'chargesExternes', 'impotsTaxes', 'personnel'] as const).some((k) => (montants[k] ?? 0) < 0)) { erreurs.push(`Ligne ${n} : achats et charges attendus en positif.`); return null }
    return { code: v.code_magasin, annee, quadrimestre: quadrimestre as 1 | 2 | 3, ...montants }
  })
}

// Centimes : évite les restes de virgule flottante après des centaines de lignes cumulées
const arrondi = (v: number) => Math.round(v * 100) / 100

// Aperçu avant import : totaux par magasin et par mois, codes caisse sans magasin rattaché
export interface ApercuLigne { magasin: string; mois: string; caHT: number; margeHT: number; tauxMarge: number; tickets: number }
export interface Apercu { lignes: ApercuLigne[]; codesInconnus: string[]; mois: string[] }
export function apercuImport(ventes: VenteMois[], tickets: TicketsMois[], magasinDuCode: Map<string, string>): Apercu {
  const totaux = new Map<string, ApercuLigne>()
  const inconnus = new Set<string>()
  const ligne = (code: string, mois: string) => {
    const magasin = magasinDuCode.get(code)
    if (!magasin) { inconnus.add(code); return null }
    const cle = `${magasin}|${mois}`
    const l = totaux.get(cle) ?? { magasin, mois, caHT: 0, margeHT: 0, tauxMarge: 0, tickets: 0 }
    totaux.set(cle, l)
    return l
  }
  for (const v of ventes) { const l = ligne(v.code, v.mois); if (l) { l.caHT = arrondi(l.caHT + v.caHT); l.margeHT = arrondi(l.margeHT + (v.margeHT ?? 0)) } }
  for (const t of tickets) { const l = ligne(t.code, t.mois); if (l) l.tickets += t.tickets }
  return {
    lignes: [...totaux.values()].map((l) => ({ ...l, tauxMarge: l.caHT ? l.margeHT / l.caHT : 0 })).sort((a, b) => a.magasin.localeCompare(b.magasin, 'fr') || a.mois.localeCompare(b.mois)),
    codesInconnus: [...inconnus].sort(),
    mois: [...new Set([...ventes, ...tickets].map((x) => x.mois))].sort(),
  }
}
