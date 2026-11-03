import { calculerBudget } from './budget'
import { moisDuQuadrimestre, QUADRIMESTRES, type Quadrimestre, type SaisieQuadrimestre } from './quadrimestre'
import type { Hypotheses, LigneFrais, ParametresReseau } from './types'

// Lot 42 (Joseph, 02/11/2026, proposition 2) : sans équipe saisie poste par poste ni frais saisis ligne par ligne, le
// budget part des comptes de l'année en cours (quadrimestres saisis ou importés du FEC), ramenés à 12 mois. Le détail reste
// possible : dès qu'une équipe ou des lignes de frais sont enregistrées, elles remplacent la reprise.
// Proposition 5 : la trésorerie au 1er janvier est estimée depuis la dernière trésorerie connue et l'activité prévue
// jusqu'au 31 décembre, tant que le magasin n'a pas saisi son solde.

export interface ComptesAnnee {
  annee: number
  quadrimestres: Quadrimestre[]  // quadrimestres dont les charges sont saisies (personnel, charges externes, impôts et taxes)
  personnel: number              // total des quadrimestres retenus
  chargesExternes: number        // redevance et publicité comprises, comme dans les comptes
  impotsTaxes: number
  tauxSurCA: number              // redevance + publicité de l'année, retirées des charges externes (le budget les recalcule)
  tresorerie: { montant: number; quadrimestre: Quadrimestre } | null // dernière trésorerie de fin de période saisie
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

export function comptesAnnee(annee: number, saisies: Partial<Record<Quadrimestre, SaisieQuadrimestre>> | undefined, tauxSurCA: number): ComptesAnnee | null {
  if (!saisies) return null
  const retenus = QUADRIMESTRES.filter((q) => {
    const s = saisies[q]
    return !!s && s.personnel !== null && s.chargesExternes !== null && s.impotsTaxes !== null
  })
  const q = [...QUADRIMESTRES].reverse().find((x) => saisies[x]?.tresorerie != null)
  const tresorerie = q ? { montant: saisies[q]!.tresorerie!, quadrimestre: q } : null
  if (!retenus.length && !tresorerie) return null
  const total = (k: 'personnel' | 'chargesExternes' | 'impotsTaxes') => somme(retenus.map((x) => saisies[x]![k]!))
  return { annee, quadrimestres: retenus, personnel: total('personnel'), chargesExternes: total('chargesExternes'), impotsTaxes: total('impotsTaxes'), tauxSurCA, tresorerie }
}

// Ce que la reprise a mis dans le budget, pour l'écrire à côté des chiffres
export interface Reprise { annee: number; mois: number; personnel: boolean; frais: boolean }
export const CODE_REPRISE_EXTERNES = 'comptes_charges_externes'
export const CODE_REPRISE_IMPOTS = 'comptes_impots_taxes'

// Base du budget complétée par les comptes : masse salariale moyenne des mois retenus sur les 12 mois ; charges externes
// (hors redevance et publicité, recalculées sur le CA des mêmes mois) et impôts et taxes ramenés à l'année. Le CA des mois
// retenus est celui de la base (réel de l'année en cours). Rien n'est remplacé de ce que le magasin a saisi.
export function avecReprise(base: Hypotheses, c: ComptesAnnee | null | undefined, saisi: { equipe: boolean; frais: boolean }): Hypotheses {
  if (!c || !c.quadrimestres.length) return base
  const mois = c.quadrimestres.flatMap(moisDuQuadrimestre)
  const n = mois.length
  const personnelVide = !saisi.equipe && !base.equipe?.length && somme(base.personnel.salairesMensuels) === 0 && !base.personnel.remunerationGerance
  const fraisVides = !saisi.frais && !base.frais.length
  if (!personnelVide && !fraisVides) return base
  let h: Hypotheses = { ...base, reprise: { annee: c.annee, mois: n, personnel: personnelVide, frais: fraisVides } }
  if (personnelVide) h = { ...h, personnel: { ...base.personnel, salairesMensuels: Array(12).fill(c.personnel / n) } }
  if (fraisVides) {
    const ca = somme(mois.map((i) => base.caMensuelReference[i] ?? 0))
    const externes = Math.max(0, c.chargesExternes - ca * c.tauxSurCA) * 12 / n
    const impots = c.impotsTaxes * 12 / n
    const lignes: LigneFrais[] = [
      { code: CODE_REPRISE_EXTERNES, libelle: `Charges externes ${c.annee} (comptes, hors redevance et publicité)`, rubrique: 'autres', annuel: externes },
      { code: CODE_REPRISE_IMPOTS, libelle: `Impôts et taxes ${c.annee} (comptes)`, rubrique: 'impots_taxes', annuel: impots },
    ]
    h = { ...h, frais: lignes }
  }
  return h
}

// Trésorerie au 1er janvier estimée : trésorerie de fin du dernier quadrimestre saisi, plus l'EBE des mois restants de
// l'année en cours (base sans évolution, telle que l'atterrissage la projette), moins intérêts et capital d'emprunt des
// mêmes mois. Ni impôt ni décalages de TVA ou de fournisseurs : c'est une estimation, remplacée par le solde bancaire.
export interface DepartEstime { montant: number; depuis: number; quadrimestre: Quadrimestre; annee: number }
export function tresorerieDepartEstimee(base: Hypotheses, c: ComptesAnnee | null | undefined, p: ParametresReseau): DepartEstime | null {
  if (!c?.tresorerie) return null
  const dernierMois = moisDuQuadrimestre(c.tresorerie.quadrimestre)[3]
  const restants = Array.from({ length: 11 - dernierMois }, (_, k) => dernierMois + 1 + k)
  if (!restants.length) return { montant: c.tresorerie.montant, depuis: c.tresorerie.montant, quadrimestre: c.tresorerie.quadrimestre, annee: c.annee }
  // Base sans cible : même CA que l'année en cours, mois par mois (saisonnalité de la base)
  const b = calculerBudget({ ...base, annee: c.annee, travaux: undefined, tempsForts: undefined, ajustementsCA: undefined, poidsMois: undefined, rythme: undefined }, p)
  // Intérêts et capital de chaque mois : ceux des prêts saisis s'il y en a (03/11/2026), sinon le douzième des frais
  const flux = somme(restants.map((i) => b.mois[i].ebe - b.financement.interetsMois[i] - b.financement.capitalMois[i]))
  return { montant: Math.round(c.tresorerie.montant + flux), depuis: c.tresorerie.montant, quadrimestre: c.tresorerie.quadrimestre, annee: c.annee }
}
