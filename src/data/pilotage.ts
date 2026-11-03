import type { RubriqueFEC } from '../moteur/fec'
import type { Role } from '../auth/roles'
import { pilotage } from '../lib/supabase'
import { annees, anneeSuivi } from './annees'
import { calculerBudget } from '../moteur/budget'
import { appliquerCibles, niveauxReseau, type Cibles, type NiveauCibles, type Provenance } from '../moteur/cibles'
import { trancheMillesime, type Ouverture } from '../moteur/projection'
import { alignerSurGrille, completerGrille, grilleDe, lignesFrais, parametresParDefaut } from '../moteur/parametres'
import { reglesDe, reglesParDefaut } from '../moteur/regles'
import type { TicketsMois, VenteMois } from '../import/caisse'
import { autresInterets, baseDepuisReel, fraisDepuisLignes, saisonnaliteMediane, type LigneFraisMagasin, type ReelAnnees, type SecoursAtterrissage } from '../moteur/atterrissage'
import type { Categorie, ParametresCharges, Personne } from '../moteur/equipe'
import type { LigneReel, TicketsReel } from '../moteur/reel'
import { NON_DETAILLE, repartirNonDetaille } from '../moteur/repartition'
import type { MoisReel } from '../moteur/suivi'
import { alertesMagasin, mesuresMagasin, trierAlertes, type Alerte, type EntreeAlertes, type Mesure, type TypeAction, type TypeAlerte } from '../moteur/alertes'
import { ratiosDuBudget, ratiosDuReel, type Ratios } from '../moteur/comparaison'
import { ligneReseau } from '../moteur/suivi'
import { QUADRIMESTRES, type Quadrimestre, type SaisieQuadrimestre } from '../moteur/quadrimestre'
import { tresorerieBudget } from '../moteur/tresorerie'
import type { StockSaisi } from '../moteur/stock'
import { actionSerie, ecartAtterrissage, type Action as ActionSerie, type EtatFiche } from '../moteur/preparation'
import { syntheseReel } from '../moteur/reel'
import { reelEnRetard } from '../lib/aFaire'
import type { Famille, Hypotheses, ParametresReseau, Pret, Univers } from '../moteur/types'
import { avecPrets } from '../moteur/financement'
import { avecReprise, comptesAnnee, tresorerieDepartEstimee, type ComptesAnnee, type DepartEstime } from '../moteur/reprise'

export type Statut = 'propose' | 'en_discussion' | 'valide'
export const statutLibelle: Record<Statut, string> = { propose: 'Proposé par le siège', en_discussion: 'En discussion', valide: 'Validé' }

export interface LigneMagasin {
  magasin: string
  statut: Statut | null
  base: Hypotheses | null        // réalisé du magasin, importé de son prévisionnel
  ajustements: Cibles            // écarts du magasin aux cibles du siège
  figees: Hypotheses | null      // hypothèses enregistrées (celles qui font foi une fois le budget validé)
  parametres?: Partial<ParametresReseau> | null // paramètres réseau copiés à la validation (lot 38, migration 0020)
  groupeId: number | null
  majLe: string | null
  // Lot 41 (migration 0022) : position du siège (ajustements écrits en dernier par le Directeur) et date du dernier envoi
  // du franchisé ; absentes avant la migration
  siege?: Cibles | null
  envoyeLe?: string | null
}
export interface Groupe { id: number; nom: string; cibles: Cibles | null }
export interface DonneesBudgets {
  annee?: number                       // année des budgets
  magasins: LigneMagasin[]; reseau: Cibles | null; groupes: Groupe[]; equipes: Record<string, Personne[]>; frais: Record<string, LigneFraisMagasin[]>
  ouvertures?: Record<string, Ouverture> // date d'ouverture des magasins (lot 24)
  comptes?: Record<string, ComptesAnnee> // lot 42 : comptes de l'année d'avant celle des budgets (reprise, trésorerie de départ)
  prets?: Record<string, Pret[]>        // prêts du magasin (migration 0026)
}

// Année de l'onglet Budget : la campagne ouverte par le Directeur, sinon le budget de l'année suivie (migration 0027) ;
// sans années enregistrées, l'ancienne règle du calendrier (l'année suivante à partir de septembre)
export function anneeBudget(): number {
  return annees().budget
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
  const [{ data, error }, equipes, fraisEnregistres, ouvertures, comptes, { parametres }, prets] = await Promise.all([
    pilotage().rpc('budgets_du_compte', { p_annee: annee }), chargerEquipes(), chargerFrais(), chargerOuvertures(), chargerComptes(annee - 1), chargerParametres(annee),
    chargerPrets().catch(() => ({} as Record<string, Pret[]>)),
  ])
  // Lot 40 : les lignes de frais prennent le libellé et le thème de la grille de l'année
  const grille = grilleDe(parametres)
  const frais = Object.fromEntries(Object.entries(fraisEnregistres).map(([m, l]) => [m, alignerSurGrille(l, grille)]))
  if (error || !objet(data) || !Array.isArray(data.magasins)) throw new ErreurChargement()
  const lignes = data.magasins as { magasin: string; statut: Statut | null; base: unknown; ajustements: unknown; hypotheses: unknown; maj_le: string | null; groupe_id: number | null; parametres?: unknown; ajustements_siege?: unknown; envoye_le?: string | null }[]
  return {
    annee, ouvertures,
    magasins: lignes.map((l) => ({
      magasin: l.magasin, statut: l.statut,
      base: hypothesesValides(l.base) ? l.base : null,
      ajustements: objet(l.ajustements) ? (l.ajustements as Cibles) : {},
      figees: hypothesesValides(l.hypotheses) ? l.hypotheses : null,
      parametres: l.statut === 'valide' && objet(l.parametres) ? (l.parametres as Partial<ParametresReseau>) : null,
      groupeId: l.groupe_id ?? null, majLe: l.maj_le,
      siege: objet(l.ajustements_siege) ? (l.ajustements_siege as Cibles) : null, envoyeLe: l.envoye_le ?? null,
    })),
    reseau: objet(data.reseau) ? (data.reseau as Cibles) : null,
    groupes: Array.isArray(data.groupes) ? (data.groupes as { id: number; nom: string; cibles: unknown }[]).map((g) => ({ id: g.id, nom: g.nom, cibles: objet(g.cibles) ? (g.cibles as Cibles) : null })) : [],
    equipes,
    frais,
    comptes,
    prets,
  }
}

