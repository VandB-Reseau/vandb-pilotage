import type { FicheVisite, SujetVisite } from './visite'

// « Ma semaine » du Coach et du RR (lot 29, 28/10/2026) : les magasins du périmètre classés par la marge en jeu depuis
// janvier (la somme des trois sujets de la fiche de visite), avec le premier sujet, les alertes et les actions en retard.
// Le RR et le Directeur ont aussi la même chose regroupée par Coach.

export interface LigneSemaine {
  magasin: string; coach: string
  enJeu: number; sujet: SujetVisite | null
  alertes: number; actionsEnRetard: number
}
export interface LigneCoach { coach: string; magasins: number; aSuivre: number; enJeu: number; alertes: number; actionsEnRetard: number }

export function maSemaine(
  magasins: { magasin: string; coach: string; fiche: FicheVisite }[],
  alertes: { magasin: string }[],
  actions: { magasin: string; statut: string; echeance: string | null }[],
  aujourdhui: string,   // AAAA-MM-JJ
): LigneSemaine[] {
  return magasins.map((m) => ({
    magasin: m.magasin, coach: m.coach,
    enJeu: m.fiche.sujets.reduce((a, s) => a + s.enJeu, 0), sujet: m.fiche.sujets[0] ?? null,
    alertes: alertes.filter((a) => a.magasin === m.magasin).length,
    actionsEnRetard: actions.filter((a) => a.magasin === m.magasin && a.statut === 'a_faire' && a.echeance !== null && a.echeance < aujourdhui).length,
  })).sort((a, b) => b.enJeu - a.enJeu || b.actionsEnRetard - a.actionsEnRetard || a.magasin.localeCompare(b.magasin, 'fr'))
}

// Par Coach : le plus de marge en jeu d'abord ; « » regroupe les magasins sans Coach
export function parCoach(l: LigneSemaine[]): LigneCoach[] {
  const r = new Map<string, LigneCoach>()
  for (const x of l) {
    const c = r.get(x.coach) ?? { coach: x.coach, magasins: 0, aSuivre: 0, enJeu: 0, alertes: 0, actionsEnRetard: 0 }
    c.magasins++
    if (x.enJeu > 0) c.aSuivre++
    c.enJeu += x.enJeu
    c.alertes += x.alertes
    c.actionsEnRetard += x.actionsEnRetard
    r.set(x.coach, c)
  }
  return [...r.values()].sort((a, b) => b.enJeu - a.enJeu || a.coach.localeCompare(b.coach, 'fr'))
}
