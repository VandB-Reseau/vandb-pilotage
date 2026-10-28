import { UNIVERS, type Budget, type Hypotheses, type Univers } from './types'

// Trésorerie mois par mois du budget : ce qui entre et sort de la banque, TVA comprise, avec les délais de paiement.
// Hypothèse de régime établi : ce qui se paie en début d'année au titre de l'année précédente (achats de décembre,
// TVA et cotisations de décembre…) vaut le même mois du budget. Sur l'année, la trésorerie varie donc exactement de
// la trésorerie dégagée (EBE − intérêts − capital remboursé − impôt) moins l'investissement des travaux ; les consignes
// ne changent rien sur l'année mais creusent les mois où les achats montent (l'encours au 1er janvier est déjà dans la
// trésorerie de départ).

export interface ParametresTresorerie {
  delaiFournisseurs: number   // en mois : 1 = 30 jours fin de mois (achats de janvier payés fin février)
  delaiRedevance: number      // redevance et publicité, facturées sur le CA du mois
  tvaVentes: number           // TVA moyenne sur le CA (alcool à 20 %, restauration à 10 %)
  tvaAchats: number           // TVA sur les achats de marchandises
  tvaFrais: number            // TVA sur les frais, la redevance, la publicité et les travaux
  tvaTrimestrielle: boolean   // sinon mensuelle (régime réel normal)
  partCotisations: number     // part du coût du personnel payée le mois suivant (cotisations salariales et patronales)
  // Lot 24 : fûts et tireuses de l'Extérieur payés avant la vente (en mois), et calendrier des opérations du réseau
  // (foire aux vins…) : une part des achats du mois de vente payée à un autre mois. Mois de 1 à 12.
  avanceExterieur?: number
  operations?: OperationReseau[]
  // Consignes (fûts, caisses, bouteilles de gaz) : hors TVA et hors compte de résultat, elles décalent la trésorerie
  consignes?: {
    achats: Record<Univers, number>   // consigne payée aux fournisseurs, en part des achats de l'univers
    ecoulement: number                // mois pour vider le fût et le rendre au fournisseur
    remboursement: number             // mois de remboursement après le retour (1 = 30 jours fin de mois)
  }
}

export interface OperationReseau { nom: string; mois: number; moisPaiement: number; part: number }

