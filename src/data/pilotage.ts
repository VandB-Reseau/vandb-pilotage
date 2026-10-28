import { pilotage } from '../lib/supabase'
import { calculerBudget } from '../moteur/budget'
import { appliquerCibles, type Cibles, type NiveauCibles, type Provenance } from '../moteur/cibles'
import { parametresParDefaut } from '../moteur/parametres'
import type { TicketsMois, VenteMois } from '../import/caisse'
import { baseDepuisReel, fraisDepuisLignes, type LigneFraisMagasin, type ReelAnnees } from '../moteur/atterrissage'
import type { Categorie, ParametresCharges, Personne } from '../moteur/equipe'
import type { LigneReel, TicketsReel } from '../moteur/reel'
import type { MoisReel } from '../moteur/suivi'
import type { Quadrimestre, SaisieQuadrimestre } from '../moteur/quadrimestre'
import type { Hypotheses, ParametresReseau, Univers } from '../moteur/types'

export type Statut = 'propose' | 'en_discussion' | 'valide'
export const statutLibelle: Record<Statut, string> = { propose: 'Proposé par le siège', en_discussion: 'En discussion', valide: 'Validé' }

export interface LigneMagasin {
  magasin: string
  statut: Statut | null
  base: Hypotheses | null        // réalisé du magasin, importé de son prévisionnel
  ajustements: Cibles            // écarts du magasin aux cibles du siège
  figees: Hypotheses | null      // hypothèses enregistrées (celles qui font foi une fois le budget validé)
  groupeId: number | null
  majLe: string | null
}
export interface Groupe { id: number; nom: string; cibles: Cibles | null }
export interface DonneesBudgets { magasins: LigneMagasin[]; reseau: Cibles | null; groupes: Groupe[]; equipes: Record<string, Personne[]>; frais: Record<string, LigneFraisMagasin[]> }

// Les budgets se préparent à partir de septembre pour l'année suivante
export function anneeBudget(aujourdhui = new Date()): number {
  return aujourdhui.getFullYear() + (aujourdhui.getMonth() >= 8 ? 1 : 0)
}

// Contrôle minimal avant de confier des hypothèses enregistrées au moteur de calcul
export function hypothesesValides(x: unknown): x is Hypotheses {
  const h = x as Hypotheses
  return !!h && typeof h === 'object' && Array.isArray(h.familles) && Array.isArray(h.caMensuelReference) && h.caMensuelReference.length === 12
    && Array.isArray(h.frais) && !!h.personnel && Array.isArray(h.personnel.salairesMensuels)
}

export class ErreurChargement extends Error {}

// Lectures gardées une minute : passer d'un onglet ou d'un magasin à l'autre ne recharge rien ;
// toute écriture vide la mémoire, la lecture suivante repart de la base
const memoire = new Map<string, { quand: number; promesse: Promise<unknown> }>()
const DUREE = 60_000
function memo<T>(cle: string, lire: () => Promise<T>): Promise<T> {
  const m = memoire.get(cle)
  if (m && Date.now() - m.quand < DUREE) return m.promesse as Promise<T>
  const promesse = lire()
  memoire.set(cle, { quand: Date.now(), promesse })
  promesse.catch(() => memoire.delete(cle))
  return promesse
}
export function oublier() { memoire.clear() }

const objet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

export const chargerBudgets = (annee: number): Promise<DonneesBudgets> => memo(`budgets|${annee}`, () => lireBudgets(annee))
async function lireBudgets(annee: number): Promise<DonneesBudgets> {
  const [{ data, error }, equipes, frais] = await Promise.all([pilotage().rpc('budgets_du_compte', { p_annee: annee }), chargerEquipes(), chargerFrais()])
  if (error || !objet(data) || !Array.isArray(data.magasins)) throw new ErreurChargement()
  const lignes = data.magasins as { magasin: string; statut: Statut | null; base: unknown; ajustements: unknown; hypotheses: unknown; maj_le: string | null; groupe_id: number | null }[]
  return {
    magasins: lignes.map((l) => ({
      magasin: l.magasin, statut: l.statut,
      base: hypothesesValides(l.base) ? l.base : null,
      ajustements: objet(l.ajustements) ? (l.ajustements as Cibles) : {},
      figees: hypothesesValides(l.hypotheses) ? l.hypotheses : null,
      groupeId: l.groupe_id ?? null, majLe: l.maj_le,
    })),
    reseau: objet(data.reseau) ? (data.reseau as Cibles) : null,
    groupes: Array.isArray(data.groupes) ? (data.groupes as { id: number; nom: string; cibles: unknown }[]).map((g) => ({ id: g.id, nom: g.nom, cibles: objet(g.cibles) ? (g.cibles as Cibles) : null })) : [],
    equipes,
    frais,
  }
}

