import { expect, test } from '@playwright/test'
import { baseDepuisReel } from '../../src/moteur/atterrissage'
import { calculerBudget } from '../../src/moteur/budget'
import { compteResultat } from '../../src/moteur/compteResultat'
import { dotationInvestissement, echeanceMensuelle, echeancier, financementDe } from '../../src/moteur/financement'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { tresorerieBudget } from '../../src/moteur/tresorerie'
import type { Hypotheses } from '../../src/moteur/types'
import { magasinFictif } from '../donnees-fictives'

// Investissements & Financements (Joseph, 03/11/2026). Chaque chiffre est refait à la main en commentaire.
const proche = (valeur: number, attendu: number, decimales = 2) => expect(valeur).toBeCloseTo(attendu, decimales)
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const pret = { libelle: 'Prêt travaux', montant: 60_000, taux: 0.04, duree: 7, premiereEcheance: 8 }

test('prêt neuf : échéance constante, intérêts et capital de l’année, capital encaissé le mois d’avant', () => {
  // r = 4 % ÷ 12 = 0,3333 % ; n = 84 ; 60 000 × r ÷ (1 − (1 + r)^−84) = 200 ÷ 0,243864 = 820,13
  proche(echeanceMensuelle(pret), 820.13)
  const x = echeancier(pret)
  // Août : intérêts 60 000 × r = 200,00 ; capital 620,13. Septembre : intérêts 59 379,87 × r = 197,93
  proche(x.interets[7], 200)
  proche(x.capital[7], 620.13)
  proche(x.interets[8], 197.93)
  expect(x.interets.slice(0, 7).every((v) => v === 0)).toBe(true)
  // 5 échéances d'août à décembre : 4 100,64 = 979,26 d'intérêts + 3 121,38 de capital
  proche(somme(x.interets), 979.26)
  proche(somme(x.capital), 3121.38)
  // Encaissé en juillet (mois 6 en partant de 0)
  expect(x.encaisse).toBe(6)
  // Sans taux : capital ÷ nombre d'échéances ; première échéance en janvier, encaissé en janvier
  expect(echeanceMensuelle({ montant: 12_000, taux: 0, duree: 1 })).toBe(1000)
  expect(echeancier({ ...pret, premiereEcheance: 1 }).encaisse).toBe(0)
})

test('dotation d’un investissement à partir de son mois de mise en service', () => {
  // 18 000 ÷ 5 ans × 10 mois (mars à décembre) ÷ 12 = 3 000
  expect(dotationInvestissement({ libelle: 'Tireuse', type: 'equipement', montant: 18_000, mois: 3, duree: 5 })).toBe(3000)
  // En janvier, une année pleine ; durée nulle, pas de dotation
  expect(dotationInvestissement({ libelle: 'Caisse', type: 'informatique', montant: 3_000, mois: 1, duree: 3 })).toBe(1000)
  expect(dotationInvestissement({ libelle: 'Caisse', type: 'informatique', montant: 3_000, mois: 1, duree: 0 })).toBe(0)
})

test('emprunts en cours : par douzième jusqu’au dernier mois saisi', () => {
  // Intérêts 1 200 et capital 30 000 par an ; fini en avril : 4 mois, 400 et 10 000
  const f = financementDe({ ...magasinFictif, finEmpruntsEnCours: 4 }, 0)
  proche(f.interetsEnCours, 400)
  proche(f.capitalEnCours, 10_000)
  expect(f.interetsMois[4]).toBe(0)
  // Sans dernier mois : l'année entière
  proche(financementDe(magasinFictif, 0).capitalEnCours, 30_000)
})

test('budget : dotations, intérêts mois par mois, CAF et variation de trésorerie de l’année', () => {
  const avant = calculerBudget(magasinFictif, parametresParDefaut)
  const h: Hypotheses = {
    ...magasinFictif,
    investissements: [{ libelle: 'Tireuse', type: 'equipement', montant: 18_000, mois: 3, duree: 5 }],
    emprunts: [pret],
    apport: { montant: 5_000, mois: 2 },
  }
  const b = calculerBudget(h, parametresParDefaut)
  const f = b.financement
  // L'EBE ne bouge pas ; dotations 24 000 en cours + 3 000 nouvelles
  proche(b.ebe, avant.ebe)
  proche(f.dotationsEnCours, 24_000)
  proche(f.dotationsNouvelles, 3_000)
  proche(b.amortissements, 27_000)
  // Intérêts : 1 200 en cours + 979,26 du prêt, dont 200 en août
  proche(f.interetsNouveaux, 979.26)
  proche(b.mois[7].resultatExploitation - b.mois[7].resultatAvantImpot, 100 + 200)
  // CAF = résultat net + dotations ; trésorerie dégagée = CAF − capital (30 000 + 3 121,38)
  proche(b.capaciteAutofinancement, b.resultatNet + 27_000)
  proche(b.tresorerieDegagee, b.capaciteAutofinancement - 33_121.38)
  // Échéances : 1 200 + 979,26 + 30 000 + 3 121,38 = 35 300,64
  proche(f.echeances, 35_300.64)
  proche(f.echeancesSurCAF!, 35_300.64 / b.capaciteAutofinancement, 6)
  // Variation de l'année : trésorerie dégagée − 18 000 + 60 000 + 5 000
  proche(f.variation, b.tresorerieDegagee + 47_000)
  // Compte de résultat : intérêts et capital du mois, en charge
  const lignes = compteResultat(b, h, parametresParDefaut)
  proche(lignes.find((l) => l.cle === 'interets')!.mois[7]!, -300)
  proche(lignes.find((l) => l.cle === 'capital')!.total, -33_121.38)
})

