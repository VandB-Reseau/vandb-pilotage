import type { Statut } from '../data/pilotage'

// Filtres de la liste des magasins : avancement du budget et données à renseigner
export type Filtre = 'tous' | Statut | 'sans_budget' | 'equipe' | 'frais'
export interface MagasinListe { magasin: string; statut: Statut | null; groupeId: number | null; aEquipe: boolean; aFrais: boolean }

export const FILTRES: { cle: Filtre; libelle: string }[] = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'sans_budget', libelle: 'Sans budget' },
  { cle: 'propose', libelle: 'Proposés par le siège' },
  { cle: 'en_discussion', libelle: 'En discussion' },
  { cle: 'valide', libelle: 'Validés' },
  { cle: 'equipe', libelle: 'Équipe à renseigner' },
  { cle: 'frais', libelle: 'Frais à renseigner' },
]

export function correspond(m: MagasinListe, f: Filtre): boolean {
  switch (f) {
    case 'tous': return true
    case 'sans_budget': return !m.statut
    case 'equipe': return !m.aEquipe
    case 'frais': return !m.aFrais
    default: return m.statut === f
  }
}

// Recherche sans tenir compte des accents ni des majuscules
const simple = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
export function filtrerMagasins<T extends MagasinListe>(l: T[], f: Filtre, recherche: string, groupe: number | null): T[] {
  const q = simple(recherche)
  return l.filter((m) => correspond(m, f) && (groupe === null || m.groupeId === groupe) && (!q || simple(m.magasin).includes(q)))
}

// Réel en retard : le dernier mois terminé n'est pas encore là (rien d'attendu en janvier)
export function reelEnRetard(moisRenseignes: number, aujourdhui = new Date()): boolean {
  const attendu = aujourdhui.getMonth()
  return attendu > 0 && moisRenseignes < attendu
}
