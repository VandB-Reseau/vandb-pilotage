import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type VersionNommeeSimulee } from './supabase-simule'

// Versions nommées du budget (lot 26) : enregistrer, comparer côte à côte, reprendre, retirer. Remplacent l'onglet « Et si ».
// Données fictives : dépôt public. Écarts vérifiés à la main dans tests/moteur/explication.spec.ts.

const N = new Date().getFullYear()
const B = N + (new Date().getMonth() >= 8 ? 1 : 0) // année du budget, comme l'app
const magasins: MagasinSimule[] = [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }]
// Version ambitieuse : Extérieur + 10 % (100 000 € atterris)
const ambitieuse: VersionNommeeSimulee = {
  id: 7, store_name: MAGASINS[0], annee: B, nom: 'Ambitieuse', ajustements: { evolutionUnivers: { exterieur: 0.1 } }, base: magasinFictif,
  auteur: 'quelqu-un-d-autre', auteur_role: 'franchise', auteur_nom: null, cree_le: '2026-10-20T09:30:00Z',
}

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur enregistre une version, la compare au budget en cours, la reprend puis la retire', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins, versionsNommees: [ambitieuse] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('tab', { name: /^Et si/ })).toHaveCount(0)
  await ouvrir(page, 'Échanges et versions')

  const versions = page.getByRole('region', { name: 'Versions du budget' })
  const tableau = versions.getByRole('table', { name: `Versions du budget ${B}` })
  await expect(tableau.getByRole('columnheader', { name: /Ambitieuse/ })).toBeVisible()
  // + 10 000 de CA, + 4 000 de marge (40 %), − 430 de charges qui suivent le CA (redevance, publicité, énergie : 4,3 %)
  await expect(tableau.getByRole('row', { name: /^Chiffre d’affaires HT/ })).toContainText(/\+10\s000\s€/)
  await expect(tableau.getByRole('row', { name: /^Marge/ })).toContainText(/\+4\s000\s€/)
  await expect(tableau.getByRole('row', { name: /^EBE/ })).toContainText(/\+3\s570\s€/)

  await versions.getByRole('button', { name: 'Enregistrer cette version' }).click()
  await versions.getByLabel('Nom de la version').fill('  Prudente ')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await versions.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(versions.getByText('Version « Prudente » enregistrée.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'versions_nommees' && e.methode === 'POST')?.corps as VersionNommeeSimulee
  expect(envoi).toMatchObject({ store_name: MAGASINS[0], annee: B, nom: 'Prudente', ajustements: {} })
  expect((envoi.base as { familles: unknown[] }).familles).toHaveLength(magasinFictif.familles.length)
  await expect(tableau.getByRole('columnheader', { name: /Prudente/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-versions.png`, fullPage: true })

  await versions.getByRole('button', { name: 'Reprendre les hypothèses de la version Ambitieuse' }).click()
  await expect(page.getByText('Hypothèses de la version reprises. Enregistre les ajustements pour les garder.')).toBeVisible()

  await versions.getByRole('button', { name: 'Retirer la version Ambitieuse' }).click()
  await expect(versions.getByText('Version « Ambitieuse » retirée.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'versions_nommees' && e.methode === 'DELETE')?.filtre).toContain('id=eq.7')
  await expect(tableau.getByRole('columnheader', { name: /Ambitieuse/ })).toHaveCount(0)
})

test('le Coach lit les versions sans pouvoir en enregistrer ni en retirer', async ({ page }) => {
  await seConnecter(page, { role: 'coach', magasins, versionsNommees: [ambitieuse] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Échanges et versions')
  const versions = page.getByRole('region', { name: 'Versions du budget' })
  await expect(versions.getByRole('columnheader', { name: /Ambitieuse/ })).toBeVisible()
  await expect(versions.getByRole('button', { name: 'Enregistrer cette version' })).toHaveCount(0)
  await expect(versions.getByRole('button', { name: /Retirer la version/ })).toHaveCount(0)
  await expect(versions.getByRole('button', { name: /Reprendre/ })).toHaveCount(0)
})
