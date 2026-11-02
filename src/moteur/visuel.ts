import { QUADRIMESTRES, moisDuQuadrimestre, type Quadrimestre, type ResultatQuadrimestre } from './quadrimestre'
import type { Tresorerie, TresorerieGlissante } from './tresorerie'

// Refonte visuelle (2/11/2026, Joseph : « ok pour tout », sans le solde bancaire mensuel) : les calculs derrière les
// pastilles réel / prévu, le pont d'écart de l'EBE et le plan de trésorerie réel face au prévu. Aucun calcul dans les écrans.

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

// ── T2 : pastille d'une case réel / prévu. « favorable » : au prévu ou mieux ; « leger » : moins bien, dans le seuil ;
// « fort » : au-delà du seuil (celui de l'alerte CA des Paramètres réseau, 5 % par défaut). Pour une charge, dépenser
// moins que prévu est favorable. Sans prévu positif, pas de pastille.
export type NiveauEcart = 'favorable' | 'leger' | 'fort'
export function niveauEcart(reel: number | null, prevu: number | null, seuil: number, charge = false): NiveauEcart | null {
  if (reel === null || prevu === null || !(prevu > 0)) return null
  const ecart = (charge ? prevu - reel : reel - prevu) / prevu
  // Arrondi : un écart de quelques centimes ne passe pas en orange
  if (ecart >= -1e-9) return 'favorable'
  return ecart >= -seuil - 1e-9 ? 'leger' : 'fort'
}

// ── R3 : pont d'écart de l'EBE, du budget au réel, sur une période de quadrimestres saisis.
// Effet du CA = écart de CA × taux de marge du budget ; effet du taux de marge = écart de taux × CA réel ; chaque charge
// pèse de son écart au budget, en sens inverse. La somme des marches est exactement l'écart d'EBE.
export interface MarchePont { cle: string; libelle: string; montant: number }
export interface PontEBE { budget: number; reel: number; marches: MarchePont[] }
export function pontEBE(r: ResultatQuadrimestre): PontEBE | null {
  const b = r.budget
  if (!b || r.ebe === null || r.marge === null || r.chargesExternes === null || r.impotsTaxes === null || r.personnel === null) return null
  const tauxBudget = b.ca ? b.marge / b.ca : 0
  const volume = (r.ca - b.ca) * tauxBudget
  return {
    budget: b.ebe, reel: r.ebe,
    marches: [
      { cle: 'ca', libelle: 'Chiffre d’affaires', montant: volume },
      { cle: 'tauxMarge', libelle: 'Taux de marge', montant: r.marge - b.marge - volume },
      { cle: 'personnel', libelle: 'Personnel', montant: b.personnel - r.personnel },
      { cle: 'chargesExternes', libelle: 'Charges externes', montant: b.chargesExternes - r.chargesExternes },
      { cle: 'impotsTaxes', libelle: 'Impôts et taxes', montant: b.impotsTaxes - r.impotsTaxes },
    ],
  }
}

// ── P1 et P2 : plan de trésorerie de l'année en cours, réel face au prévu. Le réel de trésorerie se pilote au quadrimestre
// (Joseph, 2/11/2026) : le solde réel n'est connu qu'aux fins d'avril, d'août et de décembre. Chaque mois, l'encaissé réel
// est le CA TTC de la caisse, face aux ventes TTC prévues. Le décaissé réel d'un quadrimestre se déduit : solde de début
// + encaissé − solde de fin ; il se compare aux décaissements prévus moins les consignes remboursées (encaissées
// ailleurs que dans la caisse, elles sont donc nettes dans ce décaissé).
export interface MoisPlan {
  encReel: number | null
  encPrevu: number
  decPrevu: number            // décaissements prévus, consignes remboursées déduites
  finPrevue: number
  finReelle: number | null    // seulement en fin de quadrimestre saisi
  finProjetee: number | null  // après le dernier solde réel : ce solde, puis les flux de l'atterrissage
}
export interface QuadrimestrePlan {
  q: Quadrimestre
  debut: number | null; fin: number | null
  debutPrevu: number          // solde prévu en début de période (départ du prévu, puis fin prévue du quadrimestre d'avant)
  encReel: number | null; encPrevu: number
  decReel: number | null; decPrevu: number
  finPrevue: number
  ecart: number | null        // solde réel − solde prévu
}
export interface PlanTresorerie {
  mois: MoisPlan[]
  quadrimestres: QuadrimestrePlan[]
  dernierReel: { mois: number; montant: number; prevu: number; ecart: number } | null
  pointBas: { montant: number; mois: number; source: 'projection' | 'prevu' } | null
}

