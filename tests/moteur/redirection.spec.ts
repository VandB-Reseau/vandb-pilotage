import { expect, test } from '@playwright/test'
import { adresseReseau } from '../../src/lib/redirection'

// L'ancienne adresse du pilotage mène à la même page dans l'app réseau (fusion, Joseph 03/11/2026)
const R = 'https://vandb-reseau.github.io/vandb-reseau/'

test('chaque page du pilotage a sa place dans l’app réseau', () => {
  expect(adresseReseau('')).toBe(`${R}#/budgets`)
  expect(adresseReseau('#/')).toBe(`${R}#/budgets`)
  expect(adresseReseau('#/reseau')).toBe(`${R}#/budgets/suivi`)
  expect(adresseReseau('#/hypotheses')).toBe(`${R}#/budgets/hypotheses`)
  expect(adresseReseau('#/imports')).toBe(`${R}#/budgets/imports`)
  expect(adresseReseau('#/parametres?onglet=equipe')).toBe(`${R}#/budgets/parametres`)
  expect(adresseReseau('#/inconnue')).toBe(`${R}#/budgets`)
})

test('la page d’un magasin s’ouvre dans l’onglet Budget de sa fiche, sur la même partie', () => {
  expect(adresseReseau('#/magasins/Annecy%20Test')).toBe(`${R}#/magasins/Annecy%20Test?vue=budget`)
  expect(adresseReseau('#/magasins/Annecy%20Test/saisies?mois=3')).toBe(`${R}#/magasins/Annecy%20Test?vue=budget&partie=saisies`)
  expect(adresseReseau('#/magasins/L%27Isle-Adam/budget')).toBe(`${R}#/magasins/L'Isle-Adam?vue=budget&partie=budget`)
})