// Lot 42 : comptes des quadrimestres de l'année, prêts pour la reprise ; sans eux (ou sans accès), le budget fait sans
async function chargerComptes(annee: number): Promise<Record<string, ComptesAnnee>> {
  try {
    const [saisies, { parametres }] = await Promise.all([chargerQuadrimestres(annee), chargerParametres(annee)])
    const taux = parametres.tauxRedevance + parametres.tauxPublicite
    return Object.fromEntries(Object.entries(saisies).flatMap(([m, s]) => { const c = comptesAnnee(annee, s, taux); return c ? [[m, c]] : [] }))
  } catch {
    return {}
  }
}

// Niveaux d'un magasin, du réseau (hausse tarifaire, réseau, ancienneté du magasin) à ses propres ajustements
export function niveauxDe(ligne: LigneMagasin, d: DonneesBudgets, ajustements: Cibles = ligne.ajustements): NiveauCibles[] {
  const groupe = d.groupes.find((g) => g.id === ligne.groupeId)
  const tranche = d.annee ? trancheMillesime(d.ouvertures?.[ligne.magasin], d.annee) : null
  return [...niveauxReseau(d.reseau, tranche), { niveau: 'groupe', cibles: groupe?.cibles }, { niveau: 'magasin', cibles: ajustements }]
}

// Hypothèses qui font foi : figées une fois le budget validé, sinon recalculées avec les cibles du moment
// L'équipe et les frais enregistrés du magasin remplacent ceux de sa base ; un budget validé garde ceux du jour de la validation.
export function avecEquipeEtFrais(base: Hypotheses, equipe: Personne[] | undefined, frais: LigneFraisMagasin[] | undefined, comptes?: ComptesAnnee | null, prets?: Pret[]): Hypotheses {
  // Lot 42 : faute d'équipe ou de frais saisis, ceux des comptes de l'année en cours
  let h = comptes ? avecReprise(base, comptes, { equipe: !!equipe?.length, frais: !!frais?.length }) : base
  h = equipe?.length ? { ...h, equipe } : h
  if (frais?.length) { const f = fraisDepuisLignes(frais); h = { ...h, frais: f.frais, ...f.finances } }
  // Joseph (03/11/2026) : les prêts du magasin remplacent intérêts d'emprunts et capital des frais, pour toute année
  return avecPrets(h, prets, autresInterets(frais))
}
// Atterrissage de l'année d'un magasin : réel des mois passés, projection, équipe et frais enregistrés
export function atterrissageDe(reel: ReelAnnees, annee: number, equipe: Personne[] | undefined, frais: LigneFraisMagasin[] | undefined, parametres: ParametresReseau, secours?: SecoursAtterrissage, prets?: Pret[]) {
  const r = baseDepuisReel(reel, annee, [], undefined, secours, reglesDe(parametres))
  if (!r) return null
  const hypotheses = avecEquipeEtFrais(r.base, equipe, frais, undefined, prets)
  return { ...r, hypotheses, budget: calculerBudget(hypotheses, parametres) }
}
export function hypothesesDe(ligne: LigneMagasin, d: DonneesBudgets, ajustements?: Cibles): { hypotheses: Hypotheses; provenance: Provenance[] } | null {
  const base = ligne.base ? avecEquipeEtFrais(ligne.base, d.equipes[ligne.magasin], d.frais[ligne.magasin], d.comptes?.[ligne.magasin], d.prets?.[ligne.magasin]) : null
  if (base && !(ligne.statut === 'valide' && ligne.figees)) return appliquerCibles(base, niveauxDe(ligne, d, ajustements))
  if (ligne.figees) return { hypotheses: ligne.figees, provenance: ligne.base ? appliquerCibles(ligne.base, niveauxDe(ligne, d, ajustements)).provenance : [] }
  return null
}

// Lot 42 (proposition 5) : trésorerie au 1er janvier estimée tant que le magasin n'a pas saisi la sienne
export function departEstime(ligne: LigneMagasin, d: DonneesBudgets, parametres: ParametresReseau): DepartEstime | null {
  if (!ligne.base || ligne.ajustements.tresorerieDepart !== undefined) return null
  if (ligne.statut === 'valide' && ligne.figees) return ligne.figees.departEstime ?? null
  const comptes = d.comptes?.[ligne.magasin]
  return tresorerieDepartEstimee(avecEquipeEtFrais(ligne.base, d.equipes[ligne.magasin], d.frais[ligne.magasin], comptes, d.prets?.[ligne.magasin]), comptes, parametres)
}
export const departTresorerie = (ligne: LigneMagasin, d: DonneesBudgets, parametres: ParametresReseau): number | undefined =>
  ligne.ajustements.tresorerieDepart ?? departEstime(ligne, d, parametres)?.montant

