import { expect, test } from '@playwright/test'
import { resultatsQuadrimestres, type SaisieQuadrimestre } from '../../src/moteur/quadrimestre'
import type { MoisReel } from '../../src/moteur/suivi'
import type { Budget } from '../../src/moteur/types'

// Résultat réel par quadrimestre sur un magasin fictif : chaque résultat se vérifie à la main.
const proche = (v: number | null, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

// Caisse : 50 000 € de CA HT par mois de janvier à août, marge théorique 40 %
const reel: MoisReel[] = Array.from({ length: 12 }, (_, i) => (i < 8
  ? { caHT: 50_000, margeHT: 20_000, caAvecMarge: 50_000, caTTC: 60_000, tickets: 0 }
  : { caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))
// Budget : 48 000 € de CA, 19 200 € de marge et 2 000 € d'EBE chaque mois
const budget = { mois: Array.from({ length: 12 }, () => ({ ca: 48_000, marge: 19_200, ebe: 2_000 })) } as unknown as Budget
const q1: SaisieQuadrimestre = { achats: 125_000, variationStock: 3_000, chargesExternes: 30_000, impotsTaxes: 2_000, personnel: 36_000, tresorerie: 15_000 }

test('quadrimestre : marge réelle avec la variation de stock, démarque face à la caisse, EBE face au budget', () => {
  const { parQuadrimestre: [r], cumul, dernier } = resultatsQuadrimestres(reel, { 1: q1 }, budget)
  expect(r!.ca).toBe(200_000)
  expect(r!.achatsConsommes).toBe(122_000)          // 125 000 − 3 000 de stock en plus
  expect(r!.marge).toBe(78_000)
  proche(r!.tauxMarge, 0.39)
  proche(r!.tauxMargeCaisse, 0.4)
  proche(r!.ecartMargeCaisse, -0.01)                // 1 point de démarque
  proche(r!.tauxMargeBudget, 0.4)                   // 76 800 / 192 000
  expect(r!.ebe).toBe(10_000)                       // 78 000 − 30 000 − 2 000 − 36 000
  proche(r!.ebeSurCA, 0.05)
  proche(r!.personnelSurMarge, 36_000 / 78_000)
  expect(r!.budget).toEqual({ ca: 192_000, marge: 76_800, ebe: 8_000 })
  expect(r!.ecartEBE).toBe(2_000)
  expect(r!.tresorerie).toBe(15_000)
  expect(r!.complet).toBe(true)
  expect(dernier).toBe(1)
  expect(cumul!.ebe).toBe(10_000)
})

test('quadrimestre : saisie incomplète, cumul jusqu’au dernier quadrimestre, période sans caisse', () => {
  const q2: SaisieQuadrimestre = { achats: 120_000, variationStock: null, chargesExternes: 31_000, impotsTaxes: 2_000, personnel: null, tresorerie: 9_000 }
  const { parQuadrimestre: [, r2], cumul } = resultatsQuadrimestres(reel, { 1: q1, 2: q2 }, budget)
  expect(r2!.marge).toBe(80_000)                    // variation de stock absente : comptée nulle
  expect(r2!.ebe).toBeNull()                        // personnel manquant
  expect(r2!.complet).toBe(false)
  expect(cumul!.ca).toBe(400_000)
  expect(cumul!.marge).toBe(158_000)
  expect(cumul!.ebe).toBeNull()
  expect(cumul!.tresorerie).toBe(9_000)             // la plus récente

  // Septembre à décembre : pas encore de caisse, pas de marge
  const r3 = resultatsQuadrimestres(reel, { 3: q1 }, null)
  expect(r3.parQuadrimestre[2]!.moisCaisse).toBe(0)
  expect(r3.parQuadrimestre[2]!.marge).toBeNull()
  expect(r3.parQuadrimestre[2]!.budget).toBeNull()
  expect(r3.cumul).toBeNull()                       // janvier à août non saisis
})
