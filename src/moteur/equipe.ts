// Équipe d'un magasin et masse salariale chargée, personne par personne (Joseph, 27/10/2026) :
// - une ligne par poste (« Vendeur 1 », « Vendeur 2 »), sans nom ; le gérant y figure s'il se rémunère (souvent TNS) ;
// - charges patronales : un taux par catégorie, moins la réduction générale dégressive unique (RGDU, ex-réduction Fillon),
//   calculée sur le brut annuel de chaque salarié, maximale au SMIC, nulle à 3 SMIC ; pas de réduction pour un gérant TNS ;
// - primes annuelles versées le mois choisi, pas de 13e mois ; entrées et sorties au mois ;
// - primes d'équipe (lot 26) : une enveloppe sans heures ni salaire, chargée au taux de sa catégorie, sans réduction
//   (la réduction dépend du salaire de chaque bénéficiaire, inconnu ici : le coût n'est pas sous-estimé).
// Fonction pure, testée dans tests/moteur/equipe.spec.ts.

export type Categorie = 'employe' | 'agent_maitrise' | 'cadre' | 'apprenti' | 'gerant_tns'
export const CATEGORIES: Categorie[] = ['employe', 'agent_maitrise', 'cadre', 'apprenti', 'gerant_tns']
export const categorieLibelle: Record<Categorie, string> = {
  employe: 'Employé', agent_maitrise: 'Agent de maîtrise', cadre: 'Cadre', apprenti: 'Apprenti', gerant_tns: 'Gérant TNS',
}

export interface Prime { mois: number; montant: number }
export interface Personne {
  id?: number
  poste: string
  categorie: Categorie
  heuresHebdo: number
  brutMensuel: number      // rémunération mensuelle pour un gérant TNS
  primes: Prime[]
  entree: string | null    // « AAAA-MM » ; null : déjà là au 1er janvier
  sortie: string | null    // « AAAA-MM », dernier mois travaillé ; null : pas de départ prévu
  heuresSaisie?: 'semaine' | 'mois'  // unité choisie à la saisie (lot 26) ; le calcul part toujours des heures par semaine
  enveloppe?: boolean      // primes d'équipe sans salarié (lot 26) : ni heures ni salaire, charges de la catégorie, sans réduction
}

// Heures par mois ↔ heures par semaine : 52 semaines sur 12 mois
export const SEMAINES_PAR_MOIS = 52 / 12

export interface ParametresCharges {
  taux: Record<Categorie, number>   // charges patronales avant réduction, en part du brut
  reduction: {
    smicAnnuel: number              // SMIC annuel brut pour 35 heures par semaine
    tmin: number
    tdelta: number
    puissance: number
    horsReduction: number           // part du taux que la réduction ne couvre pas (formation, taxe d'apprentissage)
  }
}

export interface CoutPersonne {
  personne: Personne
  brut: number[]; charges: number[]; reduction: number[]; cout: number[]; heures: number[]  // 12 mois
  brutAnnuel: number; coutAnnuel: number; coefficient: number; tauxEffectif: number; etp: number
}
export interface MasseSalariale {
  personnes: CoutPersonne[]
  parMois: { brut: number; charges: number; reduction: number; cout: number; heures: number }[]
  brut: number; charges: number; reduction: number; cout: number; etp: number; tauxEffectif: number
}

const DUREE_LEGALE = 35
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const deux = (n: number) => String(n).padStart(2, '0')

// Mois de l'année où la personne est présente (entrée et sortie comprises)
export function moisPresents(p: Pick<Personne, 'entree' | 'sortie'>, annee: number): boolean[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = `${annee}-${deux(i + 1)}`
    return (!p.entree || p.entree <= m) && (!p.sortie || p.sortie >= m)
  })
}

// Coefficient de la réduction générale pour un brut annuel, avec le SMIC ramené au temps de travail et aux mois présents
export function coefficientReduction(brutAnnuel: number, smicReference: number, r: ParametresCharges['reduction']): number {
  if (brutAnnuel <= 0 || smicReference <= 0 || brutAnnuel >= 3 * smicReference) return 0
  const max = r.tmin + r.tdelta
  const c = r.tmin + r.tdelta * Math.pow(0.5 * (3 * smicReference / brutAnnuel - 1), r.puissance)
  return Math.round(Math.min(max, c) * 10_000) / 10_000
}

export function coutPersonne(p: Personne, c: ParametresCharges, annee: number, hausse = 0): CoutPersonne {
  const presents = moisPresents(p, annee)
  const nbMois = presents.filter(Boolean).length
  const brut = presents.map((ok, i) => (ok ? p.brutMensuel * (1 + hausse) + somme(p.primes.filter((x) => x.mois === i + 1).map((x) => x.montant)) : 0))
  const brutAnnuel = somme(brut)
  const taux = c.taux[p.categorie] ?? 0
  const smicReference = c.reduction.smicAnnuel * (p.heuresHebdo / DUREE_LEGALE) * (nbMois / 12)
  // La réduction ne dépasse jamais les cotisations qu'elle couvre
  const coefficient = p.categorie === 'gerant_tns' ? 0
    : Math.min(coefficientReduction(brutAnnuel, smicReference, c.reduction), Math.max(0, taux - c.reduction.horsReduction))
  const charges = brut.map((b) => b * taux)
  const reduction = brut.map((b) => b * coefficient)
  const cout = brut.map((b, i) => b + charges[i] - reduction[i])
  const heures = presents.map((ok) => (ok ? p.heuresHebdo * SEMAINES_PAR_MOIS : 0))
  return {
    personne: p, brut, charges, reduction, cout, heures, brutAnnuel, coutAnnuel: somme(cout), coefficient,
    tauxEffectif: taux - coefficient, etp: (p.heuresHebdo / DUREE_LEGALE) * (nbMois / 12),
  }
}

// Masse salariale chargée de l'équipe pour une année ; hausse : indexation des salaires (pas des primes)
export function masseSalariale(equipe: Personne[], c: ParametresCharges, annee: number, hausse = 0): MasseSalariale {
  const personnes = equipe.map((p) => coutPersonne(p, c, annee, hausse))
  const parMois = Array.from({ length: 12 }, (_, i) => ({
    brut: somme(personnes.map((x) => x.brut[i])),
    charges: somme(personnes.map((x) => x.charges[i])),
    reduction: somme(personnes.map((x) => x.reduction[i])),
    cout: somme(personnes.map((x) => x.cout[i])),
    heures: somme(personnes.map((x) => x.heures[i])),
  }))
  const brut = somme(parMois.map((m) => m.brut))
  const charges = somme(parMois.map((m) => m.charges))
  const reduction = somme(parMois.map((m) => m.reduction))
  return {
    personnes, parMois, brut, charges, reduction, cout: brut + charges - reduction,
    etp: somme(personnes.map((x) => x.etp)), tauxEffectif: brut ? (charges - reduction) / brut : 0,
  }
}
