import { nombre } from '../import/caisse'
import { CODES_FINANCES, type LigneFraisMagasin } from './atterrissage'
import { lignesFrais, rubriqueLibelle } from './parametres'
import type { Rubrique } from './types'

// Saisie des frais d'un magasin : une ligne de la grille du réseau, par an (€) ou en part du CA (%), en texte jusqu'à l'enregistrement
export type Mode = 'annuel' | 'taux'
export interface ChampFrais { code: string; libelle: string; rubrique: Rubrique; mode: Mode; valeur: string }
export interface SaisieFrais { lignes: ChampFrais[]; finances: Record<keyof typeof CODES_FINANCES, string> }

export const RUBRIQUES = Object.keys(rubriqueLibelle) as Rubrique[]
export const LIBELLES_FINANCES: Record<keyof typeof CODES_FINANCES, string> = {
  amortissements: 'Dotations aux amortissements', interets: 'Intérêts d’emprunts', remboursementCapital: 'Capital d’emprunts remboursé',
}
// Lignes que presque tous les magasins ont : point de départ d'une saisie
export const LIGNES_COURANTES = ['loyer', 'charges_locatives', 'energie', 'honoraires_comptables', 'assurances', 'banque', 'telecom', 'cfe']

const enTexte = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')
const codesFinances = Object.values(CODES_FINANCES) as string[]
const ordre = (c: string) => { const i = lignesFrais.findIndex((l) => l.code === c); return i < 0 ? 999 : i }

export function saisieDepuisLignes(lignes: LigneFraisMagasin[]): SaisieFrais {
  const fin = (code: string) => { const l = lignes.find((x) => x.code === code); return l?.annuel ? enTexte(l.annuel) : '' }
  return {
    lignes: lignes.filter((l) => !codesFinances.includes(l.code)).sort((a, b) => ordre(a.code) - ordre(b.code)).map((l) => ({
      code: l.code, libelle: l.libelle, rubrique: l.rubrique as Rubrique,
      mode: l.tauxCA !== null ? 'taux' : 'annuel', valeur: l.tauxCA !== null ? enTexte(l.tauxCA * 100) : enTexte(l.annuel ?? 0),
    })),
    finances: { amortissements: fin(CODES_FINANCES.amortissements), interets: fin(CODES_FINANCES.interets), remboursementCapital: fin(CODES_FINANCES.remboursementCapital) },
  }
}

// Lignes de la grille pas encore utilisées, à proposer à l'ajout
export function lignesDisponibles(s: SaisieFrais) {
  return lignesFrais.filter((l) => !s.lignes.some((x) => x.code === l.code))
}
export function ajouterLigne(s: SaisieFrais, code: string): SaisieFrais {
  const g = lignesFrais.find((l) => l.code === code)
  if (!g || s.lignes.some((x) => x.code === code)) return s
  return { ...s, lignes: [...s.lignes, { code, libelle: g.libelle, rubrique: g.rubrique, mode: 'annuel' as Mode, valeur: '' }].sort((a, b) => ordre(a.code) - ordre(b.code)) }
}

// Lignes à enregistrer (vides écartées), codes à retirer, erreurs lisibles, totaux par rubrique
export function lireSaisieFrais(s: SaisieFrais, avant: LigneFraisMagasin[]): { lignes: LigneFraisMagasin[]; retirees: string[]; erreurs: string[] } {
  const lignes: LigneFraisMagasin[] = []
  const erreurs: string[] = []
  for (const l of s.lignes) {
    const v = nombre(l.valeur)
    if (v === null) continue
    if (Number.isNaN(v) || v < 0 || (l.mode === 'taux' && v > 100)) { erreurs.push(`${l.libelle} : montant illisible.`); continue }
    lignes.push({ code: l.code, libelle: l.libelle, rubrique: l.rubrique, annuel: l.mode === 'annuel' ? v : null, tauxCA: l.mode === 'taux' ? Math.round(v * 1e4) / 1e6 : null })
  }
  for (const k of Object.keys(CODES_FINANCES) as (keyof typeof CODES_FINANCES)[]) {
    const v = nombre(s.finances[k])
    if (v === null) continue
    if (Number.isNaN(v) || v < 0) { erreurs.push(`${LIBELLES_FINANCES[k]} : montant illisible.`); continue }
    lignes.push({ code: CODES_FINANCES[k], libelle: LIBELLES_FINANCES[k], rubrique: 'hors_exploitation', annuel: v, tauxCA: null })
  }
  const gardes = new Set(lignes.map((l) => l.code))
  return { lignes, retirees: avant.map((l) => l.code).filter((c) => !gardes.has(c)), erreurs }
}

export function totauxFrais(s: SaisieFrais): { parRubrique: Record<string, { annuel: number; taux: number }>; annuel: number; taux: number } {
  const parRubrique: Record<string, { annuel: number; taux: number }> = {}
  let annuel = 0, taux = 0
  for (const l of s.lignes) {
    const v = nombre(l.valeur)
    if (v === null || Number.isNaN(v)) continue
    const r = (parRubrique[l.rubrique] ??= { annuel: 0, taux: 0 })
    if (l.mode === 'annuel') { r.annuel += v; annuel += v } else { r.taux += v / 100; taux += v / 100 }
  }
  return { parRubrique, annuel, taux }
}
