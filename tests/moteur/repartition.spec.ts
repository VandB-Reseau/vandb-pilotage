import { expect, test } from '@playwright/test'
import type { LigneReel } from '../../src/moteur/reel'
import { NON_DETAILLE, referenceRepartition, repartirLigne, repartirNonDetaille } from '../../src/moteur/repartition'
import { detaillerUnivers, lireSaisie, saisieDepuisReel } from '../../src/moteur/saisieReel'

// Réel saisi par univers seulement (03/11/2026) : répartition sur les familles à la lecture. Magasin fictif, chaque
// résultat se vérifie à la main.
const l = (mois: number, univers: LigneReel['univers'], famille: string, caHT: number, caTTC: number | null, margeHT: number | null): LigneReel =>
  ({ mois, univers, famille, caHT, caTTC, margeHT })

// L'an dernier, septembre : Vin 6 000 € HT (7 200 TTC, 2 400 de marge), Bière 4 000 € (4 800 TTC, 1 200 de marge)
const n1 = [l(9, 'cave', 'Vin', 6_000, 7_200, 2_400), l(9, 'cave', 'Bière', 4_000, 4_800, 1_200), l(3, 'cave', 'Vin', 1_000, 1_200, 400)]

test('même mois de l’an dernier : CA et TTC à la part du CA, marge à la part de la marge', () => {
  const ref = referenceRepartition([], n1, 9, 'cave', 2025)!
  expect(ref.source).toBe('septembre 2025')
  expect(ref.ratioTTC).toBeCloseTo(1.2, 9)            // 12 000 / 10 000
  // Cette année, septembre : 20 000 € HT, 24 000 € TTC, 7 200 € de marge saisis pour la Cave
  const r = repartirNonDetaille([l(9, 'cave', NON_DETAILLE, 20_000, 24_000, 7_200)], n1, 2025)
  // Vin : 60 % du CA → 12 000 € HT, 14 400 € TTC ; 2/3 de la marge → 4 800 € (40 %, son taux de l'an dernier)
  // Bière : 8 000 € HT, 9 600 € TTC, 2 400 € de marge (30 %)
  expect(r).toEqual([
    { mois: 9, univers: 'cave', famille: 'Vin', caHT: 12_000, caTTC: 14_400, margeHT: 4_800, reparti: true },
    { mois: 9, univers: 'cave', famille: 'Bière', caHT: 8_000, caTTC: 9_600, margeHT: 2_400, reparti: true },
  ])
})

test('sans le même mois de l’an dernier : les 3 mois précédents, puis l’année, puis l’an dernier ; marge non saisie laissée vide', () => {
  // Avril est trop loin d'août ; mai à juillet : Vin 3 000 €, Spiritueux 1 000 €
  const n = [l(4, 'cave', 'Bière', 9_000, null, 3_000), l(6, 'cave', 'Vin', 3_000, null, 900), l(7, 'cave', 'Spiritueux', 1_000, null, 400),
    l(8, 'cave', NON_DETAILLE, 8_000, null, null)]
  const ref = referenceRepartition(n, [], 8, 'cave')!
  expect(ref.source).toBe('les 3 mois précédents')
  expect(ref.ratioTTC).toBeNull()
  expect(repartirNonDetaille(n, [], 2025).filter((x) => x.mois === 8)).toEqual([
    { mois: 8, univers: 'cave', famille: 'Vin', caHT: 6_000, caTTC: null, margeHT: null, reparti: true },
    { mois: 8, univers: 'cave', famille: 'Spiritueux', caHT: 2_000, caTTC: null, margeHT: null, reparti: true },
  ])
  // Janvier : aucun mois précédent, d'autres mois de l'année détaillés
  expect(referenceRepartition(n, [], 1, 'cave')!.source).toBe('les autres mois de l’année')
  // Rien cette année : toute l'année dernière (Vin 7 000, Bière 4 000)
  expect(referenceRepartition([], n1, 1, 'cave')!.parts.map((p) => [p.famille, p.partCA])).toEqual([['Vin', 7_000 / 11_000], ['Bière', 4_000 / 11_000]])
  // Aucune référence : la ligne reste « Non détaillé »
  expect(repartirNonDetaille([l(2, 'bar', NON_DETAILLE, 500, null, null)], [])).toEqual([l(2, 'bar', NON_DETAILLE, 500, null, null)])
  // Un mois déjà réparti ne sert pas de référence
  expect(referenceRepartition([{ ...l(7, 'bar', 'Fût', 1_000, null, null), reparti: true }], [], 8, 'bar')).toBeNull()
})

test('arrondi au centime, la dernière famille prend le reste', () => {
  const ref = { source: 'x', ratioTTC: null, parts: [{ famille: 'A', partCA: 1 / 3, partMarge: null }, { famille: 'B', partCA: 1 / 3, partMarge: null }, { famille: 'C', partCA: 1 / 3, partMarge: null }] }
  expect(repartirLigne(l(1, 'cave', NON_DETAILLE, 100, null, 10), ref).map((x) => [x.caHT, x.margeHT])).toEqual([[33.33, 3.33], [33.33, 3.33], [33.34, 3.34]])
})

test('saisie par univers : une ligne « Non détaillé », TTC déduit s’il manque, l’Extérieur sur sa famille ; passage au détail pré-rempli', () => {
  const s = { ventes: {}, tickets: { cave: '900' }, parUnivers: { cave: { caHT: '20 000', caTTC: '', margeHT: '7 200' }, exterieur: { caHT: '5 000', caTTC: '6 000', margeHT: '' } }, detail: {} }
  expect(lireSaisie(s, { cave: 1.2 })).toEqual({
    lignes: [
      { univers: 'cave', famille: NON_DETAILLE, caHT: 20_000, caTTC: 24_000, margeHT: 7_200 },
      { univers: 'exterieur', famille: 'Factures', caHT: 5_000, caTTC: 6_000, margeHT: null },
    ],
    tickets: [{ univers: 'cave', tickets: 900 }],
    erreurs: [],
  })
  expect(lireSaisie({ ventes: {}, tickets: {}, parUnivers: { bar: { caHT: '', caTTC: '', margeHT: '300' } } }).erreurs).toEqual(['Bar : le CA HT manque.'])
  // Le mois rouvert retrouve sa saisie par univers
  const relu = saisieDepuisReel([l(9, 'cave', NON_DETAILLE, 20_000, 24_000, 7_200), l(9, 'bar', 'Fût', 1_000, 1_200, 700)], [], 9)
  expect(relu.parUnivers?.cave).toEqual({ caHT: '20000', caTTC: '24000', margeHT: '7200' })
  expect(relu.detail).toEqual({ bar: true })
  // Détailler la Cave : familles pré-remplies selon septembre de l'an dernier, TTC déduit
  const ref = referenceRepartition([], n1, 9, 'cave', 2025)
  const d = detaillerUnivers({ ...s, parUnivers: { cave: { caHT: '20000', caTTC: '', margeHT: '7200' } } }, 'cave', ref)
  expect(d.detail?.cave).toBe(true)
  expect(d.ventes['cave/Vin']).toEqual({ caHT: '12000', caTTC: '14400', margeHT: '4800' })
  expect(lireSaisie(d).lignes.filter((x) => x.univers === 'cave').map((x) => x.famille)).toEqual(['Bière', 'Vin'])
})
