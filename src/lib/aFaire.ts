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

// Espace franchisé (lot 18) : ce que le franchisé a à faire sur son magasin, le plus urgent d'abord
export type TacheFranchise =
  | { type: 'reel'; mois: number }                                  // dernier mois terminé à saisir (0 à 11)
  | { type: 'quadrimestre'; annee: number; quadrimestre: 1 | 2 | 3 }
  | { type: 'budget'; annee: number; statut: 'propose' | 'en_discussion'; avant?: string }   // avant : date de validation de la campagne (lot 28)
  | { type: 'equipe' } | { type: 'frais' }
  | { type: 'action'; intitule: string; echeance: string | null }  // action du plan confiée au franchisé
export function tachesFranchise(e: {
  moisRenseignes: number                                            // mois de réel de l'année en cours
  quadrimestres: Record<number, (1 | 2 | 3)[]>                      // quadrimestres saisis, par année
  budget: { annee: number; statut: Statut | null; avant?: string }
  aEquipe: boolean
  aFrais: boolean
  actions?: { intitule: string; echeance: string | null }[]
}, aujourdhui = new Date()): TacheFranchise[] {
  const n = aujourdhui.getFullYear(), m = aujourdhui.getMonth()
  const t: TacheFranchise[] = []
  if (reelEnRetard(e.moisRenseignes, aujourdhui)) t.push({ type: 'reel', mois: m - 1 })
  // Un quadrimestre se saisit une fois fini : janvier à avril dès mai, mai à août dès septembre, septembre à décembre l'année suivante
  const saisi = (a: number, q: 1 | 2 | 3) => (e.quadrimestres[a] ?? []).includes(q)
  if (m < 4 && !saisi(n - 1, 3)) t.push({ type: 'quadrimestre', annee: n - 1, quadrimestre: 3 })
  if (m >= 4 && !saisi(n, 1)) t.push({ type: 'quadrimestre', annee: n, quadrimestre: 1 })
  if (m >= 8 && !saisi(n, 2)) t.push({ type: 'quadrimestre', annee: n, quadrimestre: 2 })
  if (e.budget.statut === 'propose' || e.budget.statut === 'en_discussion') t.push({ type: 'budget', annee: e.budget.annee, statut: e.budget.statut, ...(e.budget.avant ? { avant: e.budget.avant } : {}) })
  if (!e.aEquipe) t.push({ type: 'equipe' })
  if (!e.aFrais) t.push({ type: 'frais' })
  // Actions du plan, la plus proche échéance d'abord
  for (const a of [...(e.actions ?? [])].sort((x, y) => (x.echeance ?? '9999').localeCompare(y.echeance ?? '9999'))) t.push({ type: 'action', ...a })
  return t
}

// Nombre de valeurs changées entre deux saisies (lot 27, barre d'enregistrement) : on descend dans les objets,
// une liste (saisonnalité, temps forts) compte pour un changement
export function nombreChangements(a: unknown, b: unknown): number {
  const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  if (objet(a) || objet(b)) {
    const x = objet(a) ? a : {}, y = objet(b) ? b : {}
    return [...new Set([...Object.keys(x), ...Object.keys(y)])].reduce((n, k) => n + nombreChangements(x[k], y[k]), 0)
  }
  return JSON.stringify(a) === JSON.stringify(b) ? 0 : 1
}

// « À traiter » de l'accueil (lot 27) : ce qui attend le Directeur, le RR ou le Coach sur son périmètre, du plus urgent au moins urgent
export interface ATraiter {
  cle: 'alertes' | 'actions' | 'a_proposer' | 'en_discussion' | 'equipe' | 'frais'
  nombre: number
  magasins: string[]
  filtre?: Filtre
}
export function aTraiter(
  magasins: MagasinListe[],
  alertes: { magasin: string }[],
  actions: { magasin: string; statut: string; echeance: string | null }[],
  directeur: boolean,
  aujourdhui: string,          // AAAA-MM-JJ
): ATraiter[] {
  const uniques = (l: string[]) => [...new Set(l)]
  const noms = (l: MagasinListe[]) => l.map((m) => m.magasin)
  const enRetard = actions.filter((a) => a.statut === 'a_faire' && a.echeance !== null && a.echeance < aujourdhui)
  const avecAlerte = uniques(alertes.map((a) => a.magasin))
  const items: ATraiter[] = [
    { cle: 'alertes', nombre: avecAlerte.length, magasins: avecAlerte },
    { cle: 'actions', nombre: enRetard.length, magasins: uniques(enRetard.map((a) => a.magasin)) },
  ]
  const parMagasin = (cle: ATraiter['cle'], filtre: Filtre, l: MagasinListe[]) => items.push({ cle, filtre, nombre: l.length, magasins: noms(l) })
  // Proposer un budget est l'affaire du Directeur seul
  if (directeur) parMagasin('a_proposer', 'sans_budget', magasins.filter((m) => !m.statut))
  parMagasin('en_discussion', 'en_discussion', magasins.filter((m) => m.statut === 'en_discussion'))
  parMagasin('equipe', 'equipe', magasins.filter((m) => !m.aEquipe))
  parMagasin('frais', 'frais', magasins.filter((m) => !m.aFrais))
  return items.filter((x) => x.nombre > 0)
}
