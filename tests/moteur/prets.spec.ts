import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { avecPrets, echeancesPret, financementDe, finPret, mensualitePret, pretsDeLAnnee, pretsDeuxAnnees, pretValide, restantDu } from '../../src/moteur/financement'
import { avecPretsBudget, lignesFraisBudget } from '../../src/moteur/fraisBudget'
import { parametresParDefaut } from '../../src/moteur/parametres'
import type { Hypotheses, Pret } from '../../src/moteur/types'
import { magasinFictif } from '../donnees-fictives'

// Prêts du magasin (Joseph, 03/11/2026) : saisis une fois, lus pour n'importe quelle année. Chaque chiffre est refait à la
// main en commentaire (r = 4 % ÷ 12 = 0,3333 % par mois).
const proche = (valeur: number, attendu: number, decimales = 2) => expect(valeur).toBeCloseTo(attendu, decimales)
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const travaux: Pret = { libelle: 'Prêt travaux', mode: 'initial', montant: 60_000, taux: 0.04, duree: 7, debut: '2027-04' }
const differe: Pret = { libelle: 'Prêt avec différé', mode: 'initial', montant: 60_000, taux: 0.04, duree: 7, debut: '2027-01', differe: 6 }
const restant: Pret = { libelle: 'Prêt de création', mode: 'restant', montant: 30_000, taux: 0.04, duree: 0, debut: '2027-01', mensualite: 600 }

test('prêt d’après le tableau de la banque : échéance, première échéance, fin et capital restant dû', () => {
  // 60 000 × r ÷ (1 − (1 + r)^−84) = 200 ÷ 0,243864 = 820,13
  proche(mensualitePret(travaux), 820.13)
  const x = echeancesPret(travaux)
  expect(x.echeances).toHaveLength(84)
  // 1re échéance (avril 2027) : intérêts 60 000 × r = 200,00 ; capital 820,13 − 200 = 620,13
  proche(x.echeances[0].interets, 200)
  proche(x.echeances[0].capital, 620.13)
  // Signé en mars 2027, le mois d'avant (sans flux de trésorerie) ; tout le capital est remboursé, dernière échéance 84 mois plus tard
  expect(x.encaisse?.montant).toBe(60_000)
  proche(somme(x.echeances.map((e) => e.capital)), 60_000)
  expect(finPret(travaux)).toBe('2034-03')
  // Restant dû au 1er janvier 2028 : 60 000 − 5 656,15 remboursés d'avril à décembre = 54 343,85 ; rien avant la signature
  proche(restantDu(travaux, 2028), 54_343.85)
  expect(restantDu(travaux, 2027)).toBe(0)
})

test('une année puis la suivante : le prêt neuf la 1re année, en cours ensuite', () => {
  // 2027 : 9 échéances d'avril à décembre, 9 × 820,13 = 7 381,16 = 1 725,00 d'intérêts + 5 656,15 de capital
  const a = pretsDeLAnnee([travaux], 2027)
  proche(a.nouveaux.interets, 1_725.00)
  proche(a.nouveaux.capital, 5_656.15)
  expect(a.nouveaux.montant).toBe(60_000)
  expect(a.encaissementsMois[2]).toBe(60_000)
  expect(a.enCours).toEqual({ interets: 0, capital: 0 })
  expect(a.interetsMois.slice(0, 3)).toEqual([0, 0, 0])
  proche(a.interetsMois[3], 200)
  // 2028 : 12 × 820,13 = 9 841,54 = 2 031,60 + 7 809,94 ; plus de signature
  const b = pretsDeLAnnee([travaux], 2028)
  proche(b.enCours.interets, 2_031.60)
  proche(b.enCours.capital, 7_809.94)
  expect(b.nouveaux.montant).toBe(0)
  expect(somme(b.encaissementsMois)).toBe(0)
  // 2026 : pas encore signé, rien
  expect(somme(pretsDeLAnnee([travaux], 2026).interetsMois)).toBe(0)
})

test('différé : intérêts seuls, puis échéance constante sur la durée restante', () => {
  // 6 mois à 200 d'intérêts ; puis 60 000 × r ÷ (1 − (1 + r)^−78) = 874,83 par mois
  proche(mensualitePret(differe), 874.83)
  const x = echeancesPret(differe)
  expect(x.echeances.slice(0, 6).every((e) => e.capital === 0 && Math.abs(e.interets - 200) < 0.001)).toBe(true)
  // 2027 : 1 200 + 6 × 874,83 = 6 449,00 = 2 366,11 d'intérêts + 4 082,89 de capital ; signé en décembre 2026 : en cours
  const a = pretsDeLAnnee([differe], 2027)
  proche(a.enCours.interets, 2_366.11)
  proche(a.enCours.capital, 4_082.89)
  expect(a.nouveaux.montant).toBe(0)
})

