import { expect, test } from '@playwright/test'
import { MAGASINS, magasinFictif } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type QuadrimestreSimule, type StockSimule, type VenteSimulee } from './supabase-simule'

// Réel complété mois par mois (Joseph, 03/11/2026) : quadrimestre réparti (« Q1 »), mois estimés (« ≈ ») dans le suivi du
// budget, stock des mois non saisis retrouvé entre deux saisies. Données fictives : dépôt public.

const N = new Date().getFullYear()
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
// Cave 50 000 € de CA HT à 40 % de marge (30 000 € d'achats des ventes), Bar 10 000 € à 75 % (2 500 €), chaque mois
const ventes = (a: number, jusqua: number): VenteSimulee[] => Array.from({ length: jusqua }, (_, i) => [
  { store_name: MAGASINS[0], mois: mois(a, i + 1), univers: 'cave' as const, famille: 'Bière', ca_ht: 50_000, ca_ttc: 60_000, marge_ht: 20_000 },
  { store_name: MAGASINS[0], mois: mois(a, i + 1), univers: 'bar' as const, famille: 'Fût', ca_ht: 10_000, ca_ttc: 11_000, marge_ht: 7_500 },
]).flat()

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('suivi du budget : premier quadrimestre réparti, mai estimé, EBE à date', async ({ page, isMobile }, info) => {
  const quadrimestres: QuadrimestreSimule[] = [
    { store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 100_000, variation_stock: 0, charges_externes: 40_000, impots_taxes: 4_000, personnel: 60_000, tresorerie: 20_000 },
  ]
  await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, maj_le: null }], reel: ventes(N, 5), quadrimestres })
  await ouvrir(page, 'Suivi du budget')
  // EBE des quatre mois répartis : 240 000 − 100 000 − 40 000 − 4 000 − 60 000 = 36 000, plus mai estimé
  const chiffres = page.getByRole('region', { name: 'Santé du magasin à fin mai' })
  await expect(chiffres).toContainText('EBE à fin mai')
  await expect(chiffres).toContainText('4 mois des comptes, 1 estimé')
  await expect(chiffres).toContainText('≈')

  await page.getByRole('button', { name: 'Mois par mois', expanded: false }).click()
  const tableau = page.getByRole('table', { name: `Réel face au budget ${N} mois par mois` })
  await expect(tableau.getByRole('columnheader', { name: 'Janv. (réel + Q1)' })).toBeVisible()
  await expect(tableau.getByRole('columnheader', { name: 'Mai (réel + ≈)' })).toBeVisible()
  const ligne = (nom: string) => tableau.getByRole('row').filter({ has: page.getByRole('cell', { name: nom }) })
  const ebe = ligne('EBE').getByRole('cell')
  await expect(ebe.nth(1)).toHaveAttribute('data-source', 'reparti')
  await expect(ebe.nth(5)).toHaveAttribute('data-source', 'estime')
  await expect(ebe.nth(5)).toContainText('≈')
  await expect(ebe.nth(5)).toContainText('estimé')
  // Marge après démarque des 4 mois : 240 000 − 100 000 = 140 000, soit 35 000 par mois (CA identiques)
  const marge = ligne('Marge après démarque').getByRole('cell')
  for (const i of [1, 2, 3, 4]) await expect(marge.nth(i)).toContainText(/^35\s000/)
  // L'aide se lit à la demande
  await ligne('EBE').getByRole('button').first().click()
  await expect(page.getByRole('dialog')).toContainText('Réel complété')
  await page.keyboard.press('Escape')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-reel-complete.png`, fullPage: true })
})

test('stock : les mois non saisis entre décembre et mai sont estimés, rien après mai', async ({ page, isMobile }, info) => {
  const stocks: StockSimule[] = [
    { store_name: MAGASINS[0], annee: N - 1, mois: 12, cave: 90_000, bar: 2_500 },
    { store_name: MAGASINS[0], annee: N, mois: 5, cave: 60_000, bar: 2_500 },
  ]
  const magasin = { magasin: MAGASINS[0], statut: null, hypotheses: null, maj_le: null }
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel: [...ventes(N - 1, 12), ...ventes(N, 9)], stocks })
  await ouvrir(page, 'Stock')
  // Cave : 3 mois couverts fin décembre (90 000 ÷ 30 000), 2 fin mai ; janvier à avril 2,8 · 2,6 · 2,4 · 2,2 mois
  const table = page.getByRole('table', { name: `Stock ${N} par mois` })
  const ligne = (nom: string) => table.getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) }).getByRole('cell')
  const cave = ligne('Stock Cave')
  await expect(cave.nth(1)).toHaveText(/^≈ 84\s000 estimé$/)
  await expect(cave.nth(4)).toHaveText(/^≈ 66\s000 estimé$/)
  await expect(cave.nth(5)).toHaveText(/^60\s000$/)
  await expect(cave.nth(6)).toHaveText('')
  await expect(ligne('Stock total').nth(2)).toHaveText(/^≈ 80\s500 estimé$/)
  // Les estimations ne font ni écart ni état : seul le mois saisi est jugé
  await expect(ligne('État').nth(1)).toHaveText('')
  await expect(page.getByRole('region', { name: `Stock ${N} en chiffres` })).toContainText('Stock fin mai')
  await expect(page.getByRole('region', { name: `Stock de fin de mois ${N}` })).toContainText('Stock estimé')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-stock-estime.png`, fullPage: true })
})
