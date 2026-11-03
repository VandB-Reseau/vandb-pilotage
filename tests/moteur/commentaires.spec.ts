import { expect, test } from '@playwright/test'
import { avancementCampagne, avancementParRR, campagneParDefaut } from '../../src/moteur/campagne'
import { pointsAvantValidation } from '../../src/moteur/changements'

// Commentaires sur le budget (Joseph, 03/11/2026) : la campagne compte les commentaires ouverts, la validation reste
// possible avec un avertissement
const c = campagneParDefaut(2027)
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

test('campagne : commentaires ouverts additionnés par responsable, Coachs compris', () => {
  const magasins = [
    { statut: 'propose' as const, rrs: ['RR Nord'], coach: 'Coach A', commentaires: 2 },
    { statut: 'en_discussion' as const, rrs: ['RR Nord'], coach: 'Coach B', commentaires: 1 },
    { statut: null, rrs: ['RR Sud'], coach: 'Coach A' },
  ]
  const parRR = avancementParRR(magasins, c, '2026-11-01')
  const nord = parRR.find((l) => l.nom === 'RR Nord')!
  expect(nord.commentaires).toBe(3)
  expect(nord.coachs.map((x) => [x.nom, x.commentaires])).toEqual([['Coach A', 2], ['Coach B', 1]])
  expect(parRR.find((l) => l.nom === 'RR Sud')!.commentaires).toBe(0)
  expect(avancementCampagne(magasins.map((m) => ({ statut: m.statut, responsables: ['Tout'], commentaires: m.commentaires })), c, '2026-11-01')[0].commentaires).toBe(3)
})

test('validation : un avertissement par nombre de commentaires ouverts, aucun sans commentaire', () => {
  const base = { tresorerieDepart: 10_000, pointBas: null, changementsNonEnvoyes: false }
  expect(pointsAvantValidation(base, MOIS)).toEqual([])
  expect(pointsAvantValidation({ ...base, commentairesOuverts: 1 }, MOIS)).toEqual([{ cle: 'commentaires', texte: 'Un commentaire est encore ouvert.' }])
  expect(pointsAvantValidation({ ...base, commentairesOuverts: 3 }, MOIS)).toEqual([{ cle: 'commentaires', texte: '3 commentaires sont encore ouverts.' }])
})
