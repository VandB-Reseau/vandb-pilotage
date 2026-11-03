// Navigation en trois espaces (lot 36, Joseph 02/11/2026) : Données (ce qui entre), Budget (construit une fois par an,
// depuis l'atterrissage de l'année en cours), Suivi (réel face au budget). Chaque partie de la fiche d'un magasin a son
// adresse : #/magasins/<nom>/<partie>. Depuis le 03/11/2026, ces espaces sont des onglets de la fiche du magasin.
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
      // Joseph (03/11/2026) : trois étapes ; le point de départ devient une carte de « Construire », le résultat et la
      // trésorerie ont leur page
      { cle: 'budget', libelle: '1 · Construire' },
      { cle: 'visualiser', libelle: '2 · Visualiser' },
      { cle: 'echanges', libelle: '3 · Envoyer et valider' },
    ]
  }
  // Lot 41 (proposition 5) : Synthèse et Face au budget ne font plus qu'une page
  return [
    { cle: 'synthese', libelle: 'Où en est le magasin' },
    // Joseph (03/11/2026) : l'atterrissage de l'année en cours sort du budget, c'est la fin de l'année suivie
    { cle: 'atterrissage', libelle: `Atterrissage ${annee}` },
    // Joseph (03/11/2026) : valeur du stock en fin de mois face à sa cible
    { cle: 'stock', libelle: 'Stock' },
    { cle: 'tresorerie', libelle: 'Trésorerie' },
  ]
}

// Lot 37 (Joseph, 02/11/2026) : les hypothèses du budget se lisent en cartes par thème ; chaque carte ouvre un tableau
// court du thème. Ces thèmes ont leur adresse mais restent sous l'étape « 1 · Hypothèses ».
// Lot 42 : les ventes et le résultat sont sur la page « Construire » ; restent en détail les thèmes ci-dessous.
// Joseph (03/11/2026) : les ventes aussi, ouvertes depuis les cartes des univers
// Joseph (03/11/2026) : le point de départ en carte, le Calendrier devient « Évènements & Temps forts », les travaux
// passent dans « Investissements & Financements »
export const THEMES: Partie[] = [
  { cle: 'depart', libelle: 'Point de départ' },
  { cle: 'ventes', libelle: 'Ventes et marge' },
  { cle: 'calendrier', libelle: 'Évènements & Temps forts' },
  { cle: 'investissements', libelle: 'Investissements & Financements' },
  { cle: 'equipe', libelle: 'Équipe' },
  { cle: 'fraisBudget', libelle: 'Frais' },
]
const CLES_THEMES = THEMES.map((t) => t.cle)
export const estTheme = (cle: string) => CLES_THEMES.includes(cle)
// Étape ou partie du menu à mettre en avant pour une partie (un thème : l'étape des hypothèses)
export const etapeDe = (cle: string) => (estTheme(cle) ? 'budget' : cle)

export const PARTIE_PAR_DEFAUT: Record<Espace, string> = { donnees: 'reel', budget: 'budget', suivi: 'synthese' }

// Anciennes clés (liens, alertes, « à faire ») : la partie qui les montre désormais, et la section où défiler
// Lot 43 : l'ancien thème « Trésorerie » du budget est au point de départ ; le résultat a sa page (03/11/2026)
const ANCIENNES: Record<string, string> = { tresoBudget: 'depart', plan: 'synthese', suivi: 'synthese', resultat: 'visualiser', travaux: 'investissements' }
export const partieDe = (cle: string) => ANCIENNES[cle] ?? cle
export const sectionDe = (cle: string) => (ANCIENNES[cle] && cle !== 'travaux' ? cle : null)

const DONNEES = ['reel', 'quadrimestres', 'frais']
const BUDGET = ['budget', 'visualiser', 'echanges', ...CLES_THEMES]
export function espaceDe(cle: string): Espace {
  const p = partieDe(cle)
  return DONNEES.includes(p) ? 'donnees' : BUDGET.includes(p) ? 'budget' : 'suivi'
}
export const partieConnue = (cle: string) => [...DONNEES, ...BUDGET, 'synthese', 'atterrissage', 'stock', 'tresorerie'].includes(partieDe(cle))

// Magasin et partie lus dans l'adresse
export function magasinDeChemin(chemin: string): { nom: string; partie: string | null } | null {
  const m = /^\/magasins\/([^/]+)(?:\/([^/]+))?/.exec(chemin)
  if (!m) return null
  return { nom: decodeURIComponent(m[1]), partie: m[2] ? decodeURIComponent(m[2]) : null }
}
