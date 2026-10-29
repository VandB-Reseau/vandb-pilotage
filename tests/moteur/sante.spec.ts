import { expect, test } from '@playwright/test'
import { baseDepuisReel } from '../../src/moteur/atterrissage'
import { calculerBudget } from '../../src/moteur/budget'
import { compteResultat } from '../../src/moteur/compteResultat'
import { parametresParDefaut } from '../../src/moteur/parametres'
import type { LigneReel } from '../../src/moteur/reel'
import { santeMagasin, syntheseBudgets } from '../../src/moteur/sante'

// Même magasin fictif que tests/moteur/atterrissage.spec.ts : chaque résultat se vérifie à la main.
const n: LigneReel[] = [
  { mois: 1, univers: 'cave', famille: 'Bière', caHT: 10_000, caTTC: 12_000, margeHT: 3_600 },
  { mois: 2, univers: 'cave', famille: 'Bière', caHT: 20_000, caTTC: 24_000, margeHT: 7_200 },
  { mois: 1, univers: 'bar', famille: 'Fût', caHT: 10_000, caTTC: 12_000, margeHT: null },
]
const n1: LigneReel[] = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, univers: 'cave' as const, famille: 'Vin', caHT: i === 11 ? 4_000 : 1_000, caTTC: null, margeHT: null }))
const proche = (v: number | null, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

test('santé du magasin : cumul face aux mêmes mois de l’an dernier, marge sur les seules lignes connues', () => {
  const reel = { n: { lignes: n, tickets: [] }, n1: { lignes: n1, tickets: [] } }
  const r = baseDepuisReel(reel, 2026)!
  const b = calculerBudget({ ...r.base, frais: [{ code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000 }] }, parametresParDefaut)
  const s = santeMagasin(reel.n, reel.n1, b)
  expect(s.moisRealises).toBe(2)
  proche(s.caCumule, 40_000)
  proche(s.caCumuleN1, 2_000)
  proche(s.evolution, 19)                      // 40 000 / 2 000 − 1
  // Marge du Fût inconnue : 10 800 / 30 000 de Bière = 36 %, et non 10 800 / 40 000
  proche(s.tauxMarge, 0.36)
  expect(s.serieN.slice(0, 3)).toEqual([20_000, 20_000, null])
  expect(s.projection[1]).toBeNull()
  proche(s.projection[11], 65_000)            // Bière 15 000 × 4 + Fût 5 000
  expect(s.serieN1[11]).toBe(4_000)
  // Sans réel l'an dernier : pas de comparaison
  const seul = santeMagasin(reel.n, { lignes: [], tickets: [] }, null)
  expect(seul.caCumuleN1).toBeNull()
  expect(seul.evolution).toBeNull()
  expect(seul.serieN1.every((v) => v === null)).toBe(true)
})

test('compte de résultat sur 12 mois : rubriques, détail des frais, totaux identiques au budget', () => {
  const reel = { n: { lignes: n, tickets: [] }, n1: { lignes: n1, tickets: [] } }
  const r = baseDepuisReel(reel, 2026)!
  const h = { ...r.base, frais: [
    { code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier' as const, annuel: 60_000 },
    { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies' as const, tauxCA: 0.01 },
    { code: 'cfe', libelle: 'Cotisation foncière des entreprises', rubrique: 'impots_taxes' as const, annuel: 1_200 },
  ], amortissements: 12_000, interets: 2_400 }
  const b = calculerBudget(h, parametresParDefaut)
  const l = compteResultat(b, h, parametresParDefaut)
  const ligne = (cle: string) => l.find((x) => x.cle === cle)!
  proche(ligne('ca').total, 285_000)
  // Détail du CA par univers : Bière 225 000 en Cave, Fût 60 000 au Bar
  proche(ligne('ca/cave').total, 225_000)
  proche(ligne('ca/bar').total, 60_000)
  // Décembre : CA 65 000 ; loyer 5 000 ; énergie 650 ; redevance 1 300 ; publicité 650
  proche(ligne('ca').mois[11]!, 65_000)
  proche(ligne('externes/loyer').mois[11]!, -5_000)
  proche(ligne('externes/energie').mois[11]!, -650)
  proche(ligne('externes/redevance').mois[11]!, -1_300)
  proche(ligne('externes/publicite').mois[11]!, -650)
  proche(ligne('externes').mois[11]!, -7_600)
  proche(ligne('impots/cfe').total, -1_200)
  expect(ligne('impots/cfe').parent).toBe('impots')
  // Totaux de rubrique = budget ; amortissements et intérêts répartis par douzièmes
  proche(ligne('ebe').total, b.ebe)
  proche(ligne('amortissements').mois[0]!, -1_000)
  proche(ligne('interets').mois[0]!, -200)
  proche(ligne('avant_impot').total, b.resultatAvantImpot)
  // Impôt de l'année réparti au prorata du résultat avant impôt de chaque mois (29/10/2026)
  proche(ligne('impot').total, -b.impot)
  proche(ligne('impot').mois[0]!, -b.impot * b.mois[0].resultatAvantImpot / b.resultatAvantImpot)
  proche(ligne('net').total, b.resultatNet)
  proche(ligne('net').mois[0]!, b.mois[0].resultatAvantImpot + ligne('impot').mois[0]!)
  proche(ligne('tresorerie').total, b.tresorerieDegagee)
})

test('synthèse d’un périmètre : budgets validés, sommes, fiches à compléter', () => {
  const b = (ca: number, ebe: number) => ({ ca, ebe } as Parameters<typeof syntheseBudgets>[0][number]['budget'])
  const s = syntheseBudgets([
    { statut: 'valide', budget: b(600_000, 60_000), aEquipe: true, aFrais: true },
    { statut: 'en_discussion', budget: b(400_000, 20_000), aEquipe: false, aFrais: true },
    { statut: null, budget: null, aEquipe: true, aFrais: false },
  ])
  expect(s).toEqual({ magasins: 3, valides: 1, avecBudget: 2, ca: 1_000_000, ebe: 80_000, ebeSurCA: 0.08, aCompleter: 2 })
})
