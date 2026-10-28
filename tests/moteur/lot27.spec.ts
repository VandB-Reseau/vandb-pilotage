import { expect, test } from '@playwright/test'
import type { LigneCompte } from '../../src/moteur/compteResultat'
import { regrouper, regrouperCompte } from '../../src/moteur/periodes'
import { cumul, cumulApres, totalBudgets } from '../../src/moteur/sante'
import { plusGrosseSortie, type MoisTresorerie } from '../../src/moteur/tresorerie'
import type { Budget } from '../../src/moteur/types'

// Lot 27 : regroupements par période, cumuls, plus grosse sortie de trésorerie, total de la liste. Chiffres simples, vérifiés à la main.
const douze = (f: (i: number) => number) => Array.from({ length: 12 }, (_, i) => f(i))

test('regrouper : quadrimestres et année en somme, trésorerie au dernier mois de la période', () => {
  const v = douze((i) => i + 1)                                    // 1 à 12
  expect(regrouper(v, 'mois')).toEqual(v)
  expect(regrouper(v, 'quadrimestre')).toEqual([10, 26, 42])       // 1+2+3+4, 5+6+7+8, 9+10+11+12
  expect(regrouper(v, 'annee')).toEqual([])                        // l'année n'a que la colonne Total
  expect(regrouper(v, 'quadrimestre', 'dernier')).toEqual([4, 8, 12])
})

test('compte par quadrimestre : CA par heure recalculé, lignes annuelles vides', () => {
  const ligne = (cle: string, mois: (number | null)[], o: Partial<LigneCompte> = {}): LigneCompte =>
    ({ cle, libelle: cle, mois, total: mois.reduce<number>((a, b) => a + (b ?? 0), 0), ...o })
  // CA 1 000 € par mois au premier quadrimestre, 2 000 € ensuite ; 100 heures en janvier, 50 les autres mois
  const ca = douze((i) => (i < 4 ? 1_000 : 2_000))
  const heures = douze((i) => (i === 0 ? 100 : 50))
  const lignes = [
    ligne('ca', ca),
    ligne('heures', heures, { indicateur: true, heures: true }),
    ligne('productivite', ca.map((c, i) => c / heures[i]), { indicateur: true }),
    ligne('impot', Array(12).fill(null)),
  ]
  const q = regrouperCompte(lignes, 'quadrimestre')
  expect(q[0].mois).toEqual([4_000, 8_000, 8_000])
  expect(q[1].mois).toEqual([250, 200, 200])
  // 4 000 € / 250 h = 16 €/h, et non la moyenne des mois (10 + 20 + 20 + 20) / 4 = 17,5
  expect(q[2].mois).toEqual([16, 40, 40])
  expect(q[3].mois).toEqual([null, null, null])
  expect(q[0].total).toBe(20_000)                                  // le total de l'année ne change pas
})

test('cumuls : la projection repart du dernier mois réalisé', () => {
  const realise = [10, 20, 30, null, null, null, null, null, null, null, null, null]
  expect(cumul(realise).slice(0, 4)).toEqual([10, 30, 60, null])
  const suite = [null, null, null, 5, 5, 5, 5, 5, 5, 5, 5, 5]
  const c = cumulApres(realise, suite)
  expect(c.slice(0, 2)).toEqual([null, null])
  expect(c[2]).toBe(60)                                            // la courbe projetée part du réel de mars
  expect(c[3]).toBe(65)
  expect(c[11]).toBe(105)                                          // 60 + 9 × 5
})

test('plus grosse sortie du mois : la plus forte des sorties, aucune si tout est à zéro', () => {
  const zero: MoisTresorerie = {
    encaissements: 0, fournisseurs: 0, frais: 0, personnel: 0, tva: 0, emprunts: 0, impot: 0, travaux: 0,
    consignesVersees: 0, consignesRemboursees: 0, consignesEnAttente: 0, decaissements: 0, flux: 0, fin: 0,
  }
  expect(plusGrosseSortie({ ...zero, encaissements: 50_000 })).toBeNull()
  expect(plusGrosseSortie({ ...zero, fournisseurs: 30_000, personnel: 12_000, travaux: 45_000 })).toEqual({ cle: 'travaux', montant: 45_000 })
  // Un crédit de TVA (négatif) n'est jamais une sortie
  expect(plusGrosseSortie({ ...zero, tva: -8_000, frais: 2_000 })).toEqual({ cle: 'frais', montant: 2_000 })
})

test('total de la liste : ratios sur les sommes, pas moyenne des ratios', () => {
  const b = (ca: number, marge: number, personnel: number, ebe: number) => ({ ca, marge, personnel, ebe }) as Budget
  const t = totalBudgets([b(600_000, 240_000, 108_000, 60_000), b(400_000, 120_000, 72_000, 8_000)])
  expect(t).toMatchObject({ magasins: 2, ca: 1_000_000, marge: 360_000, ebe: 68_000 })
  expect(t.tauxMarge).toBeCloseTo(0.36, 9)                         // 360 000 / 1 000 000
  expect(t.personnelSurMarge).toBeCloseTo(0.5, 9)                  // 180 000 / 360 000
  expect(t.ebeSurCA).toBeCloseTo(0.068, 9)                         // 68 000 / 1 000 000
  // Moyenne des taux de marge : (40 % + 30 %) / 2 = 35 %, faux ; 360 / 1 000 = 36 %
  expect(totalBudgets([])).toEqual({ magasins: 0, ca: 0, marge: 0, ebe: 0, tauxMarge: 0, personnelSurMarge: 0, ebeSurCA: 0 })
})
