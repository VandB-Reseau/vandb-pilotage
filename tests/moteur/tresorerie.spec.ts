import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { tresorerieBudget, tresorerieParDefaut } from '../../src/moteur/tresorerie'
import type { Budget, Hypotheses } from '../../src/moteur/types'
import { magasinFictif } from '../donnees-fictives'

// Trésorerie du budget sur des magasins fictifs : chaque résultat se vérifie à la main.
const proche = (v: number, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const p = { tauxRedevance: 0.02, tauxPublicite: 0.01 }

// Mois tous identiques : 10 000 € de CA HT, 6 000 € d'achats, 2 000 € de personnel ; loyer 12 000 € par an (avec TVA),
// assurance 1 200 € par an (sans TVA) ; intérêts 1 200 € et capital 2 400 € par an ; impôt 4 000 €
const budget = { mois: Array.from({ length: 12 }, () => ({ ca: 10_000, achats: 6_000, personnel: 2_000 })), impot: 4_000 } as unknown as Budget
const h = {
  frais: [{ code: 'loyer', libelle: 'Loyer', rubrique: 'immobilier', annuel: 12_000 }, { code: 'assurance', libelle: 'Assurance', rubrique: 'banque_assurances', annuel: 1_200 }],
  interets: 1_200, remboursementCapital: 2_400,
} as unknown as Hypotheses

test('trésorerie : encaissements, décaissements et TVA d’un mois type', () => {
  const t = tresorerieBudget(budget, h, p, tresorerieParDefaut, 5_000)
  const janvier = t.mois[0]
  proche(janvier.encaissements, 11_900)       // 10 000 × 1,19
  proche(janvier.fournisseurs, 7_200)         // achats de décembre, régime établi : 6 000 × 1,2
  proche(janvier.frais, 1_660)                // redevance et publicité 300 × 1,2 + loyer 1 000 × 1,2 + assurance 100
  proche(janvier.personnel, 2_000)            // 60 % du mois + 40 % du mois précédent
  proche(janvier.tva, 440)                    // 1 900 collectée − 1 200 sur achats − 260 sur frais
  proche(janvier.emprunts, 300)
  expect(janvier.impot).toBe(0)
  proche(janvier.flux, 300)
  proche(t.mois[2].impot, 1_000)              // acompte de mars
  proche(t.mois[2].fin, 5_000 + 300 + 300 - 700)
  // Sur l'année : EBE 7 200 − intérêts 1 200 − capital 2 400 − impôt 4 000 = −400
  proche(t.fin, 4_600)
  expect(t.pointBas).toEqual({ montant: expect.closeTo(4_600, 6), mois: 11 })
  expect(t.moisNegatifs).toBe(0)
})

test('trésorerie : travaux payés le premier mois fermé, TVA récupérée le mois suivant ; TVA trimestrielle', () => {
  const travaux = { activite: [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1], gain: 0, investissement: 12_000, dureeAmortissement: 5 }
  const t = tresorerieBudget(budget, { ...h, travaux }, p, tresorerieParDefaut)
  proche(t.mois[2].travaux, 14_400)
  proche(t.mois[3].tva, 440 - 2_400)          // crédit de TVA des travaux
  proche(t.fin, -400 - 12_000)
  expect(t.pointBas.mois).toBe(2)
  proche(t.pointBas.montant, 600 - 700 - 14_400)
  expect(t.moisNegatifs).toBeGreaterThan(0)

  const q = tresorerieBudget(budget, h, p, { ...tresorerieParDefaut, tvaTrimestrielle: true })
  proche(q.mois[0].tva, 1_320)                // trimestre d'octobre à décembre, payé en janvier
  expect(q.mois[1].tva).toBe(0)
  proche(q.mois[3].tva, 1_320)
  proche(q.fin, -400)
})

test('trésorerie du magasin fictif : saisonnalité, délais et TVA ne changent pas la variation de l’année', () => {
  const travaux = { activite: [1, 1, 1, 1, 1, 1, 0.5, 0, 1, 1, 1, 1], gain: 0.1, investissement: 30_000, dureeAmortissement: 5 }
  const hyp = { ...magasinFictif, travaux }
  const b = calculerBudget(hyp, parametresParDefaut)
  for (const reglages of [tresorerieParDefaut, { ...tresorerieParDefaut, delaiFournisseurs: 2, delaiRedevance: 0, tvaTrimestrielle: true, partCotisations: 0.5 }]) {
    const t = tresorerieBudget(b, hyp, parametresParDefaut, reglages, 20_000)
    proche(t.fin - 20_000, b.tresorerieDegagee - 30_000)
  }
  // Fournisseurs de janvier : achats de décembre
  const t = tresorerieBudget(b, hyp, parametresParDefaut, tresorerieParDefaut)
  proche(t.mois[0].fournisseurs, b.mois[11].achats * 1.2)
  proche(t.mois[6].travaux, 36_000)           // juillet, premier mois touché
})

test('consignes : payées avec les achats, remboursées deux mois après (un mois pour écouler le fût, 30 jours fin de mois)', () => {
  // Bar seul : 130 000 € de CA (10 000 € par mois, 20 000 € en décembre), 78 000 € d'achats ; consigne 15 % des achats,
  // soit 0,09 € par euro de CA : 900 € par mois, 1 800 € en décembre
  const ca = [...Array(11).fill(10_000), 20_000]
  const saison = {
    ca: 130_000, impot: 0,
    mois: ca.map((c) => ({ ca: c, achats: c * 0.6, personnel: 0 })),
    familles: [{ univers: 'bar', famille: 'Fût', objectif: 130_000, margeObjectif: 52_000 }],
  } as unknown as Budget
  const reglages = { ...tresorerieParDefaut, consignes: { achats: { cave: 0, bar: 0.15, exterieur: 0 }, ecoulement: 1, remboursement: 1 } }
  const t = tresorerieBudget(saison, { frais: [], interets: 0, remboursementCapital: 0 } as unknown as Hypotheses, p, reglages)
  const [jan, fev, dec] = [t.mois[0], t.mois[1], t.mois[11]]
  proche(jan.consignesVersees, 900)
  proche(jan.consignesRemboursees, 900)       // vides de novembre
  proche(fev.consignesRemboursees, 1_800)     // vides de décembre
  proche(dec.consignesVersees, 1_800)
  proche(dec.consignesRemboursees, 900)       // vides d'octobre
  proche(dec.consignesEnAttente, 2_700)       // décembre et novembre pas encore remboursés
  proche(jan.consignesEnAttente, 900 + 1_800)
  proche(t.consignesMoyennes, (10 * 1_800 + 2 * 2_700) / 12)   // 2 700 en décembre et janvier, 1 800 les autres mois
  // Sur l'année, les consignes s'annulent : seul l'EBE compte (40 % de 130 000 = 52 000, TVA comprise à l'équilibre)
  const sans = tresorerieBudget(saison, { frais: [], interets: 0, remboursementCapital: 0 } as unknown as Hypotheses, p, { ...tresorerieParDefaut, consignes: undefined })
  proche(t.fin, sans.fin)
  // Le mois de décembre est plus creux avec les consignes : − 1 800 + 900
  proche(dec.flux - sans.mois[11].flux, -900)
  proche(jan.flux - sans.mois[0].flux, 0)
  proche(fev.flux - sans.mois[1].flux, -900 + 1_800)              // vides de décembre remboursés
})
