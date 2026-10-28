// Campagne des budgets (lot 28, 28/10/2026) : trois dates fixées par le Directeur dans Paramètres réseau, l'avancement
// par Responsable Régional et par Coach. Un budget est en retard s'il n'est pas proposé après la date de proposition,
// ou pas validé après la date de validation. Dates au format AAAA-MM-JJ, comparées comme du texte.

export interface Campagne { proposition: string; retour: string; validation: string }
type StatutBudget = 'propose' | 'en_discussion' | 'valide' | null

// Dates d'exemple, à corriger dans Paramètres réseau : mi-novembre, début et fin décembre de l'année d'avant
export const campagneParDefaut = (annee: number): Campagne => ({
  proposition: `${annee - 1}-11-15`, retour: `${annee - 1}-12-05`, validation: `${annee - 1}-12-19`,
})

export function enRetard(statut: StatutBudget, c: Campagne, aujourdhui: string): boolean {
  return (!statut && aujourdhui > c.proposition) || (statut !== 'valide' && aujourdhui > c.validation)
}

export interface Avancement { nom: string; magasins: number; aProposer: number; proposes: number; enDiscussion: number; valides: number; enRetard: number }

// Une ligne par responsable (un magasin peut avoir plusieurs RR), la plus en retard d'abord ; « Sans nom » si aucun
export function avancementCampagne(
  magasins: { statut: StatutBudget; responsables: string[] }[], c: Campagne, aujourdhui: string,
): Avancement[] {
  const lignes = new Map<string, Avancement>()
  for (const m of magasins) {
    for (const nom of m.responsables.length ? m.responsables : ['']) {
      const a = lignes.get(nom) ?? { nom, magasins: 0, aProposer: 0, proposes: 0, enDiscussion: 0, valides: 0, enRetard: 0 }
      a.magasins++
      if (!m.statut) a.aProposer++
      else if (m.statut === 'propose') a.proposes++
      else if (m.statut === 'en_discussion') a.enDiscussion++
      else a.valides++
      if (enRetard(m.statut, c, aujourdhui)) a.enRetard++
      lignes.set(nom, a)
    }
  }
  return [...lignes.values()].sort((a, b) => b.enRetard - a.enRetard || (a.nom === '' ? 1 : b.nom === '' ? -1 : a.nom.localeCompare(b.nom, 'fr')))
}
