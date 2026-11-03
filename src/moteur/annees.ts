// Années du pilotage (migration 0027, Joseph 03/11/2026, option 2 de la maquette « Passage d'année ») : ce n'est plus
// le calendrier qui fait passer l'application d'une année à l'autre, c'est le Directeur. Chaque année enregistrée a un
// état : campagne (son budget se construit) → suivi (son réel se compare à son budget) → close (en lecture).
// Une année absente est « en préparation ». Sans aucune année enregistrée (base pas encore passée en 0027), on garde
// l'ancienne règle du calendrier : suivi de l'année civile, budget de l'année suivante à partir de septembre.

export type EtatAnnee = 'campagne' | 'suivi' | 'close'
export interface LigneAnnee { annee: number; etat: EtatAnnee; campagne_le?: string | null; suivi_le?: string | null; close_le?: string | null }

export interface Annees {
  suivi: number          // année du Suivi (onglet « Suivi N ») : la plus récente des années suivies
  budget: number         // année de l'onglet Budget : la campagne ouverte, sinon le budget de l'année suivie (en lecture)
  campagne: boolean      // une campagne est ouverte : le budget se construit, se propose, se valide
  aClore: number[]       // années encore suivies mais plus les plus récentes : la saisie y reste ouverte, de la plus récente à la plus ancienne
  passees: number[]      // années closes, de la plus récente à la plus ancienne
  pilotees: boolean      // les années viennent de la base (sinon du calendrier)
}

export function anneesDuCalendrier(aujourdhui: Date = new Date()): Annees {
  const n = aujourdhui.getFullYear(), campagne = aujourdhui.getMonth() >= 8
  return { suivi: n, budget: campagne ? n + 1 : n, campagne, aClore: [], passees: [], pilotees: false }
}

export function anneesDepuis(lignes: LigneAnnee[], aujourdhui: Date = new Date()): Annees {
  const valides = lignes.filter((l) => Number.isInteger(l.annee) && ['campagne', 'suivi', 'close'].includes(l.etat))
  const suivies = valides.filter((l) => l.etat === 'suivi').map((l) => l.annee).sort((a, b) => b - a)
  if (!suivies.length) return anneesDuCalendrier(aujourdhui)
  const suivi = suivies[0]
  const campagne = valides.filter((l) => l.etat === 'campagne' && l.annee > suivi).map((l) => l.annee).sort((a, b) => a - b)[0]
  return {
    suivi, budget: campagne ?? suivi, campagne: campagne !== undefined,
    aClore: suivies.slice(1),
    passees: valides.filter((l) => l.etat === 'close').map((l) => l.annee).sort((a, b) => b - a),
    pilotees: true,
  }
}

// Années proposées dans les saisies (réel du mois, comptes du quadrimestre) : l'année suivie, puis celles encore à
// clore ; à défaut, l'année d'avant (décembre et 3e quadrimestre se saisissent en début d'année)
export function anneesDeSaisie(a: Annees): number[] {
  return a.aClore.length ? [a.suivi, ...a.aClore] : [a.suivi, a.suivi - 1]
}

// Prochaine étape du Directeur, dans l'ordre de l'année : démarrer le suivi de la campagne, sinon en ouvrir une ;
// et clore les années encore suivies
export type EtapeAnnee = { quoi: 'ouvrir' | 'demarrer' | 'clore'; annee: number }
export function etapesAnnees(a: Annees): EtapeAnnee[] {
  if (!a.pilotees) return []
  return [
    a.campagne ? { quoi: 'demarrer' as const, annee: a.budget } : { quoi: 'ouvrir' as const, annee: a.suivi + 1 },
    ...[...a.aClore].reverse().map((annee) => ({ quoi: 'clore' as const, annee })),
  ]
}
