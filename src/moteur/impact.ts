import type { Cibles } from './cibles'
import { changementsCibles } from './changements'
import type { Budget, LigneFrais } from './types'

// Panneau « Impact » (Joseph, 03/11/2026, proposition 1) : à chaque changement d'hypothèse, ce que deviennent le CA, la
// marge, la masse salariale, l'EBE, le résultat net et le point bas de trésorerie, face à une référence (ce qui est
// enregistré, ou la proposition du siège). Le dernier changement s'isole pour être lu et annulé d'un clic.

export type CleImpact = 'ca' | 'marge' | 'personnel' | 'ebe' | 'resultatNet' | 'pointBas'
export interface Indicateur {
  cle: CleImpact
  valeur: number
  ecart: number            // valeur − référence
  taux?: number            // marge : taux de marge ; personnel : % FP ; EBE : EBE ÷ CA
  ecartTaux?: number       // écart du taux, en fraction (0,003 = 0,3 point)
  mois?: number            // point bas : mois de 0 (janvier) à 11
  hausseFavorable: boolean // la masse salariale qui monte se lit en rouge
}
interface PointBas { pointBas: { montant: number; mois: number } }

export function impactBudget(b: Budget, ref: Budget, t?: PointBas | null, tRef?: PointBas | null): Indicateur[] {
  const l: Indicateur[] = [
    { cle: 'ca', valeur: b.ca, ecart: b.ca - ref.ca, hausseFavorable: true },
    { cle: 'marge', valeur: b.marge, ecart: b.marge - ref.marge, taux: b.tauxMarge, ecartTaux: b.tauxMarge - ref.tauxMarge, hausseFavorable: true },
    { cle: 'personnel', valeur: b.personnel, ecart: b.personnel - ref.personnel, taux: b.ratios.pctFP, ecartTaux: b.ratios.pctFP - ref.ratios.pctFP, hausseFavorable: false },
    { cle: 'ebe', valeur: b.ebe, ecart: b.ebe - ref.ebe, taux: b.ratios.ebeSurCA, ecartTaux: b.ratios.ebeSurCA - ref.ratios.ebeSurCA, hausseFavorable: true },
    { cle: 'resultatNet', valeur: b.resultatNet, ecart: b.resultatNet - ref.resultatNet, hausseFavorable: true },
  ]
  if (t) l.push({ cle: 'pointBas', valeur: t.pointBas.montant, ecart: tRef ? t.pointBas.montant - tRef.pointBas.montant : 0, mois: t.pointBas.mois, hausseFavorable: true })
  return l
}

// Colonne « Effet » en EBE (proposition 2) : un gain de CA d'un univers rapporte sa marge (démarque déduite), moins ce qui
// se paie en part du CA (redevance, publicité, frais au pourcentage du CA). L'équipe ne dépend pas du CA dans le budget.
export function tauxSurCA(frais: LigneFrais[], p: { tauxRedevance: number; tauxPublicite: number }): number {
  return p.tauxRedevance + p.tauxPublicite + frais.reduce((s, l) => s + (l.tauxCA ?? 0), 0)
}
export function effetEbeDuCA(effetCA: number | null, tauxMargeUnivers: number, surCA: number): number | null {
  return effetCA === null ? null : effetCA * (tauxMargeUnivers - surCA)
}

const pareil = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const clesChangees = (a: Cibles, b: Cibles) => changementsCibles(a, b).map((c) => c.cle).sort().join('|')

// Le dernier changement : les hypothèses telles qu'avant lui. Une frappe de plus dans le même champ (« 1 » puis « 12 »)
// prolonge le même changement ; un autre champ en ouvre un nouveau. Rien quand on revient à ce qui est enregistré.
export function suivreDernier(avant: Cibles | null, precedent: Cibles, actuel: Cibles, enregistre: Cibles): Cibles | null {
  if (pareil(actuel, enregistre)) return null
  if (pareil(actuel, precedent)) return avant
  if (avant && !pareil(avant, precedent) && clesChangees(avant, precedent) === clesChangees(precedent, actuel)) return pareil(avant, actuel) ? null : avant
  return precedent
}

// Libellé du dernier changement : « Tickets Cave », « Marge visée Cave » quand la marge de l'univers a écrit chaque famille
export function libelleDernier(avant: Cibles, actuel: Cibles, nomsFrais: Record<string, string> = {}): string {
  const l = changementsCibles(avant, actuel, nomsFrais)
  if (!l.length) return ''
  if (l.length === 1) return l[0].libelle
  const [k] = l[0].cle.split('/')
  const univers = new Set(l.map((c) => c.cle.split('/')[1]))
  if (l.every((c) => c.cle.startsWith(`${k}/`)) && univers.size === 1 && (k === 'margeFamille' || k === 'demarqueFamille')) {
    return `${k === 'margeFamille' ? 'Marge visée' : 'Démarque'} ${l[0].libelle.replace(/^.*\((.*)\)$/, '$1')}`
  }
  return `${l.length} hypothèses`
}