// Valeurs par défaut (lot 10, 28/10/2026), à confirmer par Joseph : pratiques courantes, modifiables dans Paramètres réseau
export const tresorerieParDefaut: ParametresTresorerie = {
  delaiFournisseurs: 1,
  delaiRedevance: 1,
  tvaVentes: 0.19,
  tvaAchats: 0.2,
  tvaFrais: 0.2,
  tvaTrimestrielle: false,
  partCotisations: 0.4,
  // Joseph (28/10/2026) : le stock des marchés extérieurs est payé le mois précédent
  avanceExterieur: 1,
  operations: [],
  // Joseph (28/10/2026) : remboursé à 30 jours fin de mois une fois le fût fini ; taux et délais modifiables. Les cautions
  // des clients sont des empreintes bancaires, jamais encaissées : elles ne comptent pas.
  consignes: { achats: { cave: 0.03, bar: 0.15, exterieur: 0.15 }, ecoulement: 1, remboursement: 1 },
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
  consignesVersees: number    // consignes payées aux fournisseurs avec les achats du mois
  consignesRemboursees: number // vides rendus aux fournisseurs, remboursés
  consignesEnAttente: number  // fin de mois : consignes payées aux fournisseurs, pas encore remboursées
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
  consignesMoyennes: number   // argent avancé en moyenne aux fournisseurs (part du besoin en fonds de roulement)
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
// Valeur du mois i, décalée de « delai » mois ; avant janvier, le même mois de l'année (régime établi)
const decale = (l: number[], i: number, delai: number) => l[(((i - Math.round(delai)) % 12) + 12) % 12]
const SANS_TVA = new Set(['banque_assurances', 'impots_taxes'])

// Achats HT payés chaque mois (mois de 0 à 11, régime établi : ce qui tombe hors de l'année revient au même mois).
// Délai des fournisseurs, sauf l'Extérieur payé avant la vente ; temps forts au mois saisi sur leur ligne ; opérations du
// réseau : la part avancée des achats Cave et Bar du mois de vente part au mois de paiement.
export function paiementsAchats(b: Budget, t: ParametresTresorerie): number[] {
  const paiements = Array(12).fill(0)
  const payer = (mois: number, montant: number) => { paiements[((Math.round(mois) % 12) + 12) % 12] += montant }
  const operations = (t.operations ?? []).filter((o) => o.mois >= 1 && o.mois <= 12 && o.moisPaiement >= 1 && o.moisPaiement <= 12 && o.part > 0)
  b.mois.forEach((m, j) => {
    if (!m.univers) { payer(j + t.delaiFournisseurs, m.achats); return }
    // Opérations du réseau (en magasin : Cave et Bar) ; des parts qui dépassent 100 % sont ramenées à 100 %
    const ops = operations.filter((o) => o.mois === j + 1)
    const totalPart = somme(ops.map((o) => o.part)), echelle = totalPart > 1 ? 1 / totalPart : 1
    for (const u of UNIVERS) {
      const courant = m.univers[u].achats - m.univers[u].achatsTempsForts
      if (u === 'exterieur') { payer(j - (t.avanceExterieur ?? 0), courant); continue }
      payer(j + t.delaiFournisseurs, courant * (1 - totalPart * echelle))
      for (const o of ops) payer(o.moisPaiement - 1, courant * o.part * echelle)
    }
  })
  for (const x of b.paiementsTempsForts ?? []) payer(x.mois, x.montant)
  return paiements
}

export function tresorerieBudget(b: Budget, h: Hypotheses, p: { tauxRedevance: number; tauxPublicite: number }, t: ParametresTresorerie, debut = 0): Tresorerie {
  const ca = b.mois.map((m) => m.ca)
  const achats = b.mois.map((m) => m.achats)
  const paiements = paiementsAchats(b, t)
  const chargesTempsForts = b.mois.map((m) => m.autresChargesTempsForts ?? 0)
  const redevance = ca.map((c) => c * (p.tauxRedevance + p.tauxPublicite))
  // Frais du mois, avec ou sans TVA (même répartition que le compte de résultat : douzième + part du CA)
  const fraisAvecTva = ca.map((c) => somme(h.frais.filter((l) => !SANS_TVA.has(l.rubrique)).map((l) => (l.annuel ?? 0) / 12 + c * (l.tauxCA ?? 0))))
  const fraisSansTva = ca.map((c) => somme(h.frais.filter((l) => SANS_TVA.has(l.rubrique)).map((l) => (l.annuel ?? 0) / 12 + c * (l.tauxCA ?? 0))))
  const personnel = b.mois.map((m) => m.personnel)
  // Travaux : investissement payé le premier mois touché (janvier s'il n'y a pas de fermeture)
  const moisTravaux = h.travaux?.investissement ? Math.max(0, h.travaux.activite?.findIndex((a) => a < 1) ?? 0) : -1
  const investissement = Array.from({ length: 12 }, (_, i) => (i === moisTravaux ? Math.max(0, h.travaux!.investissement) : 0))

  // TVA due au titre de chaque mois : collectée sur les ventes, déduite sur les achats, les frais et les travaux du mois
  const tvaDue = ca.map((c, i) => c * t.tvaVentes - achats[i] * t.tvaAchats - (redevance[i] + fraisAvecTva[i] + chargesTempsForts[i] + investissement[i]) * t.tvaFrais)
  const tvaPayee = (i: number) => {
    if (!t.tvaTrimestrielle) return decale(tvaDue, i, 1)
    // Trimestre payé le mois suivant sa fin : avril, juillet, octobre, janvier
    if (i % 3 !== 0) return 0
    return somme([1, 2, 3].map((k) => decale(tvaDue, i, k)))
  }
  const impot = (i: number) => (i % 3 === 2 ? b.impot / 4 : 0)   // acomptes de mars, juin, septembre et décembre

  // Consignes : achats et CA de chaque univers répartis comme le CA du mois
  const c = t.consignes
  const parUnivers = (f: (u: Univers) => number) => ca.map((caMois) => (b.ca ? somme(UNIVERS.map((u) => f(u))) * caMois / b.ca : 0))
  const familles = b.familles ?? []
  const versees = c ? parUnivers((u) => somme(familles.filter((f) => f.univers === u).map((f) => f.objectif - f.margeObjectif)) * (c.achats[u] ?? 0)) : Array(12).fill(0)
  const retour = Math.max(0, Math.round((c?.ecoulement ?? 0) + (c?.remboursement ?? 0)))
  // Encours en fin de mois : consignes du mois et des mois dont le remboursement n'est pas encore arrivé
  const enAttente = (i: number) => somme(Array.from({ length: retour }, (_, k) => decale(versees, i, k)))

  let solde = debut
  const mois = ca.map((c, i): MoisTresorerie => {
    const encaissements = c * (1 + t.tvaVentes)
    const fournisseurs = paiements[i] * (1 + t.tvaAchats)
    const frais = decale(redevance, i, t.delaiRedevance) * (1 + t.tvaFrais) + (fraisAvecTva[i] + chargesTempsForts[i]) * (1 + t.tvaFrais) + fraisSansTva[i]
    const salaires = personnel[i] * (1 - t.partCotisations) + decale(personnel, i, 1) * t.partCotisations
    const tva = tvaPayee(i)
    const emprunts = (h.interets + h.remboursementCapital) / 12
    const travaux = investissement[i] * (1 + t.tvaFrais)
    const consignesVersees = versees[i], consignesRemboursees = decale(versees, i, retour)
    const decaissements = fournisseurs + frais + salaires + tva + emprunts + impot(i) + travaux + consignesVersees
    const flux = encaissements + consignesRemboursees - decaissements
    solde += flux
    return {
      encaissements, fournisseurs, frais, personnel: salaires, tva, emprunts, impot: impot(i), travaux,
      consignesVersees, consignesRemboursees, consignesEnAttente: enAttente(i), decaissements, flux, fin: solde,
    }
  })
  const bas = mois.reduce((m, x, i) => (x.fin < mois[m].fin ? i : m), 0)
  return {
    debut, mois, fin: solde, pointBas: { montant: mois[bas].fin, mois: bas }, moisNegatifs: mois.filter((m) => m.fin < 0).length,
    consignesMoyennes: somme(mois.map((m) => m.consignesEnAttente)) / 12,
  }
}

// Trésorerie glissante (lot 17, 28/10/2026) : la trésorerie réelle de fin de quadrimestre, puis les flux des mois
// suivants tirés de l'atterrissage de l'année (même calcul que la trésorerie du budget).
export interface TresorerieGlissante {
  depart: { montant: number; mois: number }          // fin du mois (0 à 11) où la trésorerie est connue
  mois: { mois: number; flux: number; fin: number }[] // mois suivants, jusqu'à décembre
  fin: number
  pointBas: { montant: number; mois: number }
  moisNegatifs: number
}
export function tresorerieGlissante(t: Tresorerie, depart: { montant: number; mois: number }): TresorerieGlissante {
  let solde = depart.montant
  const mois = t.mois.slice(depart.mois + 1).map((m, k) => ({ mois: depart.mois + 1 + k, flux: m.flux, fin: (solde += m.flux) }))
  const bas = mois.reduce<{ montant: number; mois: number }>((b, m) => (m.fin < b.montant ? { montant: m.fin, mois: m.mois } : b), { montant: depart.montant, mois: depart.mois })
  return { depart, mois, fin: solde, pointBas: bas, moisNegatifs: mois.filter((m) => m.fin < 0).length }
}

// Plus grosse sortie d'un mois (lot 27, au survol du graphique de trésorerie) ; null si le mois ne décaisse rien
export const SORTIES: (keyof MoisTresorerie)[] = ['fournisseurs', 'frais', 'personnel', 'tva', 'emprunts', 'impot', 'travaux', 'consignesVersees']
export function plusGrosseSortie(m: MoisTresorerie): { cle: keyof MoisTresorerie; montant: number } | null {
  const cle = SORTIES.reduce((a, c) => (m[c] > m[a] ? c : a), SORTIES[0])
  return m[cle] > 0 ? { cle, montant: m[cle] } : null
}
