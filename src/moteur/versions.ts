import type { Budget } from './types'

// Versions du budget côte à côte (lot 26) : chiffres clés de chacune, écart à la première (le budget en cours)
export interface LigneVersions { cle: string; libelle: string; valeurs: number[]; ecarts: (number | null)[]; taux?: number[]; fort?: boolean; charge?: boolean }

export function comparerVersions(budgets: Budget[]): LigneVersions[] {
  const ligne = (cle: string, libelle: string, f: (b: Budget) => number, o: Partial<LigneVersions> = {}): LigneVersions => {
    const valeurs = budgets.map(f)
    return { cle, libelle, valeurs, ecarts: valeurs.map((v, i) => (i === 0 ? null : v - valeurs[0])), ...o }
  }
  const surCA = (f: (b: Budget) => number) => budgets.map((b) => (b.ca ? f(b) / b.ca : 0))
  return [
    ligne('ca', 'Chiffre d’affaires HT', (b) => b.ca, { fort: true }),
    ligne('marge', 'Marge commerciale', (b) => b.marge, { taux: surCA((b) => b.marge) }),
    ligne('externes', 'Charges externes', (b) => b.chargesExternes, { charge: true }),
    ligne('impots', 'Impôts et taxes', (b) => b.impotsTaxes, { charge: true }),
    ligne('personnel', 'Frais de personnel', (b) => b.personnel, { charge: true, taux: surCA((b) => b.personnel) }),
    ligne('ebe', 'EBE', (b) => b.ebe, { fort: true, taux: surCA((b) => b.ebe) }),
    ligne('net', 'Résultat net', (b) => b.resultatNet),
    ligne('tresorerie', 'Trésorerie dégagée après emprunts', (b) => b.tresorerieDegagee),
  ]
}