// Niveaux d'un magasin, du réseau à ses propres ajustements
export function niveauxDe(ligne: LigneMagasin, d: DonneesBudgets, ajustements: Cibles = ligne.ajustements): NiveauCibles[] {
  const groupe = d.groupes.find((g) => g.id === ligne.groupeId)
  return [{ niveau: 'reseau', cibles: d.reseau }, { niveau: 'groupe', cibles: groupe?.cibles }, { niveau: 'magasin', cibles: ajustements }]
}

// Hypothèses qui font foi : figées une fois le budget validé, sinon recalculées avec les cibles du moment
// L'équipe et les frais enregistrés du magasin remplacent ceux de sa base ; un budget validé garde ceux du jour de la validation.
export function avecEquipeEtFrais(base: Hypotheses, equipe: Personne[] | undefined, frais: LigneFraisMagasin[] | undefined): Hypotheses {
  let h = equipe?.length ? { ...base, equipe } : base
  if (frais?.length) { const f = fraisDepuisLignes(frais); h = { ...h, frais: f.frais, ...f.finances } }
  return h
}
// Atterrissage de l'année d'un magasin : réel des mois passés, projection, équipe et frais enregistrés
export function atterrissageDe(reel: ReelAnnees, annee: number, equipe: Personne[] | undefined, frais: LigneFraisMagasin[] | undefined, parametres: ParametresReseau) {
  const r = baseDepuisReel(reel, annee)
  return r ? { ...r, budget: calculerBudget(avecEquipeEtFrais(r.base, equipe, frais), parametres) } : null
}
export function hypothesesDe(ligne: LigneMagasin, d: DonneesBudgets, ajustements?: Cibles): { hypotheses: Hypotheses; provenance: Provenance[] } | null {
  const base = ligne.base ? avecEquipeEtFrais(ligne.base, d.equipes[ligne.magasin], d.frais[ligne.magasin]) : null
  if (base && !(ligne.statut === 'valide' && ligne.figees)) return appliquerCibles(base, niveauxDe(ligne, d, ajustements))
  if (ligne.figees) return { hypotheses: ligne.figees, provenance: ligne.base ? appliquerCibles(ligne.base, niveauxDe(ligne, d, ajustements)).provenance : [] }
  return null
}

export class ErreurEnregistrement extends Error {}
const verifier = ({ error }: { error: unknown }) => { oublier(); if (error) throw new ErreurEnregistrement() }

// Le siège propose : la base importée remet le budget au statut « proposé » (les ajustements du magasin restent)
export async function proposerBudget(magasin: string, annee: number, base: Hypotheses, hypotheses: Hypotheses) {
  verifier(await pilotage().from('budgets').upsert({ store_name: magasin, annee, base, proposition: base, hypotheses, statut: 'propose' }))
}

export async function enregistrerAjustements(magasin: string, annee: number, ajustements: Cibles, hypotheses: Hypotheses) {
  verifier(await pilotage().from('budgets').update({ ajustements, hypotheses }).eq('store_name', magasin).eq('annee', annee))
}

// Directeur : valider fige les hypothèses du moment ; rouvrir remet le budget en discussion
export async function changerStatut(magasin: string, annee: number, statut: Statut, hypotheses: Hypotheses) {
  verifier(await pilotage().from('budgets').update({ statut, hypotheses }).eq('store_name', magasin).eq('annee', annee))
}

