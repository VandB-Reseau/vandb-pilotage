import { expect, test } from '@playwright/test'
import { decrireChangement, libelleRubrique } from '../../src/lib/parametrage'

// Journal des paramètres réseau (lot 39) : chaque ligne enregistrée par la base se lit en clair
const t = (s: string) => s.replace(/[  ]/g, ' ')

test('une valeur seule : avant → après', () => {
  expect(libelleRubrique('tauxRedevance')).toBe('Redevance franchise')
  expect(t(decrireChangement('tauxRedevance', 0.02, 0.025))).toBe('2,0 % → 2,5 %')
  expect(t(decrireChangement('tauxPublicite', null, 0.01))).toBe('par défaut → 1,0 %')
})

test('une rubrique à plusieurs valeurs : seules celles qui changent', () => {
  const avant = { tauxReduit: 0.15, plafondTauxReduit: 42500, tauxNormal: 0.25 }
  expect(t(decrireChangement('impot', avant, { ...avant, plafondTauxReduit: 50000 }))).toBe('plafond du taux réduit : 42 500 € → 50 000 €')
  expect(t(decrireChangement('tresorerie', { delaiFournisseurs: 1, tvaTrimestrielle: false, consignes: { achats: { bar: 0.15 } } },
    { delaiFournisseurs: 2, tvaTrimestrielle: true, consignes: { achats: { bar: 0.2 } } })))
    .toBe('paiement des fournisseurs (mois) : 1 → 2 ; TVA trimestrielle : non → oui ; consignes Bar : 15,0 % → 20,0 %')
  expect(decrireChangement('charges', { taux: { a: 1, b: 2, c: 3, d: 4 } }, { taux: { a: 5, b: 6, c: 7, d: 8 } })).toBe('4 valeurs modifiées')
  expect(decrireChangement('campagne', { proposition: '2026-11-15' }, { proposition: '2026-11-20' })).toBe('proposition : 15/11/2026 → 20/11/2026')
})