test('trésorerie : investissement TTC le mois de l’achat, prêt et apport encaissés, sur l’année la variation est celle du financement', () => {
  const h: Hypotheses = { ...magasinFictif, investissements: [{ libelle: 'Tireuse', type: 'equipement', montant: 18_000, mois: 3, duree: 5 }], emprunts: [pret], apport: { montant: 5_000, mois: 2 } }
  const b = calculerBudget(h, parametresParDefaut)
  const sans = calculerBudget(magasinFictif, parametresParDefaut)
  const t = tresorerieBudget(b, h, parametresParDefaut, parametresParDefaut.tresorerie, 0)
  const t0 = tresorerieBudget(sans, magasinFictif, parametresParDefaut, parametresParDefaut.tresorerie, 0)
  // Mars : 18 000 × 1,2 = 21 600 TTC ; la TVA (3 600) revient en déduction le mois suivant
  proche(t.mois[2].travaux, 21_600)
  proche(t.mois[1].financements, 5_000)
  proche(t.mois[6].financements, 60_000)
  // Sur l'année, l'écart de trésorerie entre les deux budgets = écart de trésorerie dégagée − 18 000 + 65 000
  // (impôt payé par acomptes sur l'année dans les deux cas : écart d'impôt compris dans la trésorerie dégagée)
  proche(t.fin - t0.fin, b.tresorerieDegagee - sans.tresorerieDegagee - 18_000 + 65_000, 0)
})

test('clients extérieurs face à l’an passé : l’écart de CA à parts égales sur leurs mois', () => {
  const avant = calculerBudget(magasinFictif, parametresParDefaut)
  // Gagné : 0 → 6 000 de mars à décembre (600 par mois) ; perdu : 4 000 → 0 sur l'année (−333,33 par mois)
  const b = calculerBudget({ ...magasinFictif, ajustementsCA: [
    { libelle: 'Comité d’entreprise', univers: 'exterieur', de: 3, a: 12, caAnPasse: 0, ca: 6_000 },
    { libelle: 'Restaurant', univers: 'exterieur', de: 1, a: 12, caAnPasse: 4_000, ca: 0 },
  ] }, parametresParDefaut)
  proche(b.ca - avant.ca, 2_000)
  proche(b.mois[0].ca - avant.mois[0].ca, -333.33)
  proche(b.mois[2].ca - avant.mois[2].ca, 600 - 333.33)
  proche(b.tempsForts!.ajustements, 2_000)
})

test('atterrissage : les mois restants suivent la répartition saisie, le total atterri ne bouge pas', () => {
  // 8 mois réalisés à 10 000 de Bière ; saisonnalité de l'an passé égale : reste 4 mois à 10 000
  const lignes = Array.from({ length: 8 }, (_, i) => ({ mois: i + 1, univers: 'cave' as const, famille: 'Bière', caHT: 10_000, caTTC: null, margeHT: 3_600 }))
  const n1 = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, univers: 'cave' as const, famille: 'Bière', caHT: 10_000, caTTC: null, margeHT: 3_600 }))
  const reel = { n: { lignes, tickets: [] }, n1: { lignes: n1, tickets: [] } }
  const sans = baseDepuisReel(reel, 2026)!
  proche(somme(sans.parMois.map((m) => m.ca)), 120_000)
  proche(sans.parMois[11].ca, 10_000)
  // Répartition saisie : décembre pèse deux fois septembre à novembre ; reste 40 000 réparti 1-1-1-2 sur 5 parts
  const repartition = [...Array(8).fill(0.08), 0.06, 0.06, 0.06, 0.12]
  const avec = baseDepuisReel(reel, 2026, [], undefined, { repartition })!
  proche(somme(avec.parMois.map((m) => m.ca)), 120_000)
  proche(avec.parMois[8].ca, 8_000)
  proche(avec.parMois[11].ca, 16_000)
  // Mois réalisés inchangés
  proche(avec.parMois[0].ca, 10_000)
})
