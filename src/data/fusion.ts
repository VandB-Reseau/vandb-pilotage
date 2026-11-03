// Préparation de la fusion avec l'app réseau (migration 0028) : concordance des CA, magasins renommés.
// Faute de fonctions dans la base (0028 pas encore passée), l'écran le dit et ne montre rien d'autre.
import { pilotage } from '../lib/supabase'
import { oublier } from './pilotage'
import type { LigneConcordance } from '../moteur/concordance'

export class ErreurFusion extends Error {}

const absente = (e: { message?: string; code?: string } | null) => !!e && (e.code === 'PGRST202' || /does not exist|could not find the function|schema cache/i.test(e.message ?? ''))
const nombre = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

export interface MagasinOrphelin { magasin: string; lignes: number; nouveauNom: string | null }
export interface PreparationFusion { concordance: LigneConcordance[]; orphelins: MagasinOrphelin[] }

// null : fonctions absentes de la base (0028 pas encore passée)
export async function chargerPreparationFusion(annee: number): Promise<PreparationFusion | null> {
  const [c, o] = await Promise.all([pilotage().rpc('concordance_ca', { p_annee: annee }), pilotage().rpc('magasins_orphelins')])
  if (absente(c.error) || absente(o.error)) return null
  if (c.error || o.error || !Array.isArray(c.data) || !Array.isArray(o.data)) throw new ErreurFusion()
  type C = { store_name: string; mois: string; ca_caisse: unknown; tickets_caisse: unknown; ca_reseau: unknown; tickets_reseau: unknown }
  type O = { store_name: string; lignes: unknown; nouveau_nom: string | null }
  return {
    concordance: (c.data as C[]).map((l) => ({
      magasin: l.store_name, mois: String(l.mois).slice(0, 7),
      caCaisse: nombre(l.ca_caisse), ticketsCaisse: nombre(l.tickets_caisse), caReseau: nombre(l.ca_reseau), ticketsReseau: nombre(l.tickets_reseau),
    })),
    orphelins: (o.data as O[]).map((l) => ({ magasin: l.store_name, lignes: Number(l.lignes) || 0, nouveauNom: l.nouveau_nom || null })),
  }
}

// Le Directeur rattache les données d'un ancien nom au nouveau ; renvoie les lignes déplacées et celles restées (déjà présentes sous le nouveau nom)
export async function rattacherMagasin(ancien: string, nouveau: string): Promise<{ deplacees: number; restees: number }> {
  const { data, error } = await pilotage().rpc('renommer_magasin', { p_ancien: ancien, p_nouveau: nouveau })
  oublier()
  if (error) throw new ErreurFusion()
  const d = (data ?? {}) as { deplacees?: unknown; restees?: unknown }
  return { deplacees: Number(d.deplacees) || 0, restees: Number(d.restees) || 0 }
}
