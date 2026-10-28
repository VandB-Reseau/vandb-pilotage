import { expect, test } from '@playwright/test'
import { tachesFranchise } from '../../src/lib/aFaire'

// Ce que le franchisé a à faire, selon la date du jour : chaque cas se vérifie à la main.
const base = { moisRenseignes: 0, quadrimestres: {}, budget: { annee: 2027, statut: null }, aEquipe: true, aFrais: true }

test('le 15 octobre 2026 : réel de septembre, quadrimestres 1 et 2, budget à relire', () => {
  const jour = new Date(2026, 9, 15)
  expect(tachesFranchise({ ...base, moisRenseignes: 8, budget: { annee: 2027, statut: 'propose' } }, jour)).toEqual([
    { type: 'reel', mois: 8 },
    { type: 'quadrimestre', annee: 2026, quadrimestre: 1 },
    { type: 'quadrimestre', annee: 2026, quadrimestre: 2 },
    { type: 'budget', annee: 2027, statut: 'propose' },
  ])
  // Tout à jour, budget validé
  expect(tachesFranchise({ ...base, moisRenseignes: 9, quadrimestres: { 2026: [1, 2] }, budget: { annee: 2027, statut: 'valide' } }, jour)).toEqual([])
})

test('en février : le dernier quadrimestre de l’an dernier ; en janvier, pas de réel attendu', () => {
  expect(tachesFranchise({ ...base, moisRenseignes: 1, aFrais: false }, new Date(2027, 1, 10))).toEqual([
    { type: 'quadrimestre', annee: 2026, quadrimestre: 3 }, { type: 'frais' },
  ])
  expect(tachesFranchise({ ...base, quadrimestres: { 2026: [3] } }, new Date(2027, 0, 10))).toEqual([])
})
