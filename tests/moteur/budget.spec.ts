import { expect, test } from '@playwright/test'
import { calculerBudget, impotSocietes, partRealiseeReference, poidsMensuels } from '../../src/moteur/budget'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { magasinFictif } from '../donnees-fictives'

// Magasin fictif aux chiffres ronds : chaque résultat attendu se vérifie à la main (calcul détaillé en commentaire).
// Aucune donnée réelle : le dépôt est public.
const b = calculerBudget(magasinFictif, parametresParDefaut)
const proche = (valeur: number, attendu: number) => expect(valeur).toBeCloseTo(attendu, 6)

test('les poids mensuels totalisent 100 % (le prévisionnel Excel faisait 102,1 %)', () => {
  proche(b.poids.reduce((a, x) => a + x, 0), 1)
  proche(b.poids[0], 60_000 / 800_000)
  proche(b.poids[11], 80_000 / 800_000)
  proche(poidsMensuels([]).reduce((a, x) => a + x, 0), 1)
})

test('atterrissage sur 12 mois : réalisé / part réalisée à la même date, sans 13e mois', () => {
  // 8 mois × 60 000 = 480 000 sur 800 000 : 60 % de l'année réalisée à fin août
  proche(partRealiseeReference(magasinFictif.caMensuelReference, 8), 0.6)
  expect(b.familles.map((f) => Math.round(f.atterrissage))).toEqual([200_000, 300_000, 100_000])
  proche(b.atterrissage, 600_000)
  // Objectif : 200 000 × 1,05 + 300 000 × 1,10 + 100 000 = 640 000
  proche(b.ca, 640_000)
  // Marge : 210 000 × 38 % + 330 000 × 75 % + 100 000 × 40 % = 79 800 + 247 500 + 40 000
  proche(b.marge, 367_300)
  proche(b.mois.reduce((a, m) => a + m.ca, 0), b.ca)
})

test('une part réalisée saisie par univers remplace la part par défaut', () => {
  const autre = calculerBudget({ ...magasinFictif, partRealisee: { bar: 0.5 } }, parametresParDefaut)
  proche(autre.familles[1].atterrissage, 360_000)
  proche(autre.familles[0].atterrissage, 200_000)
})

test('achats HT dans le compte de résultat : CA × (1 − marge)', () => {
  // Janvier : 640 000 × 7,5 % = 48 000 de CA ; marge 57,390625 % ; achats 20 452,50
  proche(b.mois[0].ca, 48_000)
  proche(b.mois[0].achats, 20_452.5)
  proche(b.mois[11].ca, 64_000)
  proche(b.mois.reduce((a, m) => a + m.achats, 0), 640_000 - 367_300)
})

test('redevance 2 % et publicité 1 % du CA HT, au-dessus de l’EBE', () => {
  proche(b.redevance, 12_800)
  proche(b.publicite, 6_400)
  // Loyer 60 000 + énergie 1,3 % du CA (8 320) + honoraires 6 000 + redevance + publicité
  proche(b.chargesExternes, 93_520)
  proche(b.impotsTaxes, 3_000)
})

test('compte de résultat jusqu’à la trésorerie dégagée', () => {
  // Personnel : 12 × 12 000 + 12 × 4 000 × 1,5 = 144 000 + 72 000
  proche(b.personnel, 216_000)
  // EBE : 367 300 − 93 520 − 3 000 − 216 000
  proche(b.ebe, 54_780)
  proche(b.resultatExploitation, 30_780)
  proche(b.resultatAvantImpot, 29_580)
  // 29 580 × 15 %
  proche(b.impot, 4_437)
  proche(b.resultatNet, 25_143)
  proche(b.capaciteAutofinancement, 49_143)
  proche(b.tresorerieDegagee, 19_143)
  proche(b.ratios.personnelSurMarge, 216_000 / 367_300)
  proche(b.mois[0].productivite!, 48_000 / 880)
})

test('impôt sur les sociétés : taux réduit puis taux normal, déficit reportable déduit', () => {
  // Base 90 000 : 42 500 × 15 % + 47 500 × 25 % = 6 375 + 11 875
  proche(impotSocietes(100_000, 10_000, parametresParDefaut.impot), 18_250)
  proche(impotSocietes(-5_000, 0, parametresParDefaut.impot), 0)
})

test('seconde projection : flux × panier TTC ramené en HT', () => {
  // 6 000 tickets à fin août → 10 000 sur l'année → 10 300 avec +3 % ; 10 300 × 24 € / 1,2
  proche(b.flux.cave!.atterrissage, 10_000)
  proche(b.flux.cave!.caParPanier, 206_000)
})
