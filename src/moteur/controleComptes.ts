import type { SaisieQuadrimestre } from './quadrimestre'

// Lot 42 (proposition 8) : comptes du quadrimestre contrôlés à la saisie. Les erreurs qui faussent l'EBE réel sont
// presque toujours les mêmes : achats saisis TTC, variation de stock au mauvais signe ou oubliée, montant d'un mois au
// lieu de quatre. Chaque contrôle pose une question, sans bloquer : le franchisé confirme s'il est sûr de son chiffre.
export type ChampCompte = keyof SaisieQuadrimestre
export interface Controle { champ: ChampCompte; gravite: 'question' | 'info'; texte: string }
export interface BudgetPeriode { achats: number; chargesExternes: number; impotsTaxes: number; personnel: number }

export const SEUILS_CONTROLE = {
  ecartMarge: 0.10,      // marge réelle à plus de 10 points de la marge théorique de la caisse
  personnel: [0.10, 0.60] as const, // frais de personnel en part du CA de la période
  externesMax: 0.50,     // charges externes en part du CA
  ecartBudget: 0.25,     // écart à la même période du budget
}

const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString('fr-FR')} %`

export function controlesQuadrimestre(s: SaisieQuadrimestre, ca: number, tauxMargeCaisse: number | null, tauxSurCA: number, budget?: BudgetPeriode | null): Controle[] {
  const l: Controle[] = []
  if (!(ca > 0)) return l
  if (s.achats !== null) {
    if (s.achats > ca) l.push({ champ: 'achats', gravite: 'question', texte: `Achats au-dessus du CA HT de la période (${pct(s.achats / ca)}) : le montant est-il bien HT, et sur les quatre mois ?` })
    else if (tauxMargeCaisse !== null) {
      const marge = (ca - (s.achats - (s.variationStock ?? 0))) / ca
      if (Math.abs(marge - tauxMargeCaisse) > SEUILS_CONTROLE.ecartMarge) {
        l.push({ champ: s.variationStock === null ? 'achats' : 'variationStock', gravite: 'question',
          texte: `Marge réelle à ${pct(marge)} pour ${pct(tauxMargeCaisse)} en caisse : achats bien HT ? Variation de stock dans le bon sens (une hausse du stock se saisit en positif) ?` })
      }
    }
    if (s.variationStock === null) l.push({ champ: 'variationStock', gravite: 'info', texte: 'Variation de stock vide : elle compte pour zéro. Si le stock a bougé sur la période, la marge réelle en sera faussée.' })
  }
  if (s.personnel !== null) {
    const r = s.personnel / ca
    if (r < SEUILS_CONTROLE.personnel[0] || r > SEUILS_CONTROLE.personnel[1]) l.push({ champ: 'personnel', gravite: 'question', texte: `Frais de personnel à ${pct(r)} du CA : le montant couvre-t-il bien les quatre mois, charges sociales comprises ?` })
  }
  if (s.chargesExternes !== null) {
    const r = s.chargesExternes / ca
    if (r < tauxSurCA) l.push({ champ: 'chargesExternes', gravite: 'question', texte: `Charges externes sous la redevance et la publicité (${pct(tauxSurCA)} du CA) : manque-t-il des factures ?` })
    else if (r > SEUILS_CONTROLE.externesMax) l.push({ champ: 'chargesExternes', gravite: 'question', texte: `Charges externes à ${pct(r)} du CA : des achats de marchandises y sont-ils passés ?` })
  }
  if (budget) {
    const champs: [ChampCompte, number | null, number, string][] = [
      ['achats', s.achats, budget.achats, 'Achats'], ['chargesExternes', s.chargesExternes, budget.chargesExternes, 'Charges externes'],
      ['impotsTaxes', s.impotsTaxes, budget.impotsTaxes, 'Impôts et taxes'], ['personnel', s.personnel, budget.personnel, 'Frais de personnel'],
    ]
    for (const [champ, v, b, nom] of champs) {
      if (v === null || !(b > 0) || l.some((c) => c.champ === champ && c.gravite === 'question')) continue
      const e = v / b - 1
      if (Math.abs(e) > SEUILS_CONTROLE.ecartBudget) l.push({ champ, gravite: 'question', texte: `${nom} ${e > 0 ? 'au-dessus' : 'au-dessous'} du budget de la période de ${pct(Math.abs(e))} : chiffre à confirmer.` })
    }
  }
  return l
}
