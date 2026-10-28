import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { mediane, medianes, rang, ratiosDuBudget, type Ratios } from '../../src/moteur/comparaison'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { magasinFictif } from '../donnees-fictives'

// Médianes et rangs sur des magasins fictifs : chaque résultat se vérifie à la main.
const r = (personnelSurMarge: number | null, ebeSurCA: number | null): Ratios => ({ tauxMarge: null, personnelSurMarge, loyerSurCA: null, panierTTC: null, ebeSurCA })

test('médiane : valeur du milieu, moyenne des deux du milieu, valeurs absentes ignorées', () => {
  expect(mediane([3, 1, 2])).toBe(2)
  expect(mediane([4, 1, 3, 2])).toBe(2.5)
  expect(mediane([])).toBeNull()
  const l = [r(0.5, 0.08), r(0.6, null), r(0.4, 0.1), r(0.7, 0.02)]
  const m = medianes(l)
  expect(m.personnelSurMarge).toBeCloseTo(0.55, 10)   // (0,5 + 0,6) / 2
  expect(m.ebeSurCA).toBe(0.08)                       // 0,02 ; 0,08 ; 0,10
  expect(m.nb.ebeSurCA).toBe(3)
  // Masse salariale : la plus basse est la meilleure ; EBE : le plus haut
  expect(rang(0.6, l, 'personnelSurMarge')).toEqual({ rang: 3, sur: 4 })
  expect(rang(0.1, l, 'ebeSurCA')).toEqual({ rang: 1, sur: 3 })
  expect(rang(null, l, 'ebeSurCA')).toBeNull()
})

test('ratios du budget du magasin fictif', () => {
  const b = calculerBudget(magasinFictif, parametresParDefaut)
  const x = ratiosDuBudget(b, magasinFictif)
  expect(x.tauxMarge).toBeCloseTo(367_300 / 640_000, 10)          // 57,4 %
  expect(x.personnelSurMarge).toBeCloseTo(216_000 / 367_300, 10)  // 58,8 %
  expect(x.loyerSurCA).toBeCloseTo(60_000 / 640_000, 10)          // 9,4 %
  expect(x.panierTTC).toBe(24)                                    // seule la Cave a un panier visé
  expect(x.ebeSurCA).toBeCloseTo(54_780 / 640_000, 10)            // 8,6 %
})
