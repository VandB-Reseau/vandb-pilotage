import type { Budget, Hypotheses } from './types'

// Trésorerie mois par mois du budget : ce qui entre et sort de la banque, TVA comprise, avec les délais de paiement.
// Hypothèse de régime établi : ce qui se paie en début d'année au titre de l'année précédente (achats de décembre,
// TVA et cotisations de décembre…) vaut le même mois du budget. Sur l'année, la trésorerie varie donc exactement de
// la trésorerie dégagée (EBE − intérêts − capital remboursé − impôt) moins l'investissement des travaux.

export interface ParametresTresorerie {
  delaiFournisseurs: number   // en mois : 1 = 30 jours fin de mois (achats de janvier payés fin février)
  delaiRedevance: number      // redevance et publicité, facturées sur le CA du mois
  tvaVentes: number           // TVA moyenne sur le CA (alcool à 20 %, restauration à 10 %)
  tvaAchats: number           // TVA sur les achats de marchandises
  tvaFrais: number            // TVA sur les frais, la redevance, la publicité et les travaux
  tvaTrimestrielle: boolean   // sinon mensuelle (régime réel normal)
  partCotisations: number     // part du coût du personnel payée le mois suivant (cotisations salariales et patronales)
}

// Valeurs par défaut (lot 10, 28/10/2026), à confirmer par Joseph : pratiques courantes, modifiables dans Paramètres réseau
export const tresorerieParDefaut: ParametresTresorerie = {
  delaiFournisseurs: 1,
  delaiRedevance: 1,
  tvaVentes: 0.19,
  tvaAchats: 0.2,
  tvaFrais: 0.2,
  tvaTrimestrielle: false,
  partCotisations: 0.4,
}

export interface MoisTresorerie {
  encaissements: number       // CA TTC encaissé
  fournisseurs: number        // achats TTC payés
  frais: number               // frais TTC (sans TVA pour la banque, les assurances, les impôts et taxes), redevance et publicité
  personnel: number           // salaires du mois et cotisations du mois précédent
  tva: number                 // TVA reversée (négative : crédit remboursé)
  emprunts: number            // intérêts et capital
  impot: number               // acomptes d'impôt sur les sociétés
  travaux: number             // investissement TTC, payé le premier mois des travaux
  decaissements: number
  flux: number
  fin: number                 // trésorerie en fin de mois
}

export interface Tresorerie {
  debut: number
  mois: MoisTresorerie[]
  fin: number
  pointBas: { montant: number; mois: number }   // mois de 0 (janvier) à 11
  moisNegatifs: number
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
// Valeur du mois i, décalée de « delai » mois ; avant janvier, le même mois de l'année (régime établi)
const decale = (l: number[], i: number, delai: number) => l[(((i - Math.round(delai)) % 12) + 12) % 12]
const SANS_TVA = new Set(['banque_assurances', 'impots_taxes'])

export function tresorerieBudget(b: Budget, h: Hypotheses, p: { tauxRedevance: number; tauxPublicite: number }, t: ParametresTresorerie, debut = 0): Tresorerie {
  const ca = b.mois.map((m) => m.ca)
  const achats = b.mois.map((m) => m.achats)
  const redevance = ca.map((c) => c * (p.tauxRedevance + p.tauxPublicite))
  // Frais du mois, avec ou sans TVA (même répartition que le compte de résultat : douzième + part du CA)
  const fraisAvecTva = ca.map((c) => somme(h.frais.filter((l) => !SANS_TVA.has(l.rubrique)).map((l) => (l.annuel ?? 0) / 12 + c * (l.tauxCA ?? 0))))
  const fraisSansTva = ca.map((c) => somme(h.frais.filter((l) => SANS_TVA.has(l.rubrique)).map((l) => (l.annuel ?? 0) / 12 + c * (l.tauxCA ?? 0))))
  const personnel = b.mois.map((m) => m.personnel)
  // Travaux : investissement payé le premier mois touché (janvier s'il n'y a pas de fermeture)
  const moisTravaux = h.travaux?.investissement ? Math.max(0, h.travaux.activite?.findIndex((a) => a < 1) ?? 0) : -1
  const investissement = Array.from({ length: 12 }, (_, i) => (i === moisTravaux ? Math.max(0, h.travaux!.investissement) : 0))

  // TVA due au titre de chaque mois : collectée sur les ventes, déduite sur les achats, les frais et les travaux du mois
  const tvaDue = ca.map((c, i) => c * t.tvaVentes - achats[i] * t.tvaAchats - (redevance[i] + fraisAvecTva[i] + investissement[i]) * t.tvaFrais)
  const tvaPayee = (i: number) => {
    if (!t.tvaTrimestrielle) return decale(tvaDue, i, 1)
    // Trimestre payé le mois suivant sa fin : avril, juillet, octobre, janvier
    if (i % 3 !== 0) return 0
    return somme([1, 2, 3].map((k) => decale(tvaDue, i, k)))
  }
  const impot = (i: number) => (i % 3 === 2 ? b.impot / 4 : 0)   // acomptes de mars, juin, septembre et décembre

  let solde = debut
  const mois = ca.map((c, i): MoisTresorerie => {
    const encaissements = c * (1 + t.tvaVentes)
    const fournisseurs = decale(achats, i, t.delaiFournisseurs) * (1 + t.tvaAchats)
    const frais = decale(redevance, i, t.delaiRedevance) * (1 + t.tvaFrais) + fraisAvecTva[i] * (1 + t.tvaFrais) + fraisSansTva[i]
    const salaires = personnel[i] * (1 - t.partCotisations) + decale(personnel, i, 1) * t.partCotisations
    const tva = tvaPayee(i)
    const emprunts = (h.interets + h.remboursementCapital) / 12
    const travaux = investissement[i] * (1 + t.tvaFrais)
    const decaissements = fournisseurs + frais + salaires + tva + emprunts + impot(i) + travaux
    const flux = encaissements - decaissements
    solde += flux
    return { encaissements, fournisseurs, frais, personnel: salaires, tva, emprunts, impot: impot(i), travaux, decaissements, flux, fin: solde }
  })
  const bas = mois.reduce((m, x, i) => (x.fin < mois[m].fin ? i : m), 0)
  return { debut, mois, fin: solde, pointBas: { montant: mois[bas].fin, mois: bas }, moisNegatifs: mois.filter((m) => m.fin < 0).length }
}