// Lot 41, proposition 1 : la proposition d'un magasin préparée pour la proposition en série, comme le bouton « Proposer »
// du point de départ (même base, mêmes cibles), avec ce qu'il faut pour choisir : CA atterri, EBE proposé, fiche, écart
// à la proposition en cours. null : pas de réel de l'année en cours.
export interface Preparation {
  magasin: string; statut: Statut | null
  base: Hypotheses; hypotheses: Hypotheses
  caAtterri: number; ebe: number; etat: EtatFiche
  ecart: number | null; action: ActionSerie; coche: boolean
}
export async function preparerProposition(ligne: LigneMagasin, d: DonneesBudgets, anneeEnCours: number, anneeProposee: number, parametres: ParametresReseau): Promise<Preparation | null> {
  const magasin = ligne.magasin
  const [n, n1, secours] = await Promise.all([chargerReel(magasin, anneeEnCours), chargerReel(magasin, anneeEnCours - 1), chargerSecours(magasin, anneeEnCours)])
  // Comme le bouton « Proposer » de l'atterrissage : les mois restants suivent la répartition saisie du magasin
  const r = baseDepuisReel({ n, n1 }, anneeEnCours, [], undefined, { ...secours, repartition: ligne.ajustements.poidsMois }, reglesDe(parametres))
  if (!r) return null
  const equipe = d.equipes[magasin], frais = d.frais[magasin]
  const base = { ...avecEquipeEtFrais(r.base, undefined, frais), annee: anneeProposee }
  const comptes = d.comptes?.[magasin]
  const { hypotheses } = appliquerCibles(avecEquipeEtFrais(base, equipe, frais, comptes, d.prets?.[magasin]), niveauxDe(ligne, d))
  const caAtterri = calculerBudget(avecEquipeEtFrais(base, equipe, frais), parametres).atterrissage
  const avant = ligne.base ? calculerBudget(avecEquipeEtFrais(ligne.base, equipe, frais), parametres).atterrissage : null
  const etat: EtatFiche = { reel: !reelEnRetard(syntheseReel(n.lignes, n.tickets).moisRenseignes), ouverture: !!(secours.ouverture ?? d.ouvertures?.[magasin]), equipe: !!equipe?.length || !!hypotheses.reprise?.personnel, frais: !!frais?.length || !!hypotheses.reprise?.frais }
  const ecart = ligne.base ? ecartAtterrissage(avant, caAtterri) : null
  return { magasin, statut: ligne.statut, base, hypotheses, caAtterri, ebe: calculerBudget(hypotheses, parametres).ebe, etat, ecart, ...(() => { const a = actionSerie(ligne.statut, ecart, etat); return { action: a.action, coche: a.coche } })() }
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

// Lot 41 : le franchisé envoie ses ajustements au siège ; c'est ce geste, et non plus chaque enregistrement, qui met le
// budget en discussion. Avant la migration 0022 (pas de colonne envoye_le), la base met d'elle-même le budget en discussion.
export async function envoyerAuSiege(magasin: string, annee: number) {
  const r = await pilotage().from('budgets').update({ statut: 'en_discussion', envoye_le: new Date().toISOString() }).eq('store_name', magasin).eq('annee', annee)
  if (!r.error) { oublier(); return }
  verifier(await pilotage().from('budgets').update({ statut: 'en_discussion' }).eq('store_name', magasin).eq('annee', annee))
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
  return { parametres: completerParametres((data?.valeur ?? {}) as Partial<ParametresReseau>), enregistres: !!data }
}

// Paramètres enregistrés complétés par les valeurs par défaut (une valeur absente reprend celle par défaut)
export function completerParametres(v: Partial<ParametresReseau>): ParametresReseau {
  return {
    ...parametresParDefaut, ...v,
    regles: reglesDe(v),
    grilleFrais: completerGrille(v.grilleFrais),
    impot: { ...parametresParDefaut.impot, ...v.impot },
    tvaPanier: { ...parametresParDefaut.tvaPanier, ...v.tvaPanier },
    tresorerie: {
      ...parametresParDefaut.tresorerie, ...v.tresorerie,
      consignes: { ...parametresParDefaut.tresorerie.consignes!, ...v.tresorerie?.consignes },
      stock: { ...parametresParDefaut.tresorerie.stock!, ...v.tresorerie?.stock, mois: { ...parametresParDefaut.tresorerie.stock!.mois, ...v.tresorerie?.stock?.mois } },
    },
    alertes: { ...parametresParDefaut.alertes, ...v.alertes },
    charges: {
      taux: { ...parametresParDefaut.charges.taux, ...v.charges?.taux },
      reduction: { ...parametresParDefaut.charges.reduction, ...v.charges?.reduction },
    },
  }
}

// Lot 38 : un budget validé se calcule avec les paramètres du jour de sa validation ; les autres avec ceux du moment
export function parametresDuBudget(ligne: Pick<LigneMagasin, 'statut' | 'parametres'> | null | undefined, parametres: ParametresReseau): ParametresReseau {
  return ligne?.statut === 'valide' && ligne.parametres ? completerParametres(ligne.parametres) : parametres
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
    const b = calculerBudget(h.hypotheses, parametresDuBudget(l, parametres))
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
// Un mois saisi par univers seulement (ligne « Non détaillé ») est réparti sur les familles à la lecture, avec l'an
// dernier pour référence (03/11/2026)
async function lireReel(magasin: string, annee: number): Promise<ReelMagasin> {
  const brut = await chargerReelBrut(magasin, annee)
  if (!brut.lignes.some((l) => l.famille === NON_DETAILLE)) return brut
  const n1 = await chargerReelBrut(magasin, annee - 1).catch(() => null)
  return { ...brut, lignes: repartirNonDetaille(brut.lignes, n1?.lignes ?? [], annee - 1) }
}
// Réel tel qu'enregistré, sans répartition (référence de la saisie par univers)
export const chargerReelBrut = (magasin: string, annee: number): Promise<ReelMagasin> => memo(`reel-brut|${magasin}|${annee}`, () => lireReelBrut(magasin, annee))
async function lireReelBrut(magasin: string, annee: number): Promise<ReelMagasin> {
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
  const douze = (): MoisReel[] => Array.from({ length: 12 }, () => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))
  const magasins: ReelDuCompte['magasins'] = {}
  type Ligne = { magasin: string; mois: string; ca: unknown; marge: unknown; ca_marge: unknown; ttc: unknown; tickets: unknown; ttc_cave?: unknown; ttc_bar?: unknown; tickets_cave?: unknown; tickets_bar?: unknown }
  for (const l of data.mois as Ligne[]) {
    const a = Number(l.mois.slice(0, 4)), m = Number(l.mois.slice(5, 7))
    if ((a !== annee && a !== annee - 1) || m < 1 || m > 12) continue
    const r = (magasins[l.magasin] ??= { n: douze(), n1: douze() })
    r[a === annee ? 'n' : 'n1'][m - 1] = { caHT: Number(l.ca), margeHT: Number(l.marge), caAvecMarge: Number(l.ca_marge), caTTC: Number(l.ttc), tickets: Number(l.tickets),
      // Sans le script 0013, la base ne sépare pas encore la Cave et le Bar
      ...(l.tickets_cave === undefined ? {} : {
        univers: { cave: { caTTC: Number(l.ttc_cave), tickets: Number(l.tickets_cave) }, bar: { caTTC: Number(l.ttc_bar), tickets: Number(l.tickets_bar) } },
      }),
    }
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

// Lot 40 : la grille des frais et les règles de calcul ne s'enregistrent que si elles diffèrent des valeurs par défaut
// (une grille par défaut reste vivante : une ligne ajoutée au code apparaît ; le journal ne note que les vrais changements)
export async function enregistrerParametres(annee: number, parametres: ParametresReseau) {
  const { grilleFrais, regles, ...reste } = parametres
  const valeur: Partial<ParametresReseau> = {
    ...reste,
    ...(grilleFrais && JSON.stringify(completerGrille(grilleFrais)) !== JSON.stringify(lignesFrais) ? { grilleFrais } : {}),
    ...(regles && JSON.stringify(reglesDe({ regles })) !== JSON.stringify(reglesParDefaut) ? { regles } : {}),
  }
  verifier(await pilotage().from('parametres_reseau').upsert({ annee, valeur }))
}
export type { ParametresCharges }

// ── Paramétrage depuis l'app (lot 39) : journal des changements, contrôle de gestion, copie d'une année sur l'autre
export interface ChangementParametre { id: number; annee: number; rubrique: string; avant: unknown; apres: unknown; par: string | null; le: string }
export async function chargerJournal(annee: number): Promise<ChangementParametre[]> {
  const { data, error } = await pilotage().from('journal_parametres').select('id, annee, rubrique, avant, apres, par_email, le')
    .eq('annee', annee).order('le', { ascending: false }).limit(200)
  if (error) throw new ErreurChargement()
  return ((data ?? []) as { id: number; annee: number; rubrique: string; avant: unknown; apres: unknown; par_email: string | null; le: string }[])
    .map((l) => ({ id: l.id, annee: l.annee, rubrique: l.rubrique, avant: l.avant, apres: l.apres, par: l.par_email, le: l.le }))
}
export interface CompteControleGestion { userId: string; email: string; ajouteLe: string }
export async function chargerControleGestion(): Promise<CompteControleGestion[]> {
  const { data, error } = await pilotage().from('controle_gestion').select('user_id, email, ajoute_le').order('email')
  if (error) throw new ErreurChargement()
  return ((data ?? []) as { user_id: string; email: string; ajoute_le: string }[]).map((l) => ({ userId: l.user_id, email: l.email, ajouteLe: l.ajoute_le }))
}
// Faux : aucun compte de connexion avec cet email
export async function ajouterControleGestion(email: string): Promise<boolean> {
  const { data, error } = await pilotage().rpc('ajouter_controle_gestion', { p_email: email })
  oublier()
  if (error) throw new ErreurEnregistrement()
  return data === true
}
export async function retirerControleGestion(userId: string) {
  verifier(await pilotage().from('controle_gestion').delete().eq('user_id', userId))
}
// Copie les paramètres d'une année sur une autre (écrase ceux de l'année cible). Les dates de campagne, propres à
// chaque année, ne sont pas copiées : l'année cible reprend les dates par défaut.
export async function copierParametres(de: number, vers: number) {
  const { parametres } = await chargerParametres(de)
  const { campagne: _dates, ...reste } = parametres // eslint-disable-line @typescript-eslint/no-unused-vars
  await enregistrerParametres(vers, reste as ParametresReseau)
}

// ── Équipe (lot 3)
interface LigneEquipe { id: number; store_name: string; poste: string; categorie: Categorie; heures_hebdo: number; brut_mensuel: number; primes: unknown; entree: string | null; sortie: string | null; heures_saisie?: string | null; enveloppe?: boolean | null; taux_horaire?: number | null; hausses?: unknown }
const versPersonne = (l: LigneEquipe): Personne => ({
  id: l.id, poste: l.poste, categorie: l.categorie, heuresHebdo: Number(l.heures_hebdo), brutMensuel: Number(l.brut_mensuel),
  primes: Array.isArray(l.primes) ? (l.primes as { mois: number; montant: number }[]).map((x) => ({ mois: Number(x.mois), montant: Number(x.montant) })) : [],
  entree: l.entree?.slice(0, 7) ?? null, sortie: l.sortie?.slice(0, 7) ?? null,
  ...(l.heures_saisie === 'mois' ? { heuresSaisie: 'mois' as const } : {}),
  ...(l.enveloppe ? { enveloppe: true } : {}),
  ...(l.taux_horaire ? { tauxHoraire: Number(l.taux_horaire) } : {}),
  // Lot 35, migration 0019 : hausses de salaire datées
  ...(Array.isArray(l.hausses) && l.hausses.length ? { hausses: (l.hausses as { mois: string; taux: number }[]).map((h) => ({ mois: String(h.mois).slice(0, 7), taux: Number(h.taux) })) } : {}),
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
    pilotage().from('equipe').select('*').order('id').range(de, a))
  const r: Record<string, Personne[]> = {}
  for (const l of lignes) (r[l.store_name] ??= []).push(versPersonne(l))
  return r
}

export async function enregistrerPersonne(magasin: string, p: Personne) {
  const ligne = {
    store_name: magasin, poste: p.poste.trim(), categorie: p.categorie, heures_hebdo: p.heuresHebdo, brut_mensuel: p.brutMensuel, primes: p.primes,
    entree: p.entree ? `${p.entree}-01` : null, sortie: p.sortie ? `${p.sortie}-01` : null,
    heures_saisie: p.heuresSaisie ?? 'semaine', enveloppe: !!p.enveloppe,   // lot 26, migration 0015
    ...(p.tauxHoraire ? { taux_horaire: p.tauxHoraire } : {}),             // extras, migration 0017
    hausses: p.hausses ?? [],                                              // lot 35, migration 0019
  }
  if (p.id) verifier(await pilotage().from('equipe').update(ligne).eq('id', p.id))
  else verifier(await pilotage().from('equipe').insert(ligne))
}
export async function supprimerPersonne(id: number) {
  verifier(await pilotage().from('equipe').delete().eq('id', id))
}

// ── Prêts du magasin (migration 0026) ; sans la table (migration pas encore passée), aucun prêt
interface LignePret { id: number; store_name: string; libelle: string; mode: string; montant: unknown; taux: unknown; duree: unknown; debut: string; differe: unknown; mensualite: unknown }
export async function chargerPrets(): Promise<Record<string, Pret[]>> {
  const lignes = await toutesLesLignes<LignePret>((de, a) =>
    pilotage().from('emprunts').select('*').order('id').range(de, a))
  const r: Record<string, Pret[]> = {}
  const num = (x: unknown) => (x === null || x === undefined ? 0 : Number(x))
  for (const l of lignes) {
    (r[l.store_name] ??= []).push({
      id: l.id, libelle: l.libelle, mode: l.mode === 'restant' ? 'restant' : 'initial',
      montant: num(l.montant), taux: num(l.taux), duree: num(l.duree), debut: String(l.debut ?? '').slice(0, 7),
      differe: num(l.differe), mensualite: num(l.mensualite),
    })
  }
  return r
}
export async function enregistrerPret(magasin: string, p: Pret) {
  const ligne = {
    store_name: magasin, libelle: p.libelle.trim() || 'Prêt', mode: p.mode, montant: p.montant, taux: p.taux,
    duree: p.mode === 'initial' ? p.duree : null, debut: `${p.debut}-01`,
    differe: p.mode === 'initial' ? p.differe ?? 0 : 0, mensualite: p.mode === 'restant' ? p.mensualite ?? 0 : null,
  }
  if (p.id) verifier(await pilotage().from('emprunts').update(ligne).eq('id', p.id))
  else verifier(await pilotage().from('emprunts').insert(ligne))
}
export async function supprimerPret(id: number) {
  verifier(await pilotage().from('emprunts').delete().eq('id', id))
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

// Alertes des magasins du compte : réel de l'année en cours face à son budget et à l'an dernier, trésorerie du dernier
// quadrimestre et point bas du budget à venir. Seuils : Paramètres réseau de l'année du budget (ceux que règle le Directeur).
// Entrées des alertes de chaque magasin du compte, et les seuils du Directeur
async function entreesAlertes(aujourdhui: Date): Promise<{ entrees: EntreeAlertes[]; seuils: ParametresReseau['alertes']; moisCommerciaux: number }> {
  const annee = anneeSuivi(), aB = anneeBudget()
  const [d, { parametres }, dB, { parametres: pB }, reel, quadrimestres] = await Promise.all([
    chargerBudgets(annee), chargerParametres(annee), chargerBudgets(aB), chargerParametres(aB), chargerReelDuCompte(annee), chargerQuadrimestres(annee),
  ])
  const douze = (): MoisReel[] => Array.from({ length: 12 }, () => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))
  // Réel en retard : seulement une fois les imports de l'année commencés (sinon tous les magasins alerteraient)
  const reelCommence = Object.values(reel.magasins).some((r) => r.n.some((m) => m.caHT > 0))
  const entrees = d.magasins.map((l): EntreeAlertes => {
    const h = l.statut ? hypothesesDe(l, d) : null
    const lB = dB.magasins.find((x) => x.magasin === l.magasin)
    const hB = lB?.statut ? hypothesesDe(lB, dB) : null
    // Point bas du budget : seulement si la trésorerie de départ est saisie (partir de zéro alerterait à tort)
    const pL = parametresDuBudget(lB, pB)
    const depart = lB ? departTresorerie(lB, dB, pL) : undefined
    const point = hB && depart !== undefined ? tresorerieBudget(calculerBudget(hB.hypotheses, pL), hB.hypotheses, pL, pL.tresorerie, depart).pointBas : null
    const q = [...QUADRIMESTRES].reverse().find((x) => quadrimestres[l.magasin]?.[x]?.tresorerie != null)
    return {
      magasin: l.magasin, n: reel.magasins[l.magasin]?.n ?? douze(), n1: reel.magasins[l.magasin]?.n1 ?? douze(),
      budget: h ? calculerBudget(h.hypotheses, parametresDuBudget(l, parametres)) : null,
      // Une année suivie déjà finie (suivi pas encore démarré sur la suivante) : ses douze mois sont terminés
      moisTermines: reelCommence ? (annee < aujourdhui.getFullYear() ? 12 : annee > aujourdhui.getFullYear() ? 0 : aujourdhui.getMonth()) : 0,
      tresorerieReelle: q ? { montant: quadrimestres[l.magasin]![q]!.tresorerie!, quadrimestre: q } : null,
      tresorerieBudget: point ? { montant: point.montant, mois: point.mois, annee: aB } : null,
    }
  })
  return { entrees, seuils: pB.alertes, moisCommerciaux: reglesDe(pB).moisCommerciaux }
}
export async function chargerAlertes(aujourdhui = new Date()): Promise<Alerte[]> {
  const { entrees, seuils, moisCommerciaux } = await entreesAlertes(aujourdhui)
  return trierAlertes(entrees.flatMap((e) => alertesMagasin(e, seuils, moisCommerciaux)))
}
// Mesures d'aujourd'hui de chaque magasin, sans seuil : l'effet des actions
export async function chargerMesures(aujourdhui = new Date()): Promise<Record<string, Partial<Record<TypeAlerte, Mesure>>>> {
  const { entrees } = await entreesAlertes(aujourdhui)
  return Object.fromEntries(entrees.map((e) => [e.magasin, mesuresMagasin(e)]))
}

// Ratios de chaque magasin du compte, pour la comparaison aux médianes : réel de l'année à date et budgets de l'an prochain
export interface RatiosMagasin { magasin: string; groupeId: number | null; ratios: Ratios }
export async function chargerComparaison(): Promise<{ annee: number; anneeBudget: number; groupes: { id: number; nom: string }[]; reel: RatiosMagasin[]; budget: RatiosMagasin[]; familles: { magasin: string; groupeId: number | null; familles: Famille[] }[]; magasinsFamille: number }> {
  const annee = anneeSuivi(), aB = anneeBudget()
  const [d, { parametres }, dB, { parametres: pB }, reel, quadrimestres] = await Promise.all([
    chargerBudgets(annee), chargerParametres(annee), chargerBudgets(aB), chargerParametres(aB), chargerReelDuCompte(annee),
    chargerQuadrimestres(annee).catch((): SaisiesQuadrimestres => ({})),
  ])
  const p = { tauxRedevance: parametres.tauxRedevance, tauxPublicite: parametres.tauxPublicite, charges: parametres.charges, annee }
  const douze = (): MoisReel[] => Array.from({ length: 12 }, () => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))
  return {
    annee, anneeBudget: aB, groupes: dB.groupes, magasinsFamille: reglesDe(pB).magasinsFamille,
    reel: d.magasins.flatMap((l) => {
      const r = reel.magasins[l.magasin]
      if (!r) return []
      const h = l.statut ? hypothesesDe(l, d) : null
      const frais = d.frais[l.magasin]
      const ligne = ligneReseau({
        magasin: l.magasin, n: r.n, n1: r.n1 ?? douze(), budget: h ? calculerBudget(h.hypotheses, parametresDuBudget(l, parametres)) : null,
        equipe: d.equipes[l.magasin], frais: frais?.length ? fraisDepuisLignes(frais).frais : undefined,
        quadrimestres: quadrimestres[l.magasin] ?? {},
      }, p)
      return ligne.moisRealises ? [{ magasin: l.magasin, groupeId: l.groupeId, ratios: ratiosDuReel(ligne) }] : []
    }),
    budget: dB.magasins.flatMap((l) => {
      const h = l.statut ? hypothesesDe(l, dB) : null
      return h ? [{ magasin: l.magasin, groupeId: l.groupeId, ratios: ratiosDuBudget(calculerBudget(h.hypotheses, parametresDuBudget(l, pB)), h.hypotheses) }] : []
    }),
    // Familles du réalisé de l'année en cours, base des budgets de l'an prochain (lot 29)
    familles: dB.magasins.flatMap((l) => {
      const h = l.base || l.statut ? hypothesesDe(l, dB) : null
      return h ? [{ magasin: l.magasin, groupeId: l.groupeId, familles: h.hypotheses.familles }] : []
    }),
  }
}

// Secours de l'atterrissage sans réel de l'an dernier (lot 16) : parts de l'année réalisées saisies, saisonnalité du réseau
export type PartsRealisees = Partial<Record<Univers, number>>
export const chargerPartsRealisees = (annee: number): Promise<Record<string, PartsRealisees>> => memo(`parts|${annee}`, async () => {
  const lignes = await toutesLesLignes<{ store_name: string; univers: Univers; part: number }>((de, a) =>
    pilotage().from('parts_realisees').select('store_name, univers, part').eq('annee', annee).order('store_name').range(de, a))
  const r: Record<string, PartsRealisees> = {}
  for (const l of lignes) (r[l.store_name] ??= {})[l.univers] = Number(l.part)
  return r
})
export async function enregistrerPartsRealisees(magasin: string, annee: number, parts: PartsRealisees) {
  verifier(await pilotage().from('parts_realisees').delete().eq('store_name', magasin).eq('annee', annee))
  const lignes = Object.entries(parts).filter(([, v]) => v !== undefined).map(([univers, part]) => ({ store_name: magasin, annee, univers, part }))
  if (lignes.length) verifier(await pilotage().from('parts_realisees').insert(lignes))
}
export async function chargerSecours(magasin: string, annee: number): Promise<SecoursAtterrissage> {
  const [parts, reel, ouvertures, { parametres }] = await Promise.all([chargerPartsRealisees(annee), chargerReelDuCompte(annee), chargerOuvertures(), chargerParametres(annee)])
  const mini = reglesDe(parametres).magasinsSaisonnalite
  return { parts: parts[magasin] ?? {}, saisonnaliteReseau: saisonnaliteMediane(Object.values(reel.magasins).map((r) => r.n1.map((x) => x.caHT)), mini), ouverture: ouvertures[magasin] ?? null }
}

// Date d'ouverture des magasins (lot 24), tenue par le Directeur ; sans la table (migration pas encore passée), aucune.
// Joseph (03/11/2026) : la fiche magasin de l'app réseau fait foi (0024) ; la saisie du pilotage ne sert qu'aux magasins dont
// l'app réseau ne connaît pas la date. Sans la fonction (0024 pas encore passée), la saisie seule.
const enOuverture = (d: string, reseau: boolean): Ouverture => ({ annee: Number(d.slice(0, 4)), mois: Number(d.slice(5, 7)), ...(reseau ? { reseau: true } : {}) })
export const chargerOuvertures = (): Promise<Record<string, Ouverture>> => memo('ouvertures', async () => {
  const [saisies, reseau] = await Promise.all([pilotage().from('ouvertures').select('store_name, ouverture'), pilotage().rpc('ouvertures_reseau')])
  const l = (r: { data: unknown; error: unknown }) => (!r.error && Array.isArray(r.data) ? (r.data as { store_name: string; ouverture: string }[]).filter((x) => /^\d{4}-\d{2}/.test(x.ouverture ?? '')) : [])
  return {
    ...Object.fromEntries(l(saisies).map((x) => [x.store_name, enOuverture(x.ouverture, false)])),
    ...Object.fromEntries(l(reseau).map((x) => [x.store_name, enOuverture(x.ouverture, true)])),
  }
})
export async function enregistrerOuverture(magasin: string, o: Ouverture | null) {
  if (!o) verifier(await pilotage().from('ouvertures').delete().eq('store_name', magasin))
  else verifier(await pilotage().from('ouvertures').upsert({ store_name: magasin, ouverture: `${o.annee}-${String(o.mois).padStart(2, '0')}-01` }))
}

// Correspondance des comptes du FEC propre au magasin (lot 19) ; sans la table (migration pas encore passée), défaut seul
const RUBRIQUE_BASE: Record<RubriqueFEC, string> = {
  achats: 'achats', variationStock: 'variation_stock', chargesExternes: 'charges_externes', impotsTaxes: 'impots_taxes', personnel: 'personnel', horsEBE: 'hors_ebe',
}
const RUBRIQUE_APP = Object.fromEntries(Object.entries(RUBRIQUE_BASE).map(([a, b]) => [b, a])) as Record<string, RubriqueFEC>
export async function chargerCorrespondancesFEC(magasin: string): Promise<Record<string, RubriqueFEC>> {
  const { data, error } = await pilotage().from('correspondances_fec').select('compte, rubrique').eq('store_name', magasin)
  if (error || !data) return {}
  return Object.fromEntries((data as { compte: string; rubrique: string }[]).filter((l) => RUBRIQUE_APP[l.rubrique]).map((l) => [l.compte, RUBRIQUE_APP[l.rubrique]]))
}
// Comptes vus dans l'import : ceux revenus au défaut sont retirés, les exceptions remplacées
export async function enregistrerCorrespondancesFEC(magasin: string, comptesVus: string[], exceptions: Record<string, RubriqueFEC>) {
  if (comptesVus.length) verifier(await pilotage().from('correspondances_fec').delete().eq('store_name', magasin).in('compte', comptesVus))
  const lignes = Object.entries(exceptions).map(([compte, r]) => ({ store_name: magasin, compte, rubrique: RUBRIQUE_BASE[r] }))
  if (lignes.length) verifier(await pilotage().from('correspondances_fec').insert(lignes))
}

// Échanges sur le budget et versions (lot 20) : auteur, rôle et nom posés par la base
export type SujetEchange = 'general' | 'ca' | 'marge' | 'personnel' | 'frais' | 'travaux' | 'tresorerie'
export const SUJETS: SujetEchange[] = ['general', 'ca', 'marge', 'personnel', 'frais', 'travaux', 'tresorerie']
export const sujetLibelle: Record<SujetEchange, string> = {
  general: 'Général', ca: 'Chiffre d’affaires', marge: 'Marge', personnel: 'Personnel', frais: 'Frais', travaux: 'Travaux', tresorerie: 'Trésorerie',
}
export interface MessageBudget { id: number; sujet: SujetEchange; texte: string; auteur: string | null; auteurRole: Role | null; auteurNom: string | null; creeLe: string }
export interface VersionBudget { id: number; statut: Statut; base: Hypotheses | null; ajustements: Cibles; auteurRole: Role | null; auteurNom: string | null; creeLe: string }
export async function chargerEchanges(magasin: string, annee: number): Promise<{ messages: MessageBudget[]; versions: VersionBudget[] }> {
  const [m, v] = await Promise.all([
    pilotage().from('echanges_budget').select('id, sujet, texte, auteur, auteur_role, auteur_nom, cree_le').eq('store_name', magasin).eq('annee', annee).order('cree_le'),
    pilotage().from('versions_budget').select('id, statut, base, ajustements, auteur_role, auteur_nom, cree_le').eq('store_name', magasin).eq('annee', annee).order('cree_le', { ascending: false }),
  ])
  if (m.error || v.error) throw m.error ?? v.error
  type Brut = { id: number; auteur_role: Role | null; auteur_nom: string | null; cree_le: string }
  return {
    messages: (m.data as (Brut & { sujet: SujetEchange; texte: string; auteur: string | null })[]).map((x) => ({ id: x.id, sujet: x.sujet, texte: x.texte, auteur: x.auteur, auteurRole: x.auteur_role, auteurNom: x.auteur_nom, creeLe: x.cree_le })),
    versions: (v.data as (Brut & { statut: Statut; base: unknown; ajustements: Cibles | null })[]).map((x) => ({
      id: x.id, statut: x.statut, base: hypothesesValides(x.base) ? x.base : null, ajustements: x.ajustements ?? {}, auteurRole: x.auteur_role, auteurNom: x.auteur_nom, creeLe: x.cree_le,
    })),
  }
}
export async function envoyerMessage(magasin: string, annee: number, sujet: SujetEchange, texte: string) {
  verifier(await pilotage().from('echanges_budget').insert({ store_name: magasin, annee, sujet, texte: texte.trim() }))
}
export async function retirerMessage(id: number) {
  verifier(await pilotage().from('echanges_budget').delete().eq('id', id))
}

// Commentaires (migration 0025, Joseph 03/11/2026) : posés sur un point du budget (« ancre »), avec réponses et « Résolu ».
// Sans la migration, les messages d'avant se lisent comme des commentaires sur le budget en général.
export interface Commentaire {
  id: number; ancre: string; ancreLibelle: string | null; parent: number | null; texte: string
  auteur: string | null; auteurRole: Role | null; auteurNom: string | null; creeLe: string
  resoluLe: string | null; resoluParRole: Role | null; resoluParNom: string | null
}
export async function chargerCommentaires(magasin: string, annee: number): Promise<Commentaire[]> {
  const complet = await pilotage().from('echanges_budget').select('id, ancre, ancre_libelle, parent, texte, auteur, auteur_role, auteur_nom, cree_le, resolu_le, resolu_par_role, resolu_par_nom')
    .eq('store_name', magasin).eq('annee', annee).order('cree_le')
  type Brut = { id: number; ancre?: string; ancre_libelle?: string | null; parent?: number | null; texte: string; auteur: string | null; auteur_role: Role | null; auteur_nom: string | null; cree_le: string; resolu_le?: string | null; resolu_par_role?: Role | null; resolu_par_nom?: string | null }
  let lignes = complet.data as Brut[] | null
  if (complet.error) {
    const ancien = await pilotage().from('echanges_budget').select('id, texte, auteur, auteur_role, auteur_nom, cree_le').eq('store_name', magasin).eq('annee', annee).order('cree_le')
    if (ancien.error) throw new ErreurChargement()
    lignes = ancien.data as Brut[]
  }
  return (lignes ?? []).map((x) => ({
    id: x.id, ancre: x.ancre ?? 'budget', ancreLibelle: x.ancre_libelle ?? null, parent: x.parent ?? null, texte: x.texte, auteur: x.auteur,
    auteurRole: x.auteur_role, auteurNom: x.auteur_nom, creeLe: x.cree_le, resoluLe: x.resolu_le ?? null, resoluParRole: x.resolu_par_role ?? null, resoluParNom: x.resolu_par_nom ?? null,
  }))
}
// Commentaires encore ouverts par magasin, pour la campagne ; sans la migration 0025, aucun
export async function chargerCommentairesOuverts(annee: number): Promise<Record<string, number>> {
  const { data, error } = await pilotage().from('echanges_budget').select('store_name').eq('annee', annee).is('parent', null).is('resolu_le', null)
  if (error) return {}
  const n: Record<string, number> = {}
  for (const x of data as { store_name: string }[]) n[x.store_name] = (n[x.store_name] ?? 0) + 1
  return n
}
export async function envoyerCommentaire(magasin: string, annee: number, c: { ancre: string; libelle: string; texte: string; parent?: number }) {
  verifier(await pilotage().from('echanges_budget').insert({
    store_name: magasin, annee, texte: c.texte.trim(), ...(c.parent ? { parent: c.parent } : { ancre: c.ancre, ancre_libelle: c.libelle.slice(0, 160) }),
  }))
}
export async function resoudreCommentaire(id: number, resolu: boolean) {
  verifier(await pilotage().rpc('resoudre_commentaire', { p_id: id, p_resolu: resolu }))
}

// Versions nommées du budget (lot 26) : enregistrées sans toucher au budget en cours, comparées côte à côte
export interface VersionNommee { id: number; nom: string; base: Hypotheses; ajustements: Cibles; auteur: string | null; auteurRole: Role | null; auteurNom: string | null; creeLe: string }
export async function chargerVersionsNommees(magasin: string, annee: number): Promise<VersionNommee[]> {
  const { data, error } = await pilotage().from('versions_nommees').select('id, nom, base, ajustements, auteur, auteur_role, auteur_nom, cree_le')
    .eq('store_name', magasin).eq('annee', annee).order('cree_le')
  if (error) throw new ErreurChargement()
  return (data as { id: number; nom: string; base: unknown; ajustements: Cibles | null; auteur: string | null; auteur_role: Role | null; auteur_nom: string | null; cree_le: string }[])
    .filter((x) => hypothesesValides(x.base))
    .map((x) => ({ id: x.id, nom: x.nom, base: x.base as Hypotheses, ajustements: x.ajustements ?? {}, auteur: x.auteur, auteurRole: x.auteur_role, auteurNom: x.auteur_nom, creeLe: x.cree_le }))
}
export async function enregistrerVersionNommee(magasin: string, annee: number, nom: string, base: Hypotheses, ajustements: Cibles) {
  verifier(await pilotage().from('versions_nommees').insert({ store_name: magasin, annee, nom: nom.trim(), base, ajustements }))
}
export async function retirerVersionNommee(id: number) {
  verifier(await pilotage().from('versions_nommees').delete().eq('id', id))
}

// Plan d'action (lot 21) : auteur posé par la base ; le franchisé ne change que le statut
export type StatutAction = 'a_faire' | 'faite' | 'abandonnee'
export type Responsable = 'franchise' | 'coach' | 'rr' | 'directeur'
export interface Action {
  id: number; magasin: string; type: TypeAction; intitule: string; responsable: Responsable; echeance: string | null; statut: StatutAction
  annee: number; depart: Mesure | null; creeParRole: Role | null; creeParNom: string | null; creeLe: string; faiteLe: string | null
}
export interface NouvelleAction { magasin: string; type: TypeAction; intitule: string; responsable: Responsable; echeance: string | null; annee: number; depart: Mesure | null }
export async function chargerActions(): Promise<Action[]> {
  const lignes = await toutesLesLignes<{
    id: number; store_name: string; type_alerte: TypeAction; intitule: string; responsable: Responsable; echeance: string | null; statut: StatutAction
    annee: number; depart: number | null; mois_depart: number | null; cree_par_role: Role | null; cree_par_nom: string | null; cree_le: string; faite_le: string | null
  }>((de, a) => pilotage().from('actions').select('*').order('cree_le').range(de, a))
  return lignes.map((l) => ({
    id: l.id, magasin: l.store_name, type: l.type_alerte, intitule: l.intitule, responsable: l.responsable, echeance: l.echeance, statut: l.statut,
    annee: l.annee, depart: l.depart === null ? null : { valeur: Number(l.depart), mois: l.mois_depart }, creeParRole: l.cree_par_role, creeParNom: l.cree_par_nom,
    creeLe: l.cree_le, faiteLe: l.faite_le,
  }))
}
export async function creerAction(a: NouvelleAction) {
  verifier(await pilotage().from('actions').insert({
    store_name: a.magasin, type_alerte: a.type, intitule: a.intitule.trim(), responsable: a.responsable, echeance: a.echeance, annee: a.annee,
    depart: a.depart?.valeur ?? null, mois_depart: a.depart?.mois ?? null,
  }))
}
export async function changerStatutAction(id: number, statut: StatutAction) {
  verifier(await pilotage().from('actions').update({ statut }).eq('id', id))
}
export async function retirerAction(id: number) {
  verifier(await pilotage().from('actions').delete().eq('id', id))
}

// Valeur du stock en fin de mois (migration 0023, 03/11/2026) : Cave et Bar au prix d'achat HT, saisis chaque mois.
// Sans la table (migration pas encore passée) : aucun mois saisi.
export const chargerStocks = (magasin: string, annee: number): Promise<(StockSaisi | null)[]> => memo(`stocks|${magasin}|${annee}`, async () => {
  const mois: (StockSaisi | null)[] = Array(12).fill(null)
  const { data, error } = await pilotage().from('stocks').select('mois, cave, bar').eq('store_name', magasin).eq('annee', annee)
  if (error || !Array.isArray(data)) return mois
  const num = (x: unknown) => (x === null || x === undefined ? null : Number(x))
  for (const l of data as { mois: number; cave: unknown; bar: unknown }[]) if (l.mois >= 1 && l.mois <= 12) mois[l.mois - 1] = { cave: num(l.cave), bar: num(l.bar) }
  return mois
})
export async function enregistrerStock(magasin: string, annee: number, mois: number, s: StockSaisi) {
  if (s.cave === null && s.bar === null) verifier(await pilotage().from('stocks').delete().eq('store_name', magasin).eq('annee', annee).eq('mois', mois))
  else verifier(await pilotage().from('stocks').upsert({ store_name: magasin, annee, mois, cave: s.cave, bar: s.bar }))
}