export async function enregistrerCiblesReseau(annee: number, valeur: Cibles) {
  verifier(await pilotage().from('cibles_reseau').upsert({ annee, valeur }))
}
export async function enregistrerCiblesGroupe(groupeId: number, annee: number, valeur: Cibles) {
  verifier(await pilotage().from('cibles_groupe').upsert({ groupe_id: groupeId, annee, valeur }))
}
export async function creerGroupe(nom: string): Promise<number> {
  const { data, error } = await pilotage().from('groupes').insert({ nom: nom.trim() }).select('id').single()
  oublier()
  if (error || !data) throw new ErreurEnregistrement()
  return (data as { id: number }).id
}
export async function supprimerGroupe(id: number) {
  verifier(await pilotage().from('groupes').delete().eq('id', id))
}
// Un magasin est dans un groupe au plus ; null le sort de son groupe
export async function rangerMagasin(magasin: string, groupeId: number | null) {
  if (groupeId === null) verifier(await pilotage().from('groupe_magasins').delete().eq('store_name', magasin))
  else verifier(await pilotage().from('groupe_magasins').upsert({ store_name: magasin, groupe_id: groupeId }))
}

// Paramètres de l'année ; une valeur absente reprend celle par défaut
export const chargerParametres = (annee: number): Promise<{ parametres: ParametresReseau; enregistres: boolean }> => memo(`parametres|${annee}`, () => lireParametres(annee))
async function lireParametres(annee: number): Promise<{ parametres: ParametresReseau; enregistres: boolean }> {
  const { data, error } = await pilotage().from('parametres_reseau').select('valeur').eq('annee', annee).maybeSingle()
  if (error) throw new ErreurChargement()
  const v = (data?.valeur ?? {}) as Partial<ParametresReseau>
  return {
    parametres: {
      ...parametresParDefaut, ...v,
      impot: { ...parametresParDefaut.impot, ...v.impot },
      tvaPanier: { ...parametresParDefaut.tvaPanier, ...v.tvaPanier },
      tresorerie: {
        ...parametresParDefaut.tresorerie, ...v.tresorerie,
        consignes: { ...parametresParDefaut.tresorerie.consignes!, ...v.tresorerie?.consignes },
      },
      charges: {
        taux: { ...parametresParDefaut.charges.taux, ...v.charges?.taux },
        reduction: { ...parametresParDefaut.charges.reduction, ...v.charges?.reduction },
      },
    },
    enregistres: !!data,
  }
}

// Valeur de chaque hypothèse sans aucune cible : le réalisé du magasin (sa marge, l'évolution de ses tickets)
export function valeursSansCible(base: Hypotheses): Record<string, number> {
  return Object.fromEntries(appliquerCibles(base, []).provenance.map((p) => [p.cle, p.valeur]))
}

// Total des budgets d'un ensemble de magasins (réseau ou groupe), avec les cibles données
export function consoliderBudgets(d: DonneesBudgets, parametres: ParametresReseau, magasins: string[]): { ca: number; ebe: number; n: number } {
  let ca = 0, ebe = 0, n = 0
  for (const l of d.magasins) {
    if (!magasins.includes(l.magasin)) continue
    const h = hypothesesDe(l, d)
    if (!h) continue
    const b = calculerBudget(h.hypotheses, parametres)
    ca += b.ca
    ebe += b.ebe
    n++
  }
  return { ca, ebe, n }
}

// ── Réel de l'année (lot 2)
const deux = (n: number) => String(n).padStart(2, '0')
const premierDuMois = (annee: number, mois: number) => `${annee}-${deux(mois)}-01`

export interface ReelMagasin { lignes: LigneReel[]; tickets: TicketsReel[] }

export const chargerReel = (magasin: string, annee: number): Promise<ReelMagasin> => memo(`reel|${magasin}|${annee}`, () => lireReel(magasin, annee))
async function lireReel(magasin: string, annee: number): Promise<ReelMagasin> {
  const [v, t] = await Promise.all([
    pilotage().from('reel_mensuel').select('mois, univers, famille, ca_ht, ca_ttc, marge_ht')
      .eq('store_name', magasin).gte('mois', premierDuMois(annee, 1)).lte('mois', premierDuMois(annee, 12)),
    pilotage().from('reel_tickets').select('mois, univers, tickets')
      .eq('store_name', magasin).gte('mois', premierDuMois(annee, 1)).lte('mois', premierDuMois(annee, 12)),
  ])
  if (v.error || t.error) throw new ErreurChargement()
  const mois = (d: string) => Number(d.slice(5, 7))
  const num = (x: unknown) => (x === null || x === undefined ? null : Number(x))
  return {
    lignes: (v.data ?? []).map((l) => ({ mois: mois(l.mois), univers: l.univers as Univers, famille: l.famille, caHT: Number(l.ca_ht), caTTC: num(l.ca_ttc), margeHT: num(l.marge_ht) })),
    tickets: (t.data ?? []).map((l) => ({ mois: mois(l.mois), univers: l.univers as Univers, tickets: Number(l.tickets) })),
  }
}

