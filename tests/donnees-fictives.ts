import type { Hypotheses } from '../src/moteur/types'

// Données fictives uniquement (dépôt public). Noms de magasins inventés.
export const magasinFictif: Hypotheses = {
  annee: 2027,
  moisRealises: 8,
  caMensuelReference: [60_000, 60_000, 60_000, 60_000, 60_000, 60_000, 60_000, 60_000, 80_000, 80_000, 80_000, 80_000],
  familles: [
    { univers: 'cave', famille: 'Bière', caRealise: 120_000, margeRealisee: 0.36, evolution: 0.05, margeCible: 0.38 },
    { univers: 'bar', famille: 'Fût', caRealise: 180_000, margeRealisee: 0.74, evolution: 0.1, margeCible: 0.75 },
    { univers: 'exterieur', famille: 'Événements', caRealise: 60_000, margeRealisee: 0.4, evolution: 0, margeCible: 0.4 },
  ],
  flux: { cave: { realise: 6_000, evolution: 0.03, panierCibleTTC: 24 } },
  personnel: { salairesMensuels: Array(12).fill(12_000), remunerationGerance: 4_000, tauxCotisationsGerance: 0.5, heuresMensuelles: Array(12).fill(880) },
  frais: [
    { code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000 },
    { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies', tauxCA: 0.013 },
    { code: 'honoraires_comptables', libelle: 'Honoraires comptables', rubrique: 'honoraires', annuel: 6_000 },
    { code: 'cfe', libelle: 'Cotisation foncière des entreprises', rubrique: 'impots_taxes', annuel: 3_000 },
  ],
  amortissements: 24_000,
  interets: 1_200,
  remboursementCapital: 30_000,
  deficitReportable: 0,
}

export const MAGASINS = ['Brionne-sur-Lac', 'Valcourt', 'Saint-Aubin-des-Prés']
