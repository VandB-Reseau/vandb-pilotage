import type { Apport, Emprunt, Financement, Hypotheses, Investissement, Pret } from './types'

// Investissements & Financements (Joseph, 03/11/2026). Fonctions pures, testées dans tests/moteur/financement.spec.ts.
// - Investissement : payé HT le mois de sa mise en service, amorti en ligne sur sa durée à partir de ce mois
//   (dotation de l'année = montant ÷ durée × mois restants ÷ 12, mois de mise en service compris).
// - Nouvel emprunt : échéances mensuelles constantes ; capital encaissé le mois précédant la première échéance.
// - Prêts du magasin (fiche du magasin) : leur échéancier de l'année, prêt par prêt. Un prêt saisi est déjà dépensé
//   (Joseph, 03/11/2026) : il n'entre jamais en trésorerie, seules ses échéances sortent. Ils remplacent les intérêts
//   d'emprunts et le capital des frais (voir avecPrets).
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

// ── Prêts du magasin (Joseph, 03/11/2026) : un échéancier mois par mois, lu pour n'importe quelle année
const MAX_ECHEANCES = 600
const moisAbsolu = (aaaamm: string) => { const m = /^(\d{4})-(\d{2})$/.exec(aaaamm); return m && +m[2] >= 1 && +m[2] <= 12 ? +m[1] * 12 + +m[2] - 1 : null }
export const versAAAAMM = (abs: number) => `${Math.floor(abs / 12)}-${String((abs % 12) + 1).padStart(2, '0')}`
export function pretValide(p: Pret): boolean {
  if (moisAbsolu(p.debut) === null || !(positif(p.montant) > 0)) return false
  return p.mode === 'restant' ? positif(p.mensualite) > positif(p.montant) * positif(p.taux) / 12 : positif(p.duree) * 12 > Math.max(0, p.differe ?? 0)
}
export const pretsValides = (l: Pret[] | undefined) => (l ?? []).filter(pretValide)
// Échéance d'amortissement constante (après le différé) ; « restant » : la mensualité saisie
export function mensualitePret(p: Pret): number {
  if (p.mode === 'restant') return positif(p.mensualite)
  const d = Math.max(0, Math.round(p.differe ?? 0))
  return echeanceMensuelle({ montant: p.montant, taux: p.taux, duree: Math.max(0, positif(p.duree) - d / 12) })
}
// Toutes les échéances : mois (absolu), intérêts, capital ; plus le mois et le montant encaissés (prêt « initial »)
export function echeancesPret(p: Pret): { echeances: { mois: number; interets: number; capital: number }[]; encaisse: { mois: number; montant: number } | null } {
  const debut = moisAbsolu(p.debut)
  if (debut === null || !pretValide(p)) return { echeances: [], encaisse: null }
  const r = positif(p.taux) / 12, l: { mois: number; interets: number; capital: number }[] = []
  let reste = positif(p.montant)
  if (p.mode === 'restant') {
    const m = positif(p.mensualite)
    for (let k = 0; reste > 0.005 && k < MAX_ECHEANCES; k++) {
      const int = reste * r, cap = Math.min(reste, m - int)
      l.push({ mois: debut + k, interets: int, capital: cap }); reste -= cap
    }
    return { echeances: l, encaisse: null }
  }
  const n = Math.round(positif(p.duree) * 12), d = Math.min(n - 1, Math.max(0, Math.round(p.differe ?? 0))), m = mensualitePret(p)
  for (let k = 0; k < n; k++) {
    const int = reste * r, cap = k < d ? 0 : k === n - 1 ? reste : Math.min(reste, m - int)
    l.push({ mois: debut + k, interets: int, capital: cap }); reste -= cap
  }
  return { echeances: l, encaisse: { mois: debut - 1, montant: positif(p.montant) } }
}
// Dernière échéance (AAAA-MM) et capital restant dû au 1er janvier d'une année
export function finPret(p: Pret): string | null { const e = echeancesPret(p).echeances; return e.length ? versAAAAMM(e[e.length - 1].mois) : null }
export function restantDu(p: Pret, annee: number): number {
  const x = echeancesPret(p), debutAnnee = annee * 12
  if (x.encaisse && x.encaisse.mois >= debutAnnee) return 0
  return Math.max(0, positif(p.montant) - somme(x.echeances.filter((e) => e.mois < debutAnnee).map((e) => e.capital)))
}
// Intérêts et capital des prêts, mois par mois, sur une année ; « nouveaux » : prêts signés dans l'année (le mois avant
// leur 1re échéance), « enCours » : les autres. encaissementsMois et montant ne disent que la signature : aucun flux de trésorerie
export interface PretsAnnee { interetsMois: number[]; capitalMois: number[]; encaissementsMois: number[]; enCours: { interets: number; capital: number }; nouveaux: { interets: number; capital: number; montant: number } }
export function pretsDeLAnnee(prets: Pret[] | undefined, annee: number): PretsAnnee {
  const r: PretsAnnee = { interetsMois: Array(12).fill(0), capitalMois: Array(12).fill(0), encaissementsMois: Array(12).fill(0), enCours: { interets: 0, capital: 0 }, nouveaux: { interets: 0, capital: 0, montant: 0 } }
  const debutAnnee = annee * 12
  for (const p of pretsValides(prets)) {
    const x = echeancesPret(p)
    const nouveau = !!x.encaisse && x.encaisse.mois >= debutAnnee && x.encaisse.mois < debutAnnee + 12
    if (x.encaisse && x.encaisse.mois >= debutAnnee + 12) continue
    if (nouveau) { r.encaissementsMois[x.encaisse!.mois - debutAnnee] += x.encaisse!.montant; r.nouveaux.montant += x.encaisse!.montant }
    for (const e of x.echeances) {
      const i = e.mois - debutAnnee
      if (i < 0 || i > 11) continue
      r.interetsMois[i] += e.interets; r.capitalMois[i] += e.capital
      const cible = nouveau ? r.nouveaux : r.enCours
      cible.interets += e.interets; cible.capital += e.capital
    }
  }
  return r
}

