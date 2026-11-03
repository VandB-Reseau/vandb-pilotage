import { expect, test } from '@playwright/test'
import { anneesDeSaisie, anneesDepuis, anneesDuCalendrier, etapesAnnees } from '../../src/moteur/annees'

// Passage d'année (0027, Joseph 03/11/2026) : les années viennent de la base, le Directeur les fait avancer.
// Chaque résultat se vérifie à la main.

test('sans année enregistrée : la règle du calendrier (budget de l’année suivante à partir de septembre)', () => {
  expect(anneesDuCalendrier(new Date(2026, 10, 3))).toEqual({ suivi: 2026, budget: 2027, campagne: true, aClore: [], passees: [], pilotees: false })
  expect(anneesDuCalendrier(new Date(2027, 2, 1))).toEqual({ suivi: 2027, budget: 2027, campagne: false, aClore: [], passees: [], pilotees: false })
  expect(anneesDepuis([], new Date(2027, 2, 1)).pilotees).toBe(false)
})

test('départ : 2026 suivie, campagne 2027 ouverte, quel que soit le jour', () => {
  const lignes = [{ annee: 2026, etat: 'suivi' as const }, { annee: 2027, etat: 'campagne' as const }]
  // Le 1er janvier 2027 ne change rien tant que le Directeur n'a pas démarré le suivi 2027
  for (const jour of [new Date(2026, 10, 3), new Date(2027, 0, 1), new Date(2027, 8, 1)]) {
    expect(anneesDepuis(lignes, jour)).toEqual({ suivi: 2026, budget: 2027, campagne: true, aClore: [], passees: [], pilotees: true })
  }
  expect(etapesAnnees(anneesDepuis(lignes))).toEqual([{ quoi: 'demarrer', annee: 2027 }])
})

test('suivi 2027 démarré : 2026 à clore, budget 2027 en lecture, prochaine étape ouvrir 2028', () => {
  const a = anneesDepuis([{ annee: 2026, etat: 'suivi' }, { annee: 2027, etat: 'suivi' }])
  expect(a).toEqual({ suivi: 2027, budget: 2027, campagne: false, aClore: [2026], passees: [], pilotees: true })
  expect(anneesDeSaisie(a)).toEqual([2027, 2026])
  expect(etapesAnnees(a)).toEqual([{ quoi: 'ouvrir', annee: 2028 }, { quoi: 'clore', annee: 2026 }])
})

test('campagne 2028 ouverte, 2026 close : Suivi 2027 et Budget 2028', () => {
  const a = anneesDepuis([{ annee: 2026, etat: 'close' }, { annee: 2027, etat: 'suivi' }, { annee: 2028, etat: 'campagne' }])
  expect(a).toEqual({ suivi: 2027, budget: 2028, campagne: true, aClore: [], passees: [2026], pilotees: true })
  // Sans année à clore, la saisie propose encore l'année d'avant (décembre, 3e quadrimestre)
  expect(anneesDeSaisie(a)).toEqual([2027, 2026])
  expect(etapesAnnees(a)).toEqual([{ quoi: 'demarrer', annee: 2028 }])
})

test('lignes incohérentes ignorées : état inconnu, campagne plus ancienne que le suivi', () => {
  const a = anneesDepuis([{ annee: 2027, etat: 'suivi' }, { annee: 2026, etat: 'campagne' }, { annee: 2029, etat: 'ouverte' as never }])
  expect(a).toMatchObject({ suivi: 2027, budget: 2027, campagne: false })
})
