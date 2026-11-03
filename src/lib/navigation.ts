// Navigation en trois espaces (lot 36, Joseph 02/11/2026). Chaque partie de la fiche d'un magasin a son adresse :
// #/magasins/<nom>/<partie>. Depuis le 03/11/2026, ces espaces sont des onglets de la fiche du magasin.
// Joseph (03/11/2026, option A de la maquette de navigation) : trois onglets seulement, dans l'ordre d'usage :
// « Suivi <année> » (une seule page), « Budget <année suivante> » (les étapes en frise), « Saisies » (ce qui entre).
// À la fusion avec l'app réseau, le Suivi rejoindra « Chiffres et santé » et le Budget deviendra un onglet de sa fiche.
import { anneeSuivi } from '../data/annees'
export type Espace = 'donnees' | 'budget' | 'suivi'

export interface Partie { cle: string; libelle: string }

export const ESPACES: { cle: Espace; libelle: string }[] = [
  { cle: 'suivi', libelle: 'Suivi' },
  { cle: 'budget', libelle: 'Budget' },
  { cle: 'donnees', libelle: 'Saisies' },
]
// Libellé affiché de l'onglet : l'année suivie, l'année du budget
export function libelleEspace(cle: Espace, anneeEnCours: number, anneeBudget: number) {
  return cle === 'suivi' ? `Suivi ${anneeEnCours}` : cle === 'budget' ? `Budget ${anneeBudget}` : 'Saisies'
}

export function partiesDe(espace: Espace, annee: number = anneeSuivi()): Partie[] {
  if (espace === 'donnees') {
    return [
      { cle: 'reel', libelle: 'Réel du mois' },
      // Option A (03/11/2026) : la saisie du stock rejoint les autres saisies ; sa lecture reste dans le Suivi
      { cle: 'saisieStock', libelle: 'Stock de fin de mois' },
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
  // Option A (03/11/2026) : le Suivi tient sur une page ; l'atterrissage, la trésorerie et le stock en sont des sections
  return []
}

// Sections repliables de la page Suivi, sous « Où en est le magasin » (chacune garde son adresse)
export const SECTIONS_SUIVI = (annee: number = anneeSuivi()): Partie[] => [
  { cle: 'atterrissage', libelle: `Atterrissage ${annee}` },
  { cle: 'tresorerie', libelle: 'Trésorerie' },
  { cle: 'stock', libelle: 'Stock' },
]
const CLES_SECTIONS_SUIVI = ['atterrissage', 'tresorerie', 'stock']
export const estSectionSuivi = (cle: string | null | undefined) => !!cle && CLES_SECTIONS_SUIVI.includes(cle)

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
const ANCIENNES: Record<string, string> = { atterrissage: 'synthese', tresorerie: 'synthese', stock: 'synthese', tresoBudget: 'depart', plan: 'synthese', suivi: 'synthese', resultat: 'visualiser', travaux: 'investissements' }
export const partieDe = (cle: string) => ANCIENNES[cle] ?? cle
export const sectionDe = (cle: string) => (ANCIENNES[cle] && cle !== 'travaux' ? cle : null)

const DONNEES = ['reel', 'saisieStock', 'quadrimestres', 'frais']
const BUDGET = ['budget', 'visualiser', 'echanges', ...CLES_THEMES]
export function espaceDe(cle: string): Espace {
  const p = partieDe(cle)
  return DONNEES.includes(p) ? 'donnees' : BUDGET.includes(p) ? 'budget' : 'suivi'
}
export const partieConnue = (cle: string) => [...DONNEES, ...BUDGET, 'synthese'].includes(partieDe(cle))

// Magasin et partie lus dans l'adresse
export function magasinDeChemin(chemin: string): { nom: string; partie: string | null } | null {
  const m = /^\/magasins\/([^/]+)(?:\/([^/]+))?/.exec(chemin)
  if (!m) return null
  return { nom: decodeURIComponent(m[1]), partie: m[2] ? decodeURIComponent(m[2]) : null }
}
