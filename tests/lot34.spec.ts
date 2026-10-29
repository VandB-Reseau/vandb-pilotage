import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type MagasinSimule } from './supabase-simule'

// Lot 34 (29/10/2026) : équipe et frais saisis dans l'année en cours et repris par le budget, « + » par thème, masse salariale / CA.
// Données fictives uniquement : dépôt public.
const magasins: MagasinSimule[] = [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }]
const loyer: FraisSimule = { store_name: MAGASINS[0], code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, taux_ca: null }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le budget reprend l’équipe et les frais de l’année en cours ; « + » dans chaque thème', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins, frais: [loyer] })
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await expect(page.getByRole('button', { name: 'Aide : Masse salariale / CA' })).toBeVisible()
  await ouvrir(page, 'Résultat et trésorerie')
  const resume = page.getByRole('region', { name: /^Équipe et frais \d{4}$/ })
  await expect(resume).toContainText('hausse des salaires')
  await resume.getByRole('button', { name: /^Modifier dans \d{4} en cours$/ }).click()
  await expect(page.getByRole('tab', { name: /^Équipe et frais/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Ajouter une ligne : Énergies' }).click()
  await page.getByRole('menuitem', { name: 'Carburant' }).click()
  await expect(page.getByRole('region', { name: 'Énergies' }).getByLabel('Carburant', { exact: true })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-frais-themes.png`, fullPage: true })
})
