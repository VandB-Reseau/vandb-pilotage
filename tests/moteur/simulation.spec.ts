import { expect, test } from '@playwright/test'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { sansLevier, simuler } from '../../src/moteur/simulation'
import { magasinFictif } from '../donnees-fictives'

// Simulation « et si » sur le magasin fictif : budget de 640 000 € de CA, 367 300 € de marge, 54 780 € d'EBE,
// redevance et publicité 3 % du CA, énergie 1,3 % du CA, personnel saisi en bloc. Chaque écart se vérifie à la main.
const p = parametresParDefaut
const proche = (v: number, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

test('sans levier, la simulation redonne le budget', () => {
  const s = simuler(magasinFictif, p, sansLevier)
  proche(s.budget.ca, 640_000)
  proche(s.budget.ebe, 54_780)
  proche(s.simule.ebe, s.budget.ebe)
  proche(s.tresorerieSimulee.fin, s.tresorerie.fin)
})

test('CA en baisse de 10 % : la marge suit, redevance, publicité et énergie aussi', () => {
  const s = simuler(magasinFictif, p, { ...sansLevier, ca: -0.1 })
  proche(s.simule.ca, 576_000)
  proche(s.simule.marge, 330_570)
  // −36 730 de marge, +64 000 × (3 % + 1,3 %) = +2 752 de charges en moins
  proche(s.simule.ebe, 20_802)
})

test('un point de marge en moins, une hausse de loyer', () => {
  proche(simuler(magasinFictif, p, { ...sansLevier, marge: -0.01 }).simule.ebe, 48_380)     // 640 000 × 1 %
  const loyer = simuler(magasinFictif, p, { ...sansLevier, loyer: 12_000 })
  proche(loyer.simule.ebe, 42_780)
  // Trésorerie : 14 400 TTC payés, 2 400 de TVA récupérée, l'impôt baisse de 15 % des 12 000 (taux réduit)
  proche(loyer.tresorerieSimulee.fin - loyer.tresorerie.fin, -12_000 + 1_800)
})

test('embauche d’un employé à 2 000 € brut en juillet : charges moins la réduction générale', () => {
  const s = simuler(magasinFictif, p, { ...sansLevier, embauche: { brutMensuel: 2_000, heuresHebdo: 35, categorie: 'employe', mois: 7 } })
  // 6 mois, 12 000 € brut ; SMIC de référence 10 938,20 € ; coefficient 0,3147 → 2 000 × (1 + 35 % − 31,47 %) = 2 070,60 € par mois
  proche(s.simule.personnel - s.budget.personnel, 12_423.6)
  proche(s.simule.mois[5].personnel, s.budget.mois[5].personnel)
  proche(s.simule.mois[6].personnel - s.budget.mois[6].personnel, 2_070.6)
  proche(s.simule.ebe, 54_780 - 12_423.6)
})
