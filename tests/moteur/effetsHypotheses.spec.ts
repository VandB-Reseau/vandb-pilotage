import { expect, test } from '@playwright/test'
import { effetsUnivers } from '../../src/moteur/effetsHypotheses'

// Colonne « Effet » des hypothèses (2/11/2026). Exemple vérifié à la main : Cave à 500 000 € attendus cette année,
// 10 000 tickets → 10 300 (+3 %), panier +1 % : 500 000 × 1,03 × 1,01 = 520 150 €.
test('tickets puis panier : les deux effets font l’écart de CA', () => {
  const e = effetsUnivers({ caAvant: 500_000, caApres: 520_150, ticketsAvant: 10_000, ticketsApres: 10_300, margeAvant: 180_000, caMargeAvant: 500_000, margeApres: 197_657, perte: 2_600.75 })
  expect(e.tickets).toBeCloseTo(15_000, 6)          // 500 000 × 3 %
  expect(e.panier).toBeCloseTo(5_150, 6)            // 515 000 × 1 %
  expect(e.ca).toBeCloseTo(20_150, 6)
  // Taux 2026 : 36 % ; marge visée 197 657 € sur 520 150 € (38 %) : 197 657 − 520 150 × 36 % = 10 403 €
  expect(e.marge).toBeCloseTo(10_403, 6)
  expect(e.demarque).toBeCloseTo(-2_600.75, 6)
})

test('univers sans tickets, marge de cette année inconnue', () => {
  const e = effetsUnivers({ caAvant: 80_000, caApres: 88_000, margeAvant: 0, caMargeAvant: 0, margeApres: 30_000, perte: 0 })
  expect(e.tickets).toBeNull()
  expect(e.panier).toBeNull()
  expect(e.ca).toBe(8_000)
  expect(e.marge).toBeNull()
  expect(e.demarque === 0).toBe(true)
})
