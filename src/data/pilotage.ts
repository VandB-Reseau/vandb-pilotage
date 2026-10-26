import { pilotage } from '../lib/supabase'
import { calculerBudget } from '../moteur/budget'
import { appliquerCibles, type Cibles, type NiveauCibles, type Provenance } from '../moteur/cibles'
import { parametresParDefaut } from '../moteur/parametres'
import type { Hypotheses, ParametresReseau } from '../moteur/types'

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
export interface DonneesBudgets { magasins: LigneMagasin[]; reseau: Cibles | null; groupes: Groupe[] }

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

const objet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

export async function chargerBudgets(annee: number): Promise<DonneesBudgets> {
  const { data, error } = await pilotage().rpc('budgets_du_compte', { p_annee: annee })
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
  }
}

// Niveaux d'un magasin, du réseau à ses propres ajustements
export function niveauxDe(ligne: LigneMagasin, d: DonneesBudgets, ajustements: Cibles = ligne.ajustements): NiveauCibles[] {
  const groupe = d.groupes.find((g) => g.id === ligne.groupeId)
  return [{ niveau: 'reseau', cibles: d.reseau }, { niveau: 'groupe', cibles: groupe?.cibles }, { niveau: 'magasin', cibles: ajustements }]
}

// Hypothèses qui font foi : figées une fois le budget validé, sinon recalculées avec les cibles du moment
export function hypothesesDe(ligne: LigneMagasin, d: DonneesBudgets, ajustements?: Cibles): { hypotheses: Hypotheses; provenance: Provenance[] } | null {
  if (ligne.base && !(ligne.statut === 'valide' && ligne.figees)) return appliquerCibles(ligne.base, niveauxDe(ligne, d, ajustements))
  if (ligne.figees) return { hypotheses: ligne.figees, provenance: ligne.base ? appliquerCibles(ligne.base, niveauxDe(ligne, d, ajustements)).provenance : [] }
  return null
}

export class ErreurEnregistrement extends Error {}
const verifier = ({ error }: { error: unknown }) => { if (error) throw new ErreurEnregistrement() }

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
export async function chargerParametres(annee: number): Promise<{ parametres: ParametresReseau; enregistres: boolean }> {
  const { data, error } = await pilotage().from('parametres_reseau').select('valeur').eq('annee', annee).maybeSingle()
  if (error) throw new ErreurChargement()
  const v = (data?.valeur ?? {}) as Partial<ParametresReseau>
  return {
    parametres: {
      ...parametresParDefaut, ...v,
      impot: { ...parametresParDefaut.impot, ...v.impot },
      tvaPanier: { ...parametresParDefaut.tvaPanier, ...v.tvaPanier },
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
