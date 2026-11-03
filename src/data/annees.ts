// Années du pilotage (migration 0027) : lues une fois à la connexion, puis gardées pour toute l'application.
// Faute de table (base pas encore passée en 0027) ou de réponse, l'ancienne règle du calendrier s'applique.
import { pilotage } from '../lib/supabase'
import { anneesDepuis, anneesDuCalendrier, type Annees, type LigneAnnee } from '../moteur/annees'

let actuelles: Annees = anneesDuCalendrier()
let lignes: LigneAnnee[] = []
const abonnes = new Set<() => void>()

export const annees = (): Annees => actuelles
export const lignesAnnees = (): LigneAnnee[] => lignes
export const anneeSuivi = (): number => actuelles.suivi
export function ecouterAnnees(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f) } }

export async function chargerAnnees(): Promise<Annees> {
  try {
    const { data, error } = await pilotage().from('annees').select('annee, etat, campagne_le, suivi_le, close_le').order('annee')
    lignes = error ? [] : (data ?? []) as LigneAnnee[]
  } catch {
    lignes = []
  }
  actuelles = anneesDepuis(lignes)
  abonnes.forEach((f) => f())
  return actuelles
}

export class RefusAnnee extends Error {}

// Ouvrir la campagne, démarrer le suivi, clore une année : le Directeur seul, la base vérifie l'ordre des étapes
export async function changerAnnee(quoi: 'ouvrir' | 'demarrer' | 'clore', annee: number) {
  const fonction = quoi === 'ouvrir' ? 'ouvrir_campagne' : quoi === 'demarrer' ? 'demarrer_suivi' : 'clore_annee'
  const { error } = await pilotage().rpc(fonction, { p_annee: annee })
  if (error) throw new RefusAnnee(error.message)
}