test('sans le tableau : capital restant dû et mensualité', () => {
  // 30 000 à 600 par mois : 2027 = 12 × 600 = 7 200 = 1 088,77 d'intérêts + 6 111,23 de capital
  const a = pretsDeLAnnee([restant], 2027)
  proche(a.enCours.interets, 1_088.77)
  proche(a.enCours.capital, 6_111.23)
  expect(somme(a.encaissementsMois)).toBe(0)
  // 55 échéances, la dernière (juillet 2031) ne paie que le solde : 471,14 de capital
  const x = echeancesPret(restant)
  expect(x.echeances).toHaveLength(55)
  proche(x.echeances[54].capital, 471.14)
  expect(finPret(restant)).toBe('2031-07')
  // Une mensualité qui ne couvre pas les intérêts (30 000 × r = 100) ne fait pas un prêt
  expect(pretValide({ ...restant, mensualite: 100 })).toBe(false)
  expect(pretValide({ ...travaux, debut: '2027-13' })).toBe(false)
})

test('budget : les prêts remplacent les intérêts d’emprunts et le capital des frais', () => {
  // Magasin fictif : 1 200 d'intérêts et 30 000 de capital en frais ; avec les prêts, il garde 150 de comptes courants
  const h: Hypotheses = avecPrets(magasinFictif, [travaux, restant], 150)
  expect(h.interets).toBe(150)
  expect(h.remboursementCapital).toBe(0)
  // Les prêts mal saisis sont écartés ; sans prêt valide, rien ne change
  expect(avecPrets(magasinFictif, [{ ...travaux, montant: 0 }], 150)).toBe(magasinFictif)
  const f = financementDe(h, 0)
  // En cours : 150 + 1 088,77 d'intérêts, 6 111,23 de capital ; nouveau : le prêt travaux (1 725,00 et 5 656,15)
  proche(f.interetsEnCours, 1_238.77)
  proche(f.capitalEnCours, 6_111.23)
  proche(f.interetsNouveaux, 1_725.00)
  proche(f.capitalNouveau, 5_656.15)
  // Un prêt saisi est déjà dépensé (Joseph, 03/11/2026) : rien n'entre en trésorerie
  expect(f.nouveauxEmprunts).toBe(0)
  expect(somme(f.encaissementsMois)).toBe(0)
  // Le dernier mois des emprunts en cours ne sert plus
  proche(financementDe({ ...h, finEmpruntsEnCours: 4 }, 0).capitalEnCours, 6_111.23)
  // Janvier : 150 ÷ 12 + 30 000 × r = 12,50 + 100 = 112,50. Avril : le prêt « restant » doit 28 494,99 après 3 échéances
  // (29 500,00 ; 28 998,33 ; 28 494,99), soit 94,98 d'intérêts ; + 200 du prêt travaux + 12,50 = 307,48
  const b = calculerBudget(h, parametresParDefaut)
  proche(b.financement.interetsMois[0], 112.5)
  proche(b.financement.interetsMois[3], 307.48)
  proche(b.mois[3].resultatExploitation - b.mois[3].resultatAvantImpot, 307.48)
})

test('frais : les lignes d’intérêts et de capital tirées des prêts, l’année en cours face au budget', () => {
  // Prêt « restant » seul : 2027 = 1 088,77 + 6 111,23 ; 2028 : 30 000 − 6 111,23 = 23 888,77 restant dû
  const p = pretsDeuxAnnees([restant], 2027, 2028)!
  proche(p.avant.interets, 1_088.77)
  proche(p.avant.capital, 6_111.23)
  proche(restantDu(restant, 2028), 23_888.77)
  expect(pretsDeuxAnnees([], 2027, 2028)).toBeNull()
  // Lignes du budget : 150 de comptes courants gardés + les intérêts des prêts ; le capital vient des seuls prêts
  const lignes = avecPretsBudget(lignesFraisBudget({ frais: [], amortissements: 0, interets: 150, remboursementCapital: 0 }, undefined, 0.02), p)
  const l = (code: string) => lignes.find((x) => x.code === code)!
  proche(l('interets').avant, 1_238.77)
  proche(l('interets').apres, 150 + p.apres.interets)
  proche(l('remboursementCapital').apres, p.apres.capital)
  expect(l('interets').depuisPrets).toBe(true)
  expect(l('amortissements').depuisPrets).toBeUndefined()
})