// Remplace un mois d'un magasin par ce qui a été saisi ; un mois vidé est effacé
export async function enregistrerMoisReel(magasin: string, annee: number, mois: number, lignes: Omit<LigneReel, 'mois'>[], tickets: Omit<TicketsReel, 'mois'>[]) {
  const date = premierDuMois(annee, mois)
  const ventes = lignes.map((l) => ({ store_name: magasin, mois: date, univers: l.univers, famille: l.famille, ca_ht: l.caHT, ca_ttc: l.caTTC, marge_ht: l.margeHT }))
  const t = tickets.map((l) => ({ store_name: magasin, mois: date, univers: l.univers, tickets: l.tickets }))
  if (!ventes.length) verifier(await pilotage().from('reel_mensuel').delete().eq('store_name', magasin).eq('mois', date))
  if (!t.length) verifier(await pilotage().from('reel_tickets').delete().eq('store_name', magasin).eq('mois', date))
  if (ventes.length || t.length) verifier(await pilotage().rpc('remplacer_reel', { p_ventes: ventes, p_tickets: t }))
}

// Réel de tous les magasins du compte, totalisé par mois dans la base (vue réseau) : année demandée et précédente.
// Coach de chaque magasin pour le Directeur et le RR, RR de chaque magasin pour le Directeur seul.
export interface ReelDuCompte { magasins: Record<string, { n: MoisReel[]; n1: MoisReel[] }>; coachs: Record<string, string>; rrs: Record<string, string[]> }
export const chargerReelDuCompte = (annee: number): Promise<ReelDuCompte> => memo(`reel-compte|${annee}`, () => lireReelDuCompte(annee))
async function lireReelDuCompte(annee: number): Promise<ReelDuCompte> {
  const { data, error } = await pilotage().rpc('reel_du_compte', { p_annee: annee })
  if (error || !objet(data) || !Array.isArray(data.mois)) throw new ErreurChargement()
  const douze = () => Array.from({ length: 12 }, () => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))
  const magasins: ReelDuCompte['magasins'] = {}
  for (const l of data.mois as { magasin: string; mois: string; ca: unknown; marge: unknown; ca_marge: unknown; ttc: unknown; tickets: unknown }[]) {
    const a = Number(l.mois.slice(0, 4)), m = Number(l.mois.slice(5, 7))
    if ((a !== annee && a !== annee - 1) || m < 1 || m > 12) continue
    const r = (magasins[l.magasin] ??= { n: douze(), n1: douze() })
    r[a === annee ? 'n' : 'n1'][m - 1] = { caHT: Number(l.ca), margeHT: Number(l.marge), caAvecMarge: Number(l.ca_marge), caTTC: Number(l.ttc), tickets: Number(l.tickets) }
  }
  const rrs: ReelDuCompte['rrs'] = {}
  if (objet(data.rrs)) for (const [m, noms] of Object.entries(data.rrs)) if (Array.isArray(noms)) rrs[m] = noms.filter((x): x is string => typeof x === 'string' && x !== '')
  return { magasins, coachs: objet(data.coachs) ? (data.coachs as Record<string, string>) : {}, rrs }
}

export interface CodeCaisse { code: string; magasin: string }
export async function chargerCodes(): Promise<CodeCaisse[]> {
  const { data, error } = await pilotage().from('codes_caisse').select('code, store_name').order('code')
  if (error) throw new ErreurChargement()
  return (data ?? []).map((c) => ({ code: c.code, magasin: c.store_name }))
}
export async function enregistrerCode(code: string, magasin: string) {
  verifier(await pilotage().from('codes_caisse').upsert({ code: code.trim(), store_name: magasin }))
}
export async function supprimerCode(code: string) {
  verifier(await pilotage().from('codes_caisse').delete().eq('code', code))
}

