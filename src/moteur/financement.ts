import type { Apport, Emprunt, Financement, Hypotheses, Investissement } from './types'

// Investissements & Financements (Joseph, 03/11/2026). Fonctions pures, testées dans tests/moteur/financement.spec.ts.
// - Investissement : payé HT le mois de sa mise en service, amorti en ligne sur sa durée à partir de ce mois
//   (dotation de l'année = montant ÷ durée × mois restants ÷ 12, mois de mise en service compris).
// - Nouvel emprunt : échéances mensuelles constantes ; capital encaissé le mois précédant la première échéance.
// - Emprunts en cours : intérêts et capital annuels repris des frais, payés par douzième jusqu'au dernier mois s'il est
//   saisi (un emprunt qui finit en avril ne compte que 4 mois).
// - Capacité d'autofinancement (CAF) = résultat net + dotations ; trésorerie dégagée = CAF − capital remboursé ;
//   variation de trésorerie de l'année (hors stock et TVA) = trésorerie dégagée − investissements + emprunts + apport.

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const moisValide = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12
const positif = (v: number | undefined) => (Number.isFinite(v) && v! > 0 ? v! : 0)

export const investissementsValides = (l: Investissement[] | undefined) => (l ?? []).filter((x) => moisValide(x.mois) && positif(x.montant) > 0)
export const empruntsValides = (l: Emprunt[] | undefined) => (l ?? []).filter((e) => moisValide(e.premiereEcheance) && positif(e.montant) > 0 && positif(e.duree) > 0)

export function dotationInvestissement(x: Investissement): number {
  if (!moisValide(x.mois) || !(x.duree > 0)) return 0
  return positif(x.montant) / x.duree * (13 - x.mois) / 12
}

// Échéance mensuelle constante d'un emprunt (taux annuel, durée en années)
export function echeanceMensuelle(e: Pick<Emprunt, 'montant' | 'taux' | 'duree'>): number {
  const n = Math.round(positif(e.duree) * 12), c = positif(e.montant), r = positif(e.taux) / 12
  if (!n) return 0
  return r > 0 ? c * r / (1 - (1 + r) ** -n) : c / n
}

// Intérêts et capital de l'emprunt pour chacun des 12 mois de l'année budgétée, mois d'encaissement (0 à 11)
export function echeancier(e: Emprunt): { interets: number[]; capital: number[]; echeance: number; encaisse: number } {
  const interets = Array(12).fill(0), capital = Array(12).fill(0)
  const n = Math.round(positif(e.duree) * 12), r = positif(e.taux) / 12, echeance = echeanceMensuelle(e)
  let reste = positif(e.montant)
  for (let k = 0, i = e.premiereEcheance - 1; k < n && i < 12; k++, i++) {
    const int = reste * r, cap = Math.min(reste, echeance - int)
    interets[i] = int; capital[i] = cap; reste -= cap
  }
  return { interets, capital, echeance, encaisse: Math.max(0, e.premiereEcheance - 2) }
}

// Investissement des travaux : payé le premier mois touché par les travaux (janvier sans fermeture)
export function moisTravaux(t: Hypotheses['travaux']): number {
  if (!t?.investissement) return -1
  return Math.max(0, t.activite?.findIndex((a) => a < 1) ?? 0)
}

// Tout le financement de l'année, sauf la CAF qui dépend du résultat net (voir avecCAF)
export function financementDe(h: Pick<Hypotheses, 'amortissements' | 'interets' | 'remboursementCapital' | 'finEmpruntsEnCours' | 'investissements' | 'emprunts' | 'apport' | 'travaux'>, dotationTravaux: number): Omit<Financement, 'echeancesSurCAF' | 'variation'> {
  const fin = moisValide(h.finEmpruntsEnCours ?? 0) ? h.finEmpruntsEnCours! : 12
  const parMois = (annuel: number) => Array.from({ length: 12 }, (_, i) => (i < fin ? positif(annuel) / 12 : 0))
  const interetsMois = parMois(h.interets), capitalMois = parMois(h.remboursementCapital)
  const interetsEnCours = somme(interetsMois), capitalEnCours = somme(capitalMois)
  const encaissementsMois = Array(12).fill(0)
  for (const e of empruntsValides(h.emprunts)) {
    const x = echeancier(e)
    x.interets.forEach((v, i) => { interetsMois[i] += v })
    x.capital.forEach((v, i) => { capitalMois[i] += v })
    encaissementsMois[x.encaisse] += positif(e.montant)
  }
  const apport: Apport | undefined = h.apport && moisValide(h.apport.mois) && positif(h.apport.montant) > 0 ? h.apport : undefined
  if (apport) encaissementsMois[apport.mois - 1] += apport.montant
  const investissementsMois = Array(12).fill(0)
  const invest = investissementsValides(h.investissements)
  for (const x of invest) investissementsMois[x.mois - 1] += x.montant
  const mt = moisTravaux(h.travaux)
  if (mt >= 0) investissementsMois[mt] += positif(h.travaux!.investissement)
  const nouveauxEmprunts = somme(empruntsValides(h.emprunts).map((e) => e.montant))
  return {
    dotationsEnCours: positif(h.amortissements),
    dotationsNouvelles: dotationTravaux + somme(invest.map(dotationInvestissement)),
    interetsEnCours, interetsNouveaux: somme(interetsMois) - interetsEnCours,
    capitalEnCours, capitalNouveau: somme(capitalMois) - capitalEnCours,
    interetsMois, capitalMois,
    investissements: somme(investissementsMois), investissementsMois,
    nouveauxEmprunts, apport: apport?.montant ?? 0, encaissementsMois,
    echeances: somme(interetsMois) + somme(capitalMois),
  }
}

export function avecCAF(f: Omit<Financement, 'echeancesSurCAF' | 'variation'>, caf: number): Financement {
  const degagee = caf - (f.capitalEnCours + f.capitalNouveau)
  return { ...f, echeancesSurCAF: caf > 0 ? f.echeances / caf : null, variation: degagee - f.investissements + f.nouveauxEmprunts + f.apport }
}