export function planTresorerie(prevue: Tresorerie, encaissementsReels: (number | null)[], soldes: Partial<Record<Quadrimestre, number | null>>,
  debutReel: number | null, projection: TresorerieGlissante | null, apresMois = -1): PlanTresorerie {
  const finDe = (q: Quadrimestre) => soldes[q] ?? null
  const mois: MoisPlan[] = prevue.mois.map((m, i) => ({
    encReel: encaissementsReels[i] ?? null,
    encPrevu: m.encaissements,
    decPrevu: m.decaissements - m.consignesRemboursees,
    finPrevue: m.fin,
    finReelle: (i + 1) % 4 === 0 ? finDe(((i + 1) / 4) as Quadrimestre) : null,
    finProjetee: null,
  }))
  if (projection) {
    mois[projection.depart.mois].finProjetee = projection.depart.montant
    for (const p of projection.mois) mois[p.mois].finProjetee = p.fin
  }
  const quadrimestres = QUADRIMESTRES.map((q): QuadrimestrePlan => {
    const ms = moisDuQuadrimestre(q)
    const debut = q === 1 ? debutReel : finDe((q - 1) as Quadrimestre)
    const fin = finDe(q)
    const encs = ms.map((i) => mois[i].encReel)
    const encReel = encs.every((v) => v !== null) ? somme(encs as number[]) : null
    const finPrevue = mois[ms[3]].finPrevue
    return {
      q, debut, debutPrevu: q === 1 ? prevue.debut : mois[ms[0] - 1].finPrevue, fin, encReel, encPrevu: somme(ms.map((i) => mois[i].encPrevu)),
      decReel: debut !== null && fin !== null && encReel !== null ? debut + encReel - fin : null,
      decPrevu: somme(ms.map((i) => mois[i].decPrevu)),
      finPrevue, ecart: fin === null ? null : fin - finPrevue,
    }
  })
  const dernierQ = [...quadrimestres].reverse().find((x) => x.fin !== null)
  const dernierReel = dernierQ ? { mois: dernierQ.q * 4 - 1, montant: dernierQ.fin!, prevu: dernierQ.finPrevue, ecart: dernierQ.ecart! } : null
  // Point bas à venir : sur la projection depuis le dernier solde réel, sinon sur le prévu des mois après « apresMois »
  const pointBas = projection && projection.mois.length
    ? { ...projection.mois.reduce((b, m) => (m.fin < b.montant ? { montant: m.fin, mois: m.mois } : b), { montant: projection.mois[0].fin, mois: projection.mois[0].mois }), source: 'projection' as const }
    : apresMois < 11
      ? { ...mois.slice(apresMois + 1).reduce((b, m, k) => (m.finPrevue < b.montant ? { montant: m.finPrevue, mois: apresMois + 1 + k } : b), { montant: Infinity, mois: apresMois + 1 }), source: 'prevu' as const }
      : null
  return { mois, quadrimestres, dernierReel, pointBas }
}

// Écart affiché au survol d'une case réel / prévu
export function ecartReelPrevu(reel: number | null, prevu: number | null): { montant: number; part: number | null } | null {
  if (reel === null || prevu === null) return null
  return { montant: reel - prevu, part: prevu > 0 ? reel / prevu - 1 : null }
}

// ── T3 : une ligne de tendance (Synthèse) : cumul réel et cumul de la référence (budget ou an dernier) sur les seuls mois
// où les deux sont connus, l'écart en euros et en part de la référence
export interface Tendance { reel: number; reference: number; ecart: number; part: number | null; mois: number }
export function tendance(reel: (number | null)[], reference: (number | null)[]): Tendance | null {
  const paires = reel.map((r, i) => [r, reference[i] ?? null] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null)
  if (!paires.length) return null
  const r = somme(paires.map((p) => p[0])), ref = somme(paires.map((p) => p[1]))
  return { reel: r, reference: ref, ecart: r - ref, part: ref > 0 ? r / ref - 1 : null, mois: paires.length }
}
