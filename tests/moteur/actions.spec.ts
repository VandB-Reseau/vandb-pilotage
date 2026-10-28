import { expect, test } from '@playwright/test'
import { alertesParDefaut, alertesMagasin, effetAction, mesureDeAlerte, mesuresMagasin, type EntreeAlertes } from '../../src/moteur/alertes'
import type { MoisReel } from '../../src/moteur/suivi'

// Mesures du plan d'action sur un magasin fictif, vérifiées à la main.
const mois = (ca: number, marge = 0): MoisReel => ({ caHT: ca, margeHT: marge, caAvecMarge: marge ? ca : 0, caTTC: ca * 1.2, tickets: 0 })
const vide = Array.from({ length: 12 }, () => mois(0))
// Budget : 100 000 € par mois. Réel : 98 000 € par mois de janvier à août, marge 40 % (39 % l'an dernier)
const budget = { mois: Array.from({ length: 12 }, () => ({ ca: 100_000 })) } as unknown as EntreeAlertes['budget']
const e: EntreeAlertes = {
  magasin: 'Magasin fictif', budget, moisTermines: 9,
  n: [...Array.from({ length: 8 }, () => mois(98_000, 39_200)), ...vide.slice(8)],
  n1: Array.from({ length: 12 }, () => mois(90_000, 35_100)),
  tresorerieReelle: { montant: 12_000, quadrimestre: 2 }, tresorerieBudget: null,
}

test('sans seuil : chaque mesure se calcule, même sans alerte', () => {
  // Aucune alerte aux seuils par défaut, sauf le réel de septembre manquant
  expect(alertesMagasin(e, alertesParDefaut).map((a) => a.type)).toEqual(['reel'])
  const m = mesuresMagasin(e)
  expect(m.ca?.valeur).toBeCloseTo(-0.02, 9)      // 784 000 / 800 000 − 1
  expect(m.ca?.mois).toBe(8)
  expect(m.marge?.valeur).toBeCloseTo(0.01, 9)    // 40 % − 39 %
  expect(m.reel).toEqual({ valeur: 1, mois: 8 })
  expect(m.tresorerie).toEqual({ valeur: 12_000, mois: 8 })
})

test('départ d’une alerte et effet : le CA remonte de −8 % à −2 %, le réel en retard s’aggrave', () => {
  expect(mesureDeAlerte({ magasin: 'x', type: 'ca', ecart: -0.08, mois: 6 })).toEqual({ valeur: -0.08, mois: 6 })
  const ca = effetAction('ca', -0.08, -0.02)
  expect(ca.ecart).toBeCloseTo(0.06, 9)
  expect(ca.favorable).toBe(true)
  expect(effetAction('reel', 1, 2)).toEqual({ ecart: 1, favorable: false })
  expect(effetAction('tresorerie', -5_000, -5_000).favorable).toBeNull()
})
