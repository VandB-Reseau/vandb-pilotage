import { expect, test } from '@playwright/test'
import { nombre } from '../../src/import/caisse'
import { fraisDepuisFEC, type EcritureFEC } from '../../src/moteur/fec'
import { calculerBudget } from '../../src/moteur/budget'
import { compteResultat } from '../../src/moteur/compteResultat'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { saisieAvecFEC, saisieDepuisLignes } from '../../src/moteur/saisieFrais'
import { tresorerieBudget, tresorerieParDefaut } from '../../src/moteur/tresorerie'
import type { Budget, Hypotheses } from '../../src/moteur/types'
import { magasinFictif } from '../donnees-fictives'

// Lot 33 : besoin en fonds de roulement, frais repris du FEC, saisonnalité par univers, compte de résultat mensuel. Chiffres vérifiés à la main.
const proche = (v: number, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const p = { tauxRedevance: 0.02, tauxPublicite: 0.01 }

// Mois tous identiques (comme tests/moteur/tresorerie.spec.ts) : 10 000 € de CA HT, 6 000 € d'achats, 2 000 € de
// personnel ; loyer 12 000 € par an avec TVA, assurance 1 200 € sans TVA
const budget = { ca: 120_000, mois: Array.from({ length: 12 }, () => ({ ca: 10_000, achats: 6_000, personnel: 2_000 })), impot: 4_000 } as unknown as Budget
const h = {
  frais: [{ code: 'loyer', libelle: 'Loyer', rubrique: 'immobilier', annuel: 12_000 }, { code: 'assurance', libelle: 'Assurance', rubrique: 'banque_assurances', annuel: 1_200 }],
  interets: 1_200, remboursementCapital: 2_400,
} as unknown as Hypotheses

test('BFR au 31 décembre : stock en jours d’achats moins les dettes des derniers mois', () => {
  const { bfr } = tresorerieBudget(budget, h, p, tresorerieParDefaut)
  proche(bfr.stock, 72_000 * 45 / 365)          // 8 876,71 € : 45 jours d'achats
  proche(bfr.consignes, 0)                      // pas de familles : pas de consignes
  proche(bfr.fournisseurs, 7_200)               // achats de décembre TTC, payés fin janvier
  proche(bfr.tva, 440)                          // TVA de décembre : 1 900 − 1 200 − 260
  proche(bfr.cotisations, 800)                  // 40 % du personnel de décembre
  proche(bfr.redevance, 360)                    // redevance et publicité de décembre TTC
  proche(bfr.total, 72_000 * 45 / 365 - 7_200 - 440 - 800 - 360) // 76,71 €
  proche(bfr.joursCA, bfr.total / (120_000 / 365))
  // TVA trimestrielle : le dernier trimestre est dû ; sans stock, le BFR devient une ressource
  const q = tresorerieBudget(budget, h, p, { ...tresorerieParDefaut, tvaTrimestrielle: true, stockJours: 0 }).bfr
  proche(q.tva, 1_320)
  proche(q.total, -7_200 - 1_320 - 800 - 360)
  // Fournisseurs à 60 jours : deux mois d'achats dus
  proche(tresorerieBudget(budget, h, p, { ...tresorerieParDefaut, delaiFournisseurs: 2 }).bfr.fournisseurs, 14_400)
})

// FEC de janvier à juin : chaque compte de charges ramené à l'année (× 12 ÷ 6)
const e = (compte: string, libelle: string, date: string, solde: number): EcritureFEC => ({ compte, libelle, date, solde })
const fec: EcritureFEC[] = [
  e('512000', 'Banque', '2026-01-02', 10_000),
  e('613200', 'Loyer', '2026-01-05', 3_000), e('613200', 'Loyer', '2026-04-05', 3_000),
  e('606100', 'Électricité', '2026-02-10', 1_500), e('606140', 'Carburant', '2026-02-10', 300),
  e('651600', 'Droits SACEM', '2026-03-01', 100), e('651100', 'Redevance', '2026-03-31', 2_000),
  e('681100', 'Dotations', '2026-06-30', 5_000), e('661100', 'Intérêts', '2026-06-30', 3_000), e('661600', 'Agios', '2026-06-30', 50),
  e('641000', 'Salaires', '2026-06-30', 20_000), e('607100', 'Achats', '2026-06-30', 40_000), e('633300', 'Formation continue', '2026-06-30', 150),
  e('604000', 'Prestations', '2026-05-15', 400), e('622700', 'Actes', '2026-05-15', 250), e('622700', 'Avoir actes', '2026-05-20', -250),
]

test('frais repris du FEC : lignes de la grille, finances à part, ramenés à l’année', () => {
  const f = fraisDepuisFEC(fec)
  expect(f.mois).toBe(6)
  expect(f.lignes.map((l) => [l.code, l.annuel])).toEqual([
    ['energie', 3_000], ['carburant', 600], ['loyer', 12_000], ['droits_auteur', 200],
  ])                                              // actes : 250 − 250 = 0, écarté
  expect(f.finances).toEqual({ amortissements: 10_000, interets: 6_000, agios: 100 })
  expect(f.aRanger).toEqual([{ compte: '604000', libelle: 'Prestations', annuel: 800 }])
  expect(f.exclus.map((x) => [x.compte, x.raison])).toEqual([
    ['607100', 'Achats de marchandises'], ['633300', 'Comptée dans la masse salariale'], ['641000', 'Personnel'], ['651100', 'Royalties calculées sur le CA'],
  ])
})

test('frais repris du FEC : seules les lignes cochées changent, en euros par an', () => {
  const s = saisieDepuisLignes([
    { code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: null, tauxCA: 0.05 },
    { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies', annuel: 2_000, tauxCA: null },
  ])
  const r = saisieAvecFEC(s, fraisDepuisFEC(fec), ['loyer', 'carburant', 'amortissements'])
  const ligne = (c: string) => r.lignes.find((l) => l.code === c)
  expect(ligne('loyer')?.mode).toBe('annuel')
  expect(nombre(ligne('loyer')!.valeur)).toBe(12_000)
  expect(nombre(ligne('energie')!.valeur)).toBe(2_000)   // pas cochée : inchangée
  expect(nombre(ligne('carburant')!.valeur)).toBe(600)   // ajoutée
  expect(nombre(r.finances.amortissements)).toBe(10_000)
  expect(r.finances.interets).toBe('')                    // pas cochés
})

test('saisonnalité par univers : l’Extérieur garde ses mois d’été, total de l’univers inchangé', () => {
  const ete = [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0]          // Extérieur seulement de juin à septembre
  const avec = calculerBudget({ ...magasinFictif, caMensuelUnivers: { exterieur: ete } }, parametresParDefaut)
  const sans = calculerBudget(magasinFictif, parametresParDefaut)
  const ext = (b: Budget) => b.mois.map((m) => m.univers!.exterieur.ca)
  proche(ext(avec)[0], 0)
  proche(ext(avec)[6], sans.familles[2].objectif / 4)           // un quart de l'année de l'Extérieur en juillet
  proche(ext(avec).reduce((a, v) => a + v, 0), ext(sans).reduce((a, v) => a + v, 0))
  proche(avec.ca, sans.ca)
  proche(avec.mois[0].univers!.cave.ca, sans.mois[0].univers!.cave.ca) // Cave sans référence propre : saisonnalité du total
  // Saisonnalité réglée par le magasin : elle s'applique à tous les univers
  const poidsMois = Array(12).fill(1 / 12)
  proche(calculerBudget({ ...magasinFictif, poidsMois, caMensuelUnivers: { exterieur: ete } }, parametresParDefaut).mois[0].univers!.exterieur.ca, sans.familles[2].objectif / 12)
})

test('compte de résultat : impôt et résultat net du mois, capital remboursé, charges des événements', () => {
  const h = { ...magasinFictif, tempsForts: [{ nom: 'Fête', type: 'exterieur' as const, mois: 7, univers: 'exterieur' as const, caAnPasse: 0, ca: 0, autresCharges: 1_200, moisAchats: 7 }] }
  const b = calculerBudget(h, parametresParDefaut)
  const l = compteResultat(b, h, parametresParDefaut)
  const ligne = (c: string) => l.find((x) => x.cle === c)!
  expect(ligne('externes/evenements').mois[6]).toBe(-1_200)
  proche(ligne('externes/evenements').total, -1_200)
  proche(ligne('capital').mois[0]!, -2_500)                     // 30 000 ÷ 12
  proche(ligne('reintegres').mois[0]!, 2_000)                   // 24 000 ÷ 12
  proche(ligne('impot').total, -b.impot)
  proche(ligne('net').total, b.resultatNet)
  proche(ligne('tresorerie').mois[0]!, ligne('net').mois[0]! + 2_000 - 2_500)
  proche(ligne('tresorerie').total, b.tresorerieDegagee)
})
