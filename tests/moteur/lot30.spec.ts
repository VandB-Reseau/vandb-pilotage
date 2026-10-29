import { expect, test } from '@playwright/test'
import { joursHorsDimanche, objectifsDuMois } from '../../src/moteur/objectifs'
import type { MoisReel } from '../../src/moteur/suivi'
import type { Budget } from '../../src/moteur/types'

// Lot 30 : objectifs du mois pour l'équipe. Chaque résultat se vérifie à la main.
const proche = (v: number, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

test('jours d’ouverture du mois hors dimanches', () => {
  // Novembre 2027 : 30 jours, 4 dimanches (7, 14, 21, 28) ; février 2028 : 29 jours, 4 dimanches (6, 13, 20, 27)
  expect(joursHorsDimanche(2027, 11)).toBe(26)
  expect(joursHorsDimanche(2028, 2)).toBe(25)
})

test('objectifs du mois : CA du budget → tickets par jour et panier, Cave et Bar séparés, face à l’an dernier', () => {
  // Novembre : Cave 26 000 € HT, TVA 20 % → 31 200 € TTC ; panier visé 40 € → 780 tickets, 30 par jour sur 26 jours.
  // Bar 5 000 € HT, TVA 15 % → 5 750 € TTC ; panier 23 € → 250 tickets. Extérieur ignoré.
  const mois = Array.from({ length: 12 }, () => ({ univers: { cave: { ca: 0 }, bar: { ca: 0 }, exterieur: { ca: 0 } } }))
  mois[10] = { univers: { cave: { ca: 26_000 }, bar: { ca: 5_000 }, exterieur: { ca: 9_000 } } }
  const b = { mois, flux: { cave: { panierObjectifTTC: 40 }, bar: { panierObjectifTTC: 23 } } } as unknown as Budget
  // L'an dernier en novembre : Cave 728 tickets pour 27 300 € TTC (panier 37,50 €) ; Bar sans tickets
  const n1 = { univers: { cave: { tickets: 728, caTTC: 27_300 }, bar: { tickets: 0, caTTC: 0 } } } as MoisReel
  const o = objectifsDuMois(b, 11, 26, { cave: 0.2, bar: 0.15 }, n1)
  const cave = o.univers.cave!, bar = o.univers.bar!
  proche(cave.caTTC, 31_200)
  proche(cave.tickets, 780)
  proche(cave.ticketsParJour, 30)
  proche(cave.unEuroDePlus, 780)
  proche(cave.panierN1!, 37.5)
  proche(cave.ticketsParJourN1!, 28)
  proche(bar.tickets, 250)
  expect(bar.panierN1).toBeNull()
  // Mois sans CA ou univers sans panier visé : pas d'objectif
  expect(objectifsDuMois(b, 1, 26, { cave: 0.2, bar: 0.15 }).univers).toEqual({})
})
