import { pilotage } from '../lib/supabase'
import { parametresParDefaut } from '../moteur/parametres'
import type { Hypotheses, ParametresReseau } from '../moteur/types'

export type Statut = 'propose' | 'en_discussion' | 'valide'
export const statutLibelle: Record<Statut, string> = { propose: 'Proposé par le siège', en_discussion: 'En discussion', valide: 'Validé' }

export interface LigneMagasin { magasin: string; statut: Statut | null; hypotheses: Hypotheses | null; majLe: string | null }

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

export async function chargerMagasins(annee: number): Promise<LigneMagasin[]> {
  const { data, error } = await pilotage().rpc('magasins_du_compte', { p_annee: annee })
  if (error || !Array.isArray(data)) throw new ErreurChargement()
  return (data as { magasin: string; statut: Statut | null; hypotheses: unknown; maj_le: string | null }[]).map((l) => ({
    magasin: l.magasin, statut: l.statut, hypotheses: hypothesesValides(l.hypotheses) ? l.hypotheses : null, majLe: l.maj_le,
  }))
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
