import { expect, test } from '@playwright/test'
import { lireQuadrimestres, lireTickets, lireVentes } from '../../src/import/caisse'
import { lireFEC } from '../../src/import/fec'
import { MODELES } from '../../src/lib/modeles'
import { syntheseFEC } from '../../src/moteur/fec'

// Lot 32 : chaque modèle téléchargeable se relit sans erreur par l'import qu'il illustre (BOM compris).
const avecBOM = (t: string) => `﻿${t}`

test('modèles de la caisse : ventes, tickets et quadrimestres se relisent sans erreur', () => {
  const v = lireVentes(avecBOM(MODELES.ventes.texte))
  expect(v.erreurs).toEqual([])
  expect(v.lignes).toHaveLength(4)
  const t = lireTickets(avecBOM(MODELES.tickets.texte))
  expect(t.erreurs).toEqual([])
  expect(t.lignes.map((l) => l.tickets)).toEqual([620, 1450])
  const q = lireQuadrimestres(avecBOM(MODELES.quadrimestres.texte))
  expect(q.erreurs).toEqual([])
  expect(q.lignes).toHaveLength(1)
})

test('exemple de FEC : lu comme celui d’un cabinet, montants du premier quadrimestre vérifiés à la main', () => {
  const f = lireFEC(avecBOM(MODELES.fec.texte))
  expect(f.erreurs).toEqual([])
  const s = syntheseFEC(f.ecritures, 2027, 1)
  // Achats 607 : 1 000 ; stock 6037 au crédit 2 500 → variation + 2 500 ; loyer 613 : 2 000 ; paie 641 + 645 : 3 900 ;
  // banque 512 : 15 000 ; ventes 707 : 12 500
  expect(s.montants.achats).toBe(1000)
  expect(s.montants.variationStock).toBe(2500)
  expect(s.montants.chargesExternes).toBe(2000)
  expect(s.montants.personnel).toBe(3900)
  expect(s.montants.tresorerie).toBe(15000)
  expect(s.caFEC).toBe(12500)
})
