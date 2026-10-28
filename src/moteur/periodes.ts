import type { LigneCompte } from './compteResultat'

// Regroupement des 12 mois par quadrimestre ou sur l'année (lot 27) : sommes des montants, dernier solde pour une
// trésorerie de fin de période, et CA par heure recalculé sur la période (CA total / heures totales, pas la moyenne des mois).
export type Periode = 'mois' | 'quadrimestre' | 'annee'

export const COLONNES: Record<Periode, number[][]> = {
  mois: Array.from({ length: 12 }, (_, i) => [i]),
  quadrimestre: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
  annee: [],
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

// Une série de 12 mois ramenée aux colonnes de la période ; « dernier » : solde de fin de période (trésorerie)
export function regrouper(valeurs: number[], periode: Periode, mode: 'somme' | 'dernier' = 'somme'): number[] {
  return COLONNES[periode].map((c) => (mode === 'dernier' ? valeurs[c[c.length - 1]] : somme(c.map((i) => valeurs[i]))))
}

// Compte de résultat par période : une ligne annuelle (sans montant mensuel) reste vide dans chaque colonne
export function regrouperCompte(lignes: LigneCompte[], periode: Periode): LigneCompte[] {
  const ca = lignes.find((l) => l.cle === 'ca')?.mois ?? []
  const heures = lignes.find((l) => l.cle === 'heures')?.mois ?? []
  const total = (serie: (number | null)[], c: number[]) => somme(c.map((i) => serie[i] ?? 0))
  return lignes.map((l) => ({
    ...l,
    mois: COLONNES[periode].map((c) => {
      if (c.every((i) => l.mois[i] === null)) return null
      if (l.cle === 'productivite') { const h = total(heures, c); return h ? total(ca, c) / h : null }
      return total(l.mois, c)
    }),
  }))
}
