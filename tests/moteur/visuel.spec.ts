import { expect, test } from '@playwright/test'
import type { ResultatQuadrimestre } from '../../src/moteur/quadrimestre'
import type { MoisTresorerie, Tresorerie } from '../../src/moteur/tresorerie'
import { tresorerieGlissante } from '../../src/moteur/tresorerie'
import { niveauEcart, planTresorerie, pontEBE, tendance } from '../../src/moteur/visuel'

// Refonte visuelle (2/11/2026) : pastilles réel / prévu, pont d'écart de l'EBE, plan de trésorerie. Chiffres vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

test('pastille : au prévu ou mieux, dans le seuil, au-delà ; sens inversé pour une charge', () => {
  expect(niveauEcart(100, 100, 0.05)).toBe('favorable')
  expect(niveauEcart(104, 100, 0.05)).toBe('favorable')
  expect(niveauEcart(96, 100, 0.05)).toBe('leger')       // −4 %
  expect(niveauEcart(95, 100, 0.05)).toBe('leger')       // −5 % tout juste : dans le seuil
  expect(niveauEcart(94, 100, 0.05)).toBe('fort')        // −6 %
  expect(niveauEcart(96, 100, 0.05, true)).toBe('favorable') // charge plus basse que prévu
  expect(niveauEcart(103, 100, 0.05, true)).toBe('leger')
  expect(niveauEcart(110, 100, 0.05, true)).toBe('fort')
  expect(niveauEcart(null, 100, 0.05)).toBeNull()
  expect(niveauEcart(50, 0, 0.05)).toBeNull()
})

// Magasin fictif, janvier à août : CA 400 000 € pour 420 000 € budgétés, taux de marge 38 % pour 40 % au budget
const quadri = {
  ca: 400_000, marge: 152_000, chargesExternes: 50_000, impotsTaxes: 6_000, personnel: 70_000, ebe: 26_000,
  budget: { ca: 420_000, marge: 168_000, chargesExternes: 48_000, impotsTaxes: 6_500, personnel: 72_000, ebe: 41_500 },
} as unknown as ResultatQuadrimestre

test('pont d’écart de l’EBE : chaque marche, et leur somme est l’écart d’EBE', () => {
  const p = pontEBE(quadri)!
  expect(p.budget).toBe(41_500)
  expect(p.reel).toBe(26_000)
  const m = Object.fromEntries(p.marches.map((x) => [x.cle, x.montant]))
  proche(m.ca, -8_000)              // −20 000 € de CA × 40 % de marge du budget
  proche(m.tauxMarge, -8_000)       // −2 points × 400 000 € de CA réel
  proche(m.personnel, 2_000)        // 70 000 € au lieu de 72 000 € : gagne
  proche(m.chargesExternes, -2_000) // 50 000 € au lieu de 48 000 € : perd
  proche(m.impotsTaxes, 500)
  proche(p.marches.reduce((a, x) => a + x.montant, 0), 26_000 - 41_500)
  expect(pontEBE({ ...quadri, ebe: null } as ResultatQuadrimestre)).toBeNull()
  expect(pontEBE({ ...quadri, budget: null } as ResultatQuadrimestre)).toBeNull()
})

// Trésorerie prévue : chaque mois 12 000 € de ventes TTC encaissées, 11 000 € décaissés dont 1 000 € de consignes
// remboursées (donc 10 000 € nets), départ 20 000 € : +1 000 € par mois
const m = (i: number): MoisTresorerie => ({
  encaissements: 12_000, consignesRemboursees: 1_000, decaissements: 11_000, flux: 2_000 - 1_000, fin: 20_000 + 1_000 * (i + 1),
} as unknown as MoisTresorerie)
const prevue = { debut: 20_000, mois: Array.from({ length: 12 }, (_, i) => m(i)), fin: 32_000 } as unknown as Tresorerie

test('plan de trésorerie : encaissé chaque mois, solde et décaissé réels au quadrimestre', () => {
  // Réel : janvier à mai encaissés (11 000 € par mois), solde fin avril saisi à 15 000 €, départ réel 20 000 €
  const enc = [11_000, 11_000, 11_000, 11_000, 11_000, null, null, null, null, null, null, null]
  const projection = tresorerieGlissante(prevue, { montant: 15_000, mois: 3 })
  const p = planTresorerie(prevue, enc, { 1: 15_000 }, 20_000, projection, 4)
  expect(p.mois[0]).toEqual({ encReel: 11_000, encPrevu: 12_000, decPrevu: 10_000, finPrevue: 21_000, finReelle: null, finProjetee: null })
  expect(p.mois[3].finReelle).toBe(15_000)
  expect(p.mois[3].finProjetee).toBe(15_000)              // la projection part du solde réel
  expect(p.mois[4].finProjetee).toBe(16_000)              // puis les flux prévus : +1 000 € par mois
  expect(p.mois[11].finProjetee).toBe(23_000)
  const q1 = p.quadrimestres[0]
  expect(q1.encReel).toBe(44_000)
  expect(q1.encPrevu).toBe(48_000)
  expect(q1.decReel).toBe(20_000 + 44_000 - 15_000)       // 49 000 € déduits
  expect(q1.decPrevu).toBe(40_000)
  expect(q1.finPrevue).toBe(24_000)
  expect(q1.ecart).toBe(-9_000)
  expect(p.quadrimestres[1].encReel).toBeNull()            // juin à août pas encore encaissés
  expect(p.quadrimestres[1].decReel).toBeNull()
  expect(p.dernierReel).toEqual({ mois: 3, montant: 15_000, prevu: 24_000, ecart: -9_000 })
  expect(p.pointBas).toEqual({ montant: 16_000, mois: 4, source: 'projection' })
})

test('plan de trésorerie sans solde réel : point bas sur le prévu des mois à venir', () => {
  const p = planTresorerie(prevue, [], {}, null, null, 8)
  expect(p.dernierReel).toBeNull()
  expect(p.quadrimestres[0].decReel).toBeNull()
  expect(p.pointBas).toEqual({ montant: 30_000, mois: 9, source: 'prevu' })  // fin octobre
  expect(planTresorerie(prevue, [], {}, null, null, 11).pointBas).toBeNull()
})

test('ligne de tendance : cumul sur les seuls mois connus des deux côtés', () => {
  // Réel janvier à mars (mars sans marge connue) ; budget toute l'année
  const t = tendance([100, 120, null, null], [110, 100, 90, 80])!
  expect(t).toEqual({ reel: 220, reference: 210, ecart: 10, part: 220 / 210 - 1, mois: 2 })
  expect(tendance([null], [100])).toBeNull()
  expect(tendance([50], [0])!.part).toBeNull()
})
