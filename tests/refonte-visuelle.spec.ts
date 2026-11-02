import { expect, test, type Page } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, plusLoin, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type QuadrimestreSimule, type TicketsSimules, type VenteSimulee } from './supabase-simule'

// Refonte visuelle (2/11/2026, Joseph « ok pour tout », sans solde bancaire mensuel) : jauges, lignes de tendance, barres
// du réel dans le budget, pont d'écart de l'EBE, plan de trésorerie réel au quadrimestre. Données fictives uniquement.
const N = new Date().getFullYear()
const magasin: MagasinSimule = { magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
// Janvier à avril : 50 000 € de CA HT par mois, marge de caisse 40 % ; l'an dernier 45 000 € par mois
const reel: VenteSimulee[] = [N, N - 1].flatMap((a) => [1, 2, 3, 4].map((m) =>
  ({ store_name: MAGASINS[0], mois: `${a}-0${m}-01`, univers: 'cave', famille: 'Bière', ca_ht: a === N ? 50_000 : 45_000, ca_ttc: a === N ? 60_000 : 54_000, marge_ht: a === N ? 20_000 : 18_000 })))
const tickets: TicketsSimules[] = [N, N - 1].flatMap((a) => [1, 2, 3, 4].map((m) => ({ store_name: MAGASINS[0], mois: `${a}-0${m}-01`, univers: 'cave', tickets: a === N ? 2_100 : 2_000 })))
// Premier quadrimestre complet : marge réelle 200 000 − 125 000 = 75 000 €, EBE 75 000 − 30 000 − 3 000 − 35 000 = 7 000 €
const quadrimestres: QuadrimestreSimule[] = [
  { store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 130_000, variation_stock: 5_000, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 25_000 },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

const sansDebordement = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('synthèse : jauges, lignes de tendance, barres du réel dans le contour du budget', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel, tickets })
  const sante = page.getByRole('region', { name: 'Santé du magasin à fin avril' })
  await expect(sante.getByRole('meter', { name: 'CA réel face au budget à fin avril' })).toBeVisible()
  const tendance = page.getByRole('region', { name: `Tendance ${N} à fin avril` })
  await expect(tendance.getByRole('listitem', { name: 'Chiffre d’affaires HT' })).toContainText(/200\sk€/)
  await expect(tendance.getByRole('listitem', { name: 'Chiffre d’affaires HT' })).toContainText('face au budget, 4 mois')
  // Tickets : 8 400 face à 8 000 l'an dernier, +5 %
  await expect(tendance.getByRole('listitem', { name: 'Tickets' })).toContainText(/8\s400/)
  await plusLoin(page)
  await page.getByRole('button', { name: 'Mois par mois' }).click()
  await expect(page.getByRole('img', { name: /dans le contour du budget/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cumulé' }).click()
  await expect(page.getByText(new RegExp(`^Atterrissage ${N} : .* face au budget de 640\\sk€`))).toBeVisible()
  expect(await sansDebordement(page)).toBeLessThanOrEqual(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-synthese-tendance.png`, fullPage: true })
})

test('quadrimestres : pastilles face au budget, pont d’écart de l’EBE, plan de trésorerie', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel, tickets, quadrimestres })
  await ouvrir(page, 'Quadrimestres')
  const pont = page.getByRole('region', { name: 'Du budget au réel : EBE à fin avril' })
  await expect(pont).toContainText(/le poste qui pèse le plus/)
  // La somme des marches est l'écart d'EBE : on part de l'EBE budgété, on arrive aux 7 000 € réels
  await expect(pont.getByRole('img', { name: /budgétés à 7\sk€ réels : chiffre d’affaires/ })).toBeVisible()
  const plan = page.getByRole('region', { name: `Plan de trésorerie ${N}` })
  await expect(plan).toContainText(`Prévu : budget ${N}`)
  await expect(plan).toContainText(/Trésorerie fin avril25\sk€/)
  // Encaissé en caisse : 60 000 € TTC par mois, réel en gras, prévu dessous
  await expect(plan.getByRole('table', { name: `Plan de trésorerie ${N} mois par mois` }).getByRole('row', { name: /^Encaissé en caisse/ }).getByRole('cell').nth(1)).toContainText(/^60\s000\s*prévu/)
  const parQ = plan.getByRole('table', { name: `Trésorerie ${N} par quadrimestre` })
  await expect(parQ.getByRole('row', { name: /^Trésorerie en fin de période/ }).getByRole('cell').nth(1)).toContainText(/^25\s000/)
  await expect(page.getByRole('table', { name: `Cumul ${N} face au budget et à ${N - 1}` })).toBeVisible()
  expect(await sansDebordement(page)).toBeLessThanOrEqual(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-pont-et-plan.png`, fullPage: true })
})
