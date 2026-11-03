import { expect, test } from '@playwright/test'
import type { SaisieQuadrimestre } from '../../src/moteur/quadrimestre'
import { demarqueBudget, reelComplete, sourceDe } from '../../src/moteur/reelComplete'
import { stockComplete, stockEstime } from '../../src/moteur/stock'
import type { MoisReel } from '../../src/moteur/suivi'
import type { Budget } from '../../src/moteur/types'

// Réel complété mois par mois (03/11/2026) sur un magasin fictif : chaque résultat se vérifie à la main.
const proche = (v: number | null | undefined, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const vide: MoisReel = { caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }

// Caisse : CA de janvier à juin 40 000, 40 000, 60 000, 60 000, 50 000, 30 000 ; marge caisse 40 %, sauf en juin où une
// famille de 10 000 € n'a pas de marge (8 000 de marge sur 20 000)
const ca = [40_000, 40_000, 60_000, 60_000, 50_000, 30_000]
const reel: MoisReel[] = Array.from({ length: 12 }, (_, i) => (i < 6
  ? { caHT: ca[i], margeHT: i === 5 ? 8_000 : ca[i] * 0.4, caAvecMarge: i === 5 ? 20_000 : ca[i], caTTC: 0, tickets: 0 }
  : vide))
// Budget : 48 000 € de CA par mois, 19 200 de marge, 7 000 de charges externes, 500 d'impôts ; personnel 9 000, 9 000,
// 10 000, 12 000 sur janvier à avril, puis 10 000 ; démarque visée 1 %
const personnelB = [9_000, 9_000, 10_000, 12_000, 10_000, 10_000, 9_700, 9_700, 9_700, 9_700, 9_700, 9_700]
const budget = {
  tauxMarge: 0.4,
  familles: [{ objectif: 576_000, demarque: 0.01 }],
  mois: personnelB.map((p) => ({ ca: 48_000, marge: 19_200, chargesExternes: 7_000, impotsTaxes: 500, personnel: p, ebe: 19_200 - 7_000 - 500 - p })),
} as unknown as Budget
const taux = { tauxRedevance: 0.02, tauxPublicite: 0.01 }
// Premier quadrimestre : 125 000 d'achats, 3 000 de stock en plus, 30 000 de charges externes, 2 000 d'impôts, 44 000 de personnel
const q1: SaisieQuadrimestre = { achats: 125_000, variationStock: 3_000, chargesExternes: 30_000, impotsTaxes: 2_000, personnel: 44_000, tresorerie: 15_000 }

test('quadrimestre réparti : démarque au prorata du CA, charges au prorata du budget, total exact', () => {
  const r = reelComplete(reel, { 1: q1 }, budget, taux, 2027)
  // Marge réelle 200 000 − 122 000 = 78 000 ; marge caisse 80 000 : 2 000 de démarque, portée à 20 %, 20 %, 30 %, 30 %
  expect(r.mois.slice(0, 4).map((m) => m!.marge.valeur)).toEqual([15_600, 15_600, 23_400, 23_400])
  // Personnel 44 000 pour 40 000 budgétés : chaque mois × 1,1
  r.mois.slice(0, 4).forEach((m, i) => proche(m!.personnel.valeur, [9_900, 9_900, 11_000, 13_200][i]))
  r.mois.slice(0, 4).forEach((m) => { proche(m!.chargesExternes.valeur, 7_500); proche(m!.impotsTaxes.valeur, 500) })
  // EBE : janvier 15 600 − 9 900 − 7 500 − 500 = −2 300 ; mars 23 400 − 11 000 − 7 500 − 500 = 4 400
  proche(r.mois[0]!.ebe.valeur, -2_300)
  proche(r.mois[2]!.ebe.valeur, 4_400)
  proche(r.mois[3]!.ebe.valeur, 2_200)
  // La somme des 4 mois redonne l'EBE du quadrimestre : 78 000 − 44 000 − 30 000 − 2 000
  proche(r.mois.slice(0, 4).reduce((a, m) => a + m!.ebe.valeur, 0), 2_000)
  expect(r.mois[0]!.ebe.source).toBe('reparti')
  expect(r.mois[0]!.ca.source).toBe('reel')
  expect(r.mois[0]!.quadrimestre).toBe(1)
})

test('mois sans quadrimestre : marge caisse moins la démarque du budget, charges du budget, redevance sur le CA réel', () => {
  const r = reelComplete(reel, { 1: q1 }, budget, taux, 2027)
  const mai = r.mois[4]!, juin = r.mois[5]!
  proche(mai.marge.valeur, 19_500)                  // 20 000 − 1 % de 50 000
  proche(mai.personnel.valeur, 10_000)
  proche(mai.chargesExternes.valeur, 7_060)         // 7 000 + 3 % de (50 000 − 48 000)
  proche(mai.ebe.valeur, 1_940)
  expect(mai.ebe.source).toBe('estime')
  expect(mai.quadrimestre).toBeNull()
  // Juin : marge caisse de 40 % étendue à tout le CA (12 000), moins 300 de démarque ; charges 7 000 − 3 % de 18 000
  proche(juin.marge.valeur, 11_700)
  proche(juin.chargesExternes.valeur, 6_460)
  proche(juin.ebe.valeur, -5_260)
  expect(r.mois[6]).toBeNull()
  expect(r.realises).toBe(6)
  expect(r.moisRepartis).toBe(4)
  expect(r.moisEstimes).toBe(2)
  proche(r.cumul!.ebe.valeur, 2_000 + 1_940 - 5_260)
  expect(r.cumul!.ebe.source).toBe('estime')
  expect(r.cumul!.ca.source).toBe('reel')
  proche(r.budget.ebe, 2_700 + 2_700 + 1_700 - 300 + 1_700 + 1_700)
})

test('saisie partielle, nombre de jours sans budget, quadrimestre au-delà de la caisse', () => {
  // Impôts non saisis : estimés au budget, l'EBE du mois est alors estimé
  const partiel = reelComplete(reel, { 1: { ...q1, impotsTaxes: null } }, budget, taux, 2027)
  expect(partiel.mois[0]!.impotsTaxes.source).toBe('estime')
  expect(partiel.mois[0]!.personnel.source).toBe('reparti')
  expect(partiel.mois[0]!.ebe.source).toBe('estime')
  // Sans personnel au budget : au prorata des jours (2027 : 31, 28, 31, 30 sur 120)
  const sansPersonnel = { ...budget, mois: budget.mois.map((m) => ({ ...m, personnel: 0 })) } as Budget
  const j = reelComplete(reel, { 1: { ...q1, personnel: 12_000 } }, sansPersonnel, taux, 2027)
  expect(j.mois.slice(0, 4).map((m) => Math.round(m!.personnel.valeur))).toEqual([3_100, 2_800, 3_100, 3_000])
  // Caisse jusqu'en février seulement, premier quadrimestre saisi : quatre mois complétés
  const court = reel.map((m, i) => (i < 2 ? m : vide))
  expect(reelComplete(court, { 1: q1 }, budget, taux, 2027).realises).toBe(4)
  expect(reelComplete(court, {}, budget, taux, 2027).realises).toBe(2)
  expect(reelComplete(reel.map(() => vide), {}, budget, taux, 2027).cumul).toBeNull()
})

test('démarque du budget et source la moins sûre', () => {
  proche(demarqueBudget({ familles: [{ objectif: 400_000, demarque: 0.01 }, { objectif: 100_000, demarque: 0.03 }] } as unknown as Budget), 0.014)
  expect(demarqueBudget({ familles: [] } as unknown as Budget)).toBe(0)
  expect(sourceDe('reel', 'reparti')).toBe('reparti')
  expect(sourceDe('reparti', 'estime', 'reel')).toBe('estime')
})

test('stock non saisi : couverture qui glisse d’une saisie à l’autre', () => {
  const plat = Array(12).fill(10_000)
  const saisies: (number | null)[] = Array(12).fill(null)
  saisies[4] = 30_000                                    // fin mai : 3 mois couverts
  // Fin décembre 50 000 : 5 mois ; janvier à avril 4,6 · 4,2 · 3,8 · 3,4 mois de 10 000
  const e = stockEstime(plat, saisies, 50_000)
  e.slice(0, 4).forEach((v, i) => proche(v, [46_000, 42_000, 38_000, 34_000][i]))
  expect(e[4]).toBeNull()                                // saisi
  expect(e[5]).toBeNull()                                // après la dernière saisie
  // Ventes en dents de scie (10 000 puis 20 000) : fin décembre 25 000 = 1,75 mois ; fin février 30 000 = 2 mois ;
  // janvier à 1,875 mois : février 20 000 + 0,875 × 10 000 de mars = 28 750 (la ligne droite donnerait 27 500)
  const scie = Array.from({ length: 12 }, (_, i) => (i % 2 ? 20_000 : 10_000))
  const f: (number | null)[] = Array(12).fill(null)
  f[1] = 30_000
  proche(stockEstime(scie, f, 25_000)[0], 28_750)
  // Sans stock de décembre : même couverture que la première saisie, 2 mois depuis février
  proche(stockEstime(scie, f)[0], 30_000)
  // Sans achats connus : ligne droite entre deux saisies, valeur de la première saisie avant elle
  const g: (number | null)[] = Array(12).fill(null)
  g[1] = 10_000; g[4] = 40_000
  const sans = stockEstime(Array(12).fill(0), g)
  expect(sans.slice(0, 4)).toEqual([10_000, null, 20_000, 30_000])
})

test('stock complet : Cave et Bar séparés, mois marqué estimé', () => {
  const cout = { cave: Array(12).fill(10_000), bar: Array(12).fill(2_000), exterieur: Array(12).fill(0) }
  const s = Array(12).fill(null)
  s[1] = { cave: 30_000, bar: null }
  s[2] = { cave: 30_000, bar: 4_000 }
  const c = stockComplete(cout, s)
  expect(c[0]).toEqual({ cave: 30_000, bar: 4_000, total: 34_000, estime: true })
  expect(c[1]).toEqual({ cave: 30_000, bar: 4_000, total: 34_000, estime: true })   // Bar estimé
  expect(c[2]).toEqual({ cave: 30_000, bar: 4_000, total: 34_000, estime: false })
  expect(c[3]).toEqual({ cave: null, bar: null, total: null, estime: false })
})
