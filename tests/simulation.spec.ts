import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites } from './supabase-simule'

// Simulation « et si » : budget validé du magasin fictif (640 000 € de CA, 54 780 € d'EBE), rien n'est enregistré.
// Montants vérifiés à la main dans tests/moteur/simulation.spec.ts.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('et si : baisse du CA, hausse de loyer, embauche ; le budget ne bouge pas', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page)
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: 'Et si…' }).click()
  const tableau = page.getByRole('table', { name: 'Budget 2027 et simulation' })
  const ligne = (nom: string) => tableau.getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })
  await expect(ligne('EBE')).toContainText(/^EBE54\s78054\s780–$/)
  await expect(page.getByRole('button', { name: 'Revenir au budget' })).toBeDisabled()

  await page.getByLabel('Hausse du loyer par an').fill('12000')
  await expect(ligne('EBE')).toContainText(/^EBE54\s78042\s780[-−]12\s000\s€$/)
  await page.getByLabel('Variation du CA').fill('-10')
  // −33 978 d'EBE pour 10 % de CA en moins (marge, redevance, publicité, énergie)
  await expect(ligne('EBE')).toContainText(/^EBE54\s7808\s802[-−]45\s978\s€$/)
  await expect(ligne('CA HT')).toContainText(/576\s000/)
  await page.getByLabel('Variation du CA').fill('')
  await page.getByLabel('Hausse du loyer par an').fill('')
  // Employé à 2 000 € brut en juillet : 12 423,60 € chargés sur l'année
  await page.getByLabel('Salaire brut mensuel de l’embauche').fill('2000')
  await page.getByLabel('Arrivée').click()
  await page.getByRole('option', { name: 'Juillet' }).click()
  await expect(ligne('Personnel')).toContainText(/\+12\s424\s€$/)
  await expect(page.getByRole('region', { name: 'Effet de la simulation' })).toContainText(/42\sk€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulation.png`, fullPage: true })

  await page.getByRole('button', { name: 'Revenir au budget' }).click()
  await expect(ligne('EBE')).toContainText(/^EBE54\s78054\s780–$/)
  expect(ecritures).toEqual([])
})

test('et si sans budget : l’état vide le dit', async ({ page }) => {
  await seConnecter(page)
  await page.getByText(MAGASINS[2], { exact: true }).last().click()
  await page.getByRole('tab', { name: 'Et si…' }).click()
  await expect(page.getByText('Pas encore de budget 2027')).toBeVisible()
})