// Investissement des travaux : payé le premier mois touché par les travaux (janvier sans fermeture)
export function moisTravaux(t: Hypotheses['travaux']): number {
  if (!t?.investissement) return -1
  return Math.max(0, t.activite?.findIndex((a) => a < 1) ?? 0)
}

// Tout le financement de l'année, sauf la CAF qui dépend du résultat net (voir avecCAF)
export function financementDe(h: Pick<Hypotheses, 'annee' | 'amortissements' | 'interets' | 'remboursementCapital' | 'finEmpruntsEnCours' | 'investissements' | 'emprunts' | 'apport' | 'travaux' | 'prets'>, dotationTravaux: number): Omit<Financement, 'echeancesSurCAF' | 'variation'> {
  // Avec des prêts saisis, leur échéancier fait foi : le « dernier mois des emprunts en cours » ne sert plus
  const prets = h.prets?.length ? pretsDeLAnnee(h.prets, h.annee) : null
  const fin = !prets && moisValide(h.finEmpruntsEnCours ?? 0) ? h.finEmpruntsEnCours! : 12
  const parMois = (annuel: number) => Array.from({ length: 12 }, (_, i) => (i < fin ? positif(annuel) / 12 : 0))
  const interetsMois = parMois(h.interets), capitalMois = parMois(h.remboursementCapital)
  if (prets) prets.interetsMois.forEach((_, i) => { interetsMois[i] += prets.interetsMois[i]; capitalMois[i] += prets.capitalMois[i] })
  const interetsEnCours = somme(interetsMois) - (prets?.nouveaux.interets ?? 0), capitalEnCours = somme(capitalMois) - (prets?.nouveaux.capital ?? 0)
  const encaissementsMois = Array(12).fill(0)   // les prêts du magasin n'apportent pas d'argent
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

// Les prêts saisis remplacent la ligne « Intérêts sur emprunts » et le capital remboursé des frais ou des comptes :
// interets ne garde que les comptes courants et les agios (autresInterets), remboursementCapital passe à 0
export function avecPrets<T extends Pick<Hypotheses, 'interets' | 'remboursementCapital' | 'prets'>>(h: T, prets: Pret[] | undefined, autresInterets: number): T {
  if (!pretsValides(prets).length) return h
  return { ...h, prets: pretsValides(prets), interets: positif(autresInterets), remboursementCapital: 0 }
}

// Intérêts et capital des prêts sur deux années (frais de l'année en cours face au budget) ; null sans prêt saisi
export function pretsDeuxAnnees(prets: Pret[] | undefined, anneeAvant: number, anneeApres: number): { avant: { interets: number; capital: number }; apres: { interets: number; capital: number } } | null {
  if (!pretsValides(prets).length) return null
  const total = (a: number) => { const x = pretsDeLAnnee(prets, a); return { interets: x.enCours.interets + x.nouveaux.interets, capital: x.enCours.capital + x.nouveaux.capital } }
  return { avant: total(anneeAvant), apres: total(anneeApres) }
}