// Import des fichiers de la DSI, mois par mois (chaque mois est remplacé d'un bloc) ; les codes inconnus sont écartés
export async function importerReel(ventes: VenteMois[], tickets: TicketsMois[], codes: CodeCaisse[]): Promise<{ mois: string[]; magasins: number }> {
  const nom = new Map(codes.map((c) => [c.code, c.magasin]))
  const parMois = new Map<string, { v: object[]; t: object[] }>()
  const magasins = new Set<string>()
  const bloc = (m: string) => { const b = parMois.get(m) ?? { v: [], t: [] }; parMois.set(m, b); return b }
  for (const l of ventes) {
    const m = nom.get(l.code)
    if (!m) continue
    magasins.add(m)
    bloc(l.mois).v.push({ store_name: m, mois: `${l.mois}-01`, univers: l.univers, famille: l.famille, ca_ht: l.caHT, ca_ttc: l.caTTC, marge_ht: l.margeHT })
  }
  for (const l of tickets) {
    const m = nom.get(l.code)
    if (!m) continue
    magasins.add(m)
    bloc(l.mois).t.push({ store_name: m, mois: `${l.mois}-01`, univers: l.univers, tickets: l.tickets })
  }
  const mois = [...parMois.keys()].sort()
  for (const m of mois) {
    const b = parMois.get(m)!
    verifier(await pilotage().rpc('remplacer_reel', { p_ventes: b.v, p_tickets: b.t }))
  }
  return { mois, magasins: magasins.size }
}

export async function enregistrerParametres(annee: number, parametres: ParametresReseau) {
  verifier(await pilotage().from('parametres_reseau').upsert({ annee, valeur: parametres }))
}
export type { ParametresCharges }

// ── Équipe (lot 3)
interface LigneEquipe { id: number; store_name: string; poste: string; categorie: Categorie; heures_hebdo: number; brut_mensuel: number; primes: unknown; entree: string | null; sortie: string | null }
const versPersonne = (l: LigneEquipe): Personne => ({
  id: l.id, poste: l.poste, categorie: l.categorie, heuresHebdo: Number(l.heures_hebdo), brutMensuel: Number(l.brut_mensuel),
  primes: Array.isArray(l.primes) ? (l.primes as { mois: number; montant: number }[]).map((x) => ({ mois: Number(x.mois), montant: Number(x.montant) })) : [],
  entree: l.entree?.slice(0, 7) ?? null, sortie: l.sortie?.slice(0, 7) ?? null,
})

// Toutes les lignes d'une table, par pages : l'API renvoie au plus 1 000 lignes par appel
const PAGE = 1000
async function toutesLesLignes<T>(page: (de: number, a: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const lignes: T[] = []
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await page(de, de + PAGE - 1)
    if (error) throw new ErreurChargement()
    lignes.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return lignes
  }
}

// Équipes de tous les magasins du compte (la base ne renvoie que ceux de son périmètre)
export async function chargerEquipes(): Promise<Record<string, Personne[]>> {
  const lignes = await toutesLesLignes<LigneEquipe>((de, a) =>
    pilotage().from('equipe').select('id, store_name, poste, categorie, heures_hebdo, brut_mensuel, primes, entree, sortie').order('id').range(de, a))
  const r: Record<string, Personne[]> = {}
  for (const l of lignes) (r[l.store_name] ??= []).push(versPersonne(l))
  return r
}

export async function enregistrerPersonne(magasin: string, p: Personne) {
  const ligne = {
    store_name: magasin, poste: p.poste.trim(), categorie: p.categorie, heures_hebdo: p.heuresHebdo, brut_mensuel: p.brutMensuel, primes: p.primes,
    entree: p.entree ? `${p.entree}-01` : null, sortie: p.sortie ? `${p.sortie}-01` : null,
  }
  if (p.id) verifier(await pilotage().from('equipe').update(ligne).eq('id', p.id))
  else verifier(await pilotage().from('equipe').insert(ligne))
}
export async function supprimerPersonne(id: number) {
  verifier(await pilotage().from('equipe').delete().eq('id', id))
}

