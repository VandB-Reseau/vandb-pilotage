import { expect, test } from '@playwright/test'
import { ecrireUnivers, moyenneUnivers, universRegle, type Cibles } from '../../src/moteur/cibles'
import type { ResultatFamille } from '../../src/moteur/types'

// Lot 31 : hypothèses réglées pour un univers entier. Chaque résultat se vérifie à la main.
const proche = (v: number | undefined, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const famille = (univers: 'cave' | 'bar', nom: string, objectif: number, margeCible: number, demarque = 0) =>
  ({ univers, famille: nom, objectif, margeCible, demarque }) as unknown as ResultatFamille
// Cave : Vin 100 k€ à 30 %, Bière 300 k€ à 40 % ; Bar : Fût 50 k€ à 75 %
const familles = [famille('cave', 'Vin', 100_000, 0.30), famille('cave', 'Bière', 300_000, 0.40, 0.02), famille('bar', 'Fût', 50_000, 0.75)]

test('marge de l’univers : moyenne pondérée par le CA, la changer décale chaque famille du même nombre de points', () => {
  // (100 × 30 % + 300 × 40 %) ÷ 400 = 37,5 %
  proche(moyenneUnivers(familles, 'cave', 'marge'), 0.375)
  // Viser 40 % : + 2,5 points pour chaque famille → Vin 32,5 %, Bière 42,5 % ; (32,5 + 127,5) ÷ 400 = 40 %
  const c = ecrireUnivers({}, familles, 'cave', 'marge', 0.40)
  proche(c.margeFamille?.['cave/Vin'], 0.325)
  proche(c.margeFamille?.['cave/Bière'], 0.425)
  expect(c.margeFamille?.['bar/Fût']).toBeUndefined()
  expect(universRegle(c, familles, 'cave', 'marge')).toBe(true)
  expect(universRegle(c, familles, 'bar', 'marge')).toBe(false)
})

test('démarque de l’univers : la même pour chaque famille ; vider reprend le niveau au-dessus', () => {
  // (100 × 0 % + 300 × 2 %) ÷ 400 = 1,5 %
  proche(moyenneUnivers(familles, 'cave', 'demarque'), 0.015)
  const c = ecrireUnivers({ demarqueFamille: { 'bar/Fût': 0.01 } }, familles, 'cave', 'demarque', 0.03)
  expect(c.demarqueFamille).toEqual({ 'bar/Fût': 0.01, 'cave/Vin': 0.03, 'cave/Bière': 0.03 })
  const vide: Cibles = ecrireUnivers(c, familles, 'cave', 'demarque', undefined)
  expect(vide.demarqueFamille).toEqual({ 'bar/Fût': 0.01 })
})

test('univers sans CA l’an prochain : moyenne simple des familles', () => {
  proche(moyenneUnivers([famille('cave', 'Vin', 0, 0.30), famille('cave', 'Bière', 0, 0.40)], 'cave', 'marge'), 0.35)
  expect(moyenneUnivers(familles, 'exterieur' as never, 'marge')).toBe(0)
})
