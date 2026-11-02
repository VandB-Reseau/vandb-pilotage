// Navigation en trois espaces (lot 36, Joseph 02/11/2026) : Données (ce qui entre), Budget (construit une fois par an,
// depuis l'atterrissage de l'année en cours), Suivi (réel face au budget). Chaque partie de la fiche d'un magasin a son
// adresse : #/magasins/<nom>/<partie>.
export type Espace = 'donnees' | 'budget' | 'suivi'

export interface Partie { cle: string; libelle: string }

export const ESPACES: { cle: Espace; libelle: string }[] = [
  { cle: 'donnees', libelle: 'Données' },
  { cle: 'budget', libelle: 'Budget' },
  { cle: 'suivi', libelle: 'Suivi' },
]

export function partiesDe(espace: Espace, annee: number = new Date().getFullYear()): Partie[] {
  if (espace === 'donnees') {
    return [
      { cle: 'reel', libelle: 'Réel du mois' },
      { cle: 'quadrimestres', libelle: 'Comptes du quadrimestre' },
      { cle: 'frais', libelle: `Frais ${annee}` },
    ]
  }
  if (espace === 'budget') {
    return [
      { cle: 'depart', libelle: '0 · Point de départ' },
      { cle: 'budget', libelle: '1 · Chiffre d’affaires' },
      { cle: 'equipe', libelle: '2 · Équipe' },
      { cle: 'fraisBudget', libelle: '3 · Frais' },
      { cle: 'resultat', libelle: '4 · Résultat et trésorerie' },
      { cle: 'echanges', libelle: '5 · Échanges et validation' },
    ]
  }
  return [
    { cle: 'synthese', libelle: 'Synthèse' },
    { cle: 'suivi', libelle: 'Face au budget' },
  ]
}

export const PARTIE_PAR_DEFAUT: Record<Espace, string> = { donnees: 'reel', budget: 'depart', suivi: 'synthese' }

// Anciennes clés (liens, alertes, « à faire ») : la partie qui les montre désormais, et la section où défiler
const ANCIENNES: Record<string, string> = { calendrier: 'budget', atterrissage: 'depart', plan: 'synthese' }
export const partieDe = (cle: string) => ANCIENNES[cle] ?? cle
export const sectionDe = (cle: string) => (ANCIENNES[cle] && cle !== 'atterrissage' ? cle : null)

const DONNEES = ['reel', 'quadrimestres', 'frais']
const BUDGET = ['depart', 'budget', 'equipe', 'fraisBudget', 'resultat', 'echanges']
export function espaceDe(cle: string): Espace {
  const p = partieDe(cle)
  return DONNEES.includes(p) ? 'donnees' : BUDGET.includes(p) ? 'budget' : 'suivi'
}
export const partieConnue = (cle: string) => [...DONNEES, ...BUDGET, 'synthese', 'suivi'].includes(partieDe(cle))

// Pages du réseau : l'espace auquel elles appartiennent (les paramètres n'en changent pas)
export function espaceDePage(chemin: string): Espace | null {
  if (chemin === '/' || chemin.startsWith('/hypotheses')) return 'budget'
  if (chemin.startsWith('/imports')) return 'donnees'
  if (chemin.startsWith('/reseau')) return 'suivi'
  return null
}

// Magasin et partie lus dans l'adresse
export function magasinDeChemin(chemin: string): { nom: string; partie: string | null } | null {
  const m = /^\/magasins\/([^/]+)(?:\/([^/]+))?/.exec(chemin)
  if (!m) return null
  return { nom: decodeURIComponent(m[1]), partie: m[2] ? decodeURIComponent(m[2]) : null }
}