// ── Frais (lot 4)
export async function chargerFrais(): Promise<Record<string, LigneFraisMagasin[]>> {
  const lignes = await toutesLesLignes<{ store_name: string; code: string; libelle: string; rubrique: string; annuel: unknown; taux_ca: unknown }>((de, a) =>
    pilotage().from('frais').select('store_name, code, libelle, rubrique, annuel, taux_ca').order('store_name').order('code').range(de, a))
  const r: Record<string, LigneFraisMagasin[]> = {}
  const num = (x: unknown) => (x === null || x === undefined ? null : Number(x))
  for (const l of lignes) {
    (r[l.store_name] ??= []).push({ code: l.code, libelle: l.libelle, rubrique: l.rubrique, annuel: num(l.annuel), tauxCA: num(l.taux_ca) })
  }
  return r
}

// Enregistre les lignes du magasin et retire celles qui n'y sont plus
export async function enregistrerFrais(magasin: string, lignes: LigneFraisMagasin[], retirees: string[]) {
  if (lignes.length) {
    verifier(await pilotage().from('frais').upsert(lignes.map((l) => ({
      store_name: magasin, code: l.code, libelle: l.libelle, rubrique: l.rubrique, annuel: l.tauxCA === null ? l.annuel ?? 0 : null, taux_ca: l.tauxCA,
    }))))
  }
  if (retirees.length) verifier(await pilotage().from('frais').delete().eq('store_name', magasin).in('code', retirees))
}

// ── Quadrimestres (lot 12) : montants comptables agrégés de chaque magasin du compte pour une année
export type SaisiesQuadrimestres = Record<string, Partial<Record<Quadrimestre, SaisieQuadrimestre>>>
type LigneQuadrimestre = { store_name: string; quadrimestre: number; achats: unknown; variation_stock: unknown; charges_externes: unknown; impots_taxes: unknown; personnel: unknown; tresorerie: unknown }
export const chargerQuadrimestres = (annee: number): Promise<SaisiesQuadrimestres> => memo(`quadrimestres|${annee}`, async () => {
  const lignes = await toutesLesLignes<LigneQuadrimestre>((de, a) =>
    pilotage().from('quadrimestres').select('store_name, quadrimestre, achats, variation_stock, charges_externes, impots_taxes, personnel, tresorerie')
      .eq('annee', annee).order('store_name').order('quadrimestre').range(de, a))
  const num = (x: unknown) => (x === null || x === undefined ? null : Number(x))
  const r: SaisiesQuadrimestres = {}
  for (const l of lignes) {
    if (![1, 2, 3].includes(l.quadrimestre)) continue
    (r[l.store_name] ??= {})[l.quadrimestre as Quadrimestre] = {
      achats: num(l.achats), variationStock: num(l.variation_stock), chargesExternes: num(l.charges_externes),
      impotsTaxes: num(l.impots_taxes), personnel: num(l.personnel), tresorerie: num(l.tresorerie),
    }
  }
  return r
})

const ligneQuadrimestre = (magasin: string, annee: number, q: Quadrimestre, s: SaisieQuadrimestre) => ({
  store_name: magasin, annee, quadrimestre: q, achats: s.achats, variation_stock: s.variationStock, charges_externes: s.chargesExternes,
  impots_taxes: s.impotsTaxes, personnel: s.personnel, tresorerie: s.tresorerie,
})
export async function enregistrerQuadrimestres(magasin: string, annee: number, saisies: Partial<Record<Quadrimestre, SaisieQuadrimestre>>) {
  const lignes = Object.entries(saisies).map(([q, s]) => ligneQuadrimestre(magasin, annee, Number(q) as Quadrimestre, s!))
  if (lignes.length) verifier(await pilotage().from('quadrimestres').upsert(lignes))
}
// Import d'un fichier : plusieurs magasins d'un bloc
export async function importerQuadrimestres(lignes: { magasin: string; annee: number; quadrimestre: Quadrimestre; saisie: SaisieQuadrimestre }[]) {
  for (let i = 0; i < lignes.length; i += 500) {
    verifier(await pilotage().from('quadrimestres').upsert(lignes.slice(i, i + 500).map((l) => ligneQuadrimestre(l.magasin, l.annee, l.quadrimestre, l.saisie))))
  }
}
