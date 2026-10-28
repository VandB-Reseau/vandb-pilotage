import { expect, test } from '@playwright/test'
import { alertesMagasin, alertesParDefaut, trierAlertes, type EntreeAlertes } from '../../src/moteur/alertes'
import type { MoisReel } from '../../src/moteur/suivi'
import type { Budget } from '../../src/moteur/types'

// Alertes sur un magasin fictif : chaque seuil se vérifie à la main.
const mois = (n: number, ca: number, marge: number): MoisReel[] =>
  Array.from({ length: 12 }, (_, i) => (i < n ? { caHT: ca, margeHT: marge, caAvecMarge: ca, caTTC: ca * 1.2, tickets: 0 } : { caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))
const budget = (ca: number) => ({ mois: Array.from({ length: 12 }, () => ({ ca })) }) as unknown as Budget
const base: EntreeAlertes = {
  magasin: 'Brionne-sur-Lac', n: mois(3, 46_000, 17_940), n1: mois(12, 45_000, 18_000), budget: budget(50_000),
  moisTermines: 3, tresorerieReelle: null, tresorerieBudget: null,
}

test('CA sous le budget et marge qui baisse face à l’an dernier', () => {
  // CA : 138 000 / 150 000 − 1 = −8 %, au-delà de 5 %. Marge : 39 % contre 40 % l'an dernier, 1 point tout juste : pas d'alerte
  expect(alertesMagasin(base, alertesParDefaut)).toEqual([{ magasin: 'Brionne-sur-Lac', type: 'ca', ecart: expect.closeTo(-0.08, 6), mois: 3 }])
  // Marge à 38 % : 2 points sous l'an dernier
  const a = alertesMagasin({ ...base, n: mois(3, 46_000, 17_480) }, alertesParDefaut)
  expect(a[1]).toEqual({ magasin: 'Brionne-sur-Lac', type: 'marge', taux: expect.closeTo(0.38, 6), ecart: expect.closeTo(-0.02, 6), mois: 3 })
  // Seuil de CA relevé à 10 % : plus d'alerte de CA
  expect(alertesMagasin(base, { ...alertesParDefaut, ecartCA: 0.1 })).toEqual([])
  // Sans budget, pas d'alerte de CA
  expect(alertesMagasin({ ...base, budget: null }, alertesParDefaut)).toEqual([])
})

test('réel en retard et trésorerie sous le seuil', () => {
  // Fin mai : 5 mois terminés, réel à fin mars → 2 mois manquants
  const a = alertesMagasin({ ...base, budget: null, moisTermines: 5 }, alertesParDefaut)
  expect(a).toEqual([{ magasin: 'Brionne-sur-Lac', type: 'reel', manquants: 2, dernier: 3 }])
  expect(alertesMagasin({ ...base, budget: null, moisTermines: 5 }, { ...alertesParDefaut, moisRetard: 3 })).toEqual([])
  // Trésorerie : fin avril à −4 000 €, point bas du budget 2027 à 2 000 € en mars (seuil 0 puis 5 000 €)
  const t = { ...base, budget: null, tresorerieReelle: { montant: -4_000, quadrimestre: 1 as const }, tresorerieBudget: { montant: 2_000, mois: 2, annee: 2027 } }
  expect(alertesMagasin(t, alertesParDefaut)).toEqual([{ magasin: 'Brionne-sur-Lac', type: 'tresorerie', source: 'reel', montant: -4_000, quadrimestre: 1 }])
  expect(alertesMagasin(t, { ...alertesParDefaut, tresorerie: 5_000 })[1]).toEqual({ magasin: 'Brionne-sur-Lac', type: 'tresorerie', source: 'budget', montant: 2_000, mois: 3, annee: 2027 })
})

test('les plus graves d’abord', () => {
  const l = trierAlertes([
    { magasin: 'B', type: 'reel', manquants: 1, dernier: 2 },
    { magasin: 'A', type: 'ca', ecart: -0.06, mois: 3 },
    { magasin: 'C', type: 'ca', ecart: -0.12, mois: 3 },
    { magasin: 'D', type: 'tresorerie', source: 'reel', montant: -1_000, quadrimestre: 1 },
  ])
  expect(l.map((a) => a.magasin)).toEqual(['D', 'C', 'A', 'B'])
})
