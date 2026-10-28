import { expect, test } from '@playwright/test'
import { lireFEC } from '../../src/import/fec'
import { exceptionsDe, quadrimestresCouverts, rubriqueParDefaut, syntheseFEC } from '../../src/moteur/fec'
import { fecFictif } from '../fec-fictif'

// FEC fictif de tests/fec-fictif.ts : chaque montant attendu y est détaillé et vérifié à la main.
const { ecritures, erreurs, nbLignes } = lireFEC(fecFictif(2026))

test('lecture du fichier : vingt écritures, débit moins crédit', () => {
  expect(erreurs).toEqual([])
  expect(nbLignes).toBe(20)
  expect(ecritures[0]).toEqual({ compte: '512000', libelle: 'Banque', date: '2026-01-01', solde: 20_000 })
  expect(ecritures[4]).toEqual({ compte: '609700', libelle: 'Remises obtenues', date: '2026-03-31', solde: -2_000 })
})

test('correspondance par défaut sur les racines du plan comptable', () => {
  expect(rubriqueParDefaut('607100')).toBe('achats')
  expect(rubriqueParDefaut('609700')).toBe('achats')
  expect(rubriqueParDefaut('609800')).toBe('chargesExternes')
  expect(rubriqueParDefaut('603700')).toBe('variationStock')
  expect(rubriqueParDefaut('651100')).toBe('chargesExternes')
  expect(rubriqueParDefaut('621000')).toBe('chargesExternes')
  expect(rubriqueParDefaut('644000')).toBe('personnel')
  expect(rubriqueParDefaut('661100')).toBe('horsEBE')
  expect(rubriqueParDefaut('658000')).toBeNull()
})

test('janvier à avril : montants du quadrimestre, compte 658 à classer', () => {
  expect(quadrimestresCouverts(ecritures, 2026)).toEqual([1])
  const s = syntheseFEC(ecritures, 2026, 1)
  expect(s.montants).toEqual({ achats: 98_000, variationStock: 5_000, chargesExternes: 18_000, impotsTaxes: 1_500, personnel: 39_000, tresorerie: 50_000 })
  expect(s.caFEC).toBe(200_000)
  expect(s.aClasser.map((c) => [c.compte, c.montant])).toEqual([['658000', 300]])
  expect(s.comptes[0]).toMatchObject({ compte: '607100', montant: 100_000, rubrique: 'achats' })
})

test('exception du magasin : le 658 rangé en charges externes, gardé pour la suite', () => {
  const s = syntheseFEC(ecritures, 2026, 1, { '658000': 'chargesExternes', '613200': 'chargesExternes' })
  expect(s.montants.chargesExternes).toBe(18_300)
  expect(s.aClasser).toEqual([])
  // Le loyer reste à sa place par défaut : seule l'exception utile est gardée
  expect(exceptionsDe(s.comptes)).toEqual({ '658000': 'chargesExternes' })
})

test('sans stock passé sur la période, la variation de stock reste à saisir', () => {
  const sansStock = ecritures.filter((e) => !e.compte.startsWith('603'))
  const s = syntheseFEC(sansStock, 2026, 1)
  expect(s.stockPasse).toBe(false)
  expect(s.montants.variationStock).toBeNull()
})

test('variante Montant et Sens, séparateur barre verticale', () => {
  const l = lireFEC('CompteNum|CompteLib|EcritureDate|Montant|Sens\r\n607000|Achats|20260115|1 250,40|D\r\n607000|Achats|20260120|250,40|C\r\n')
  expect(l.ecritures.map((e) => e.solde)).toEqual([1_250.4, -250.4])
  expect(() => lireFEC('Compte;Date\r\n607;2026')).toThrow()
})
