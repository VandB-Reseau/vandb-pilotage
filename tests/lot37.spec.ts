import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Lot 37 (Joseph, 02/11/2026) : budget en 4 étapes ; toutes les hypothèses sur une page en cartes par thème (H2), chaque
// carte ouvre un tableau court (année en cours, siège, choix du magasin, année du budget) ; la trésorerie de l'année et
// le compte du quadrimestre se lisent dans le Suivi, la saisie reste dans Données. Données fictives.
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('hypothèses en cartes : chaque carte ouvre son tableau, les changements restent d’un thème à l’autre', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose] })
  await ouvrir(page, 'Cartes des hypothèses')
  await expect(page).toHaveURL(/\/budget$/)
  await expect(page.getByRole('tablist', { name: /^Étapes du budget/ }).getByRole('tab'))
    .toHaveText([/^0 · Point de départ/, /^1 · Hypothèses/, /^2 · Résultat et trésorerie/, /^3 · Échanges et validation/])
  const main = page.locator('main')
  for (const t of ['Ventes', 'Calendrier', 'Équipe', 'Frais', 'Trésorerie', 'Résultat']) {
    await expect(main.getByRole('region', { name: t, exact: true })).toBeVisible()
  }
  // Sans équipe : la carte le dit
  await expect(main.getByRole('region', { name: 'Équipe', exact: true })).toContainText('à renseigner')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-hypotheses-cartes.png`, fullPage: true })

  // Ventes : un tableau court par univers, de l'année en cours à l'année du budget
  await main.getByRole('region', { name: 'Ventes', exact: true }).getByRole('link').click()
  await expect(page).toHaveURL(/\/ventes$/)
  await expect(page.getByRole('heading', { level: 2, name: /^Ventes \d{4}/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^1 · Hypothèses/ })).toHaveAttribute('aria-selected', 'true')
  const cave = page.getByRole('table', { name: /^Hypothèses \d{4} : Cave/ })
  await expect(cave.getByRole('columnheader')).toHaveText(isMobile ? [/^Hypothèse/, /^Siège propose/, /^Choix du magasin/, /^\d{4}$/] : [/^Hypothèse/, /^\d{4}$/, /^Siège propose/, /^Choix du magasin/, /^\d{4}$/])
  await expect(cave.getByRole('row', { name: /^Tickets/ })).toContainText(/10\s000/)
  await page.getByLabel('Évolution du nombre de tickets : Cave').fill('5')
  const barre = page.getByRole('region', { name: 'Changements non enregistrés' })
  await expect(barre).toContainText('1 changement')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-hypotheses-ventes.png`, fullPage: true })

  // Retour aux cartes, puis Frais : pas de question, le changement reste
  await page.getByRole('link', { name: 'Toutes les hypothèses' }).click()
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toHaveCount(0)
  await main.getByRole('region', { name: 'Frais', exact: true }).getByRole('link').click()
  await expect(page).toHaveURL(/\/fraisBudget$/)
  await expect(page.getByLabel('Inflation des frais', { exact: true })).toBeVisible()
  await expect(barre).toContainText('1 changement')
  await expect(page.getByRole('region', { name: 'Indicateurs clés' })).toHaveCount(0)
})

test('Suivi : une page Trésorerie ; Données : la saisie du quadrimestre seule', async ({ page }) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Quadrimestres')
  await expect(page.getByRole('table', { name: /^Résultat réel \d{4} par quadrimestre/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Plan de trésorerie/ })).toHaveCount(0)
  await expect(page.getByRole('region', { name: /^Du budget au réel/ })).toHaveCount(0)
  await ouvrir(page, 'Trésorerie')
  await expect(page).toHaveURL(/\/tresorerie$/)
  await expect(page.getByRole('group', { name: 'Année de la trésorerie' })).toBeVisible()
  await ouvrir(page, 'Comptes du quadrimestre')
  await expect(page.getByRole('heading', { level: 2, name: 'Comptes du quadrimestre' })).toBeVisible()
})

test('menu : un seul magasin, le sien ; son nom ouvre la liste des magasins avec recherche', async ({ page, isMobile }) => {
  const autre: MagasinSimule = { ...propose, magasin: MAGASINS[1] }
  await seConnecter(page, { magasins: [propose, autre] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat')
  await expect(page).toHaveURL(/\/resultat$/)
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  const selecteur = menu.getByRole('button', { name: `Changer de magasin (magasin ouvert : ${MAGASINS[0]})` })
  // Sur téléphone, le menu s'ouvre par l'icône ; s'il se referme pendant le chargement de la fiche, on le rouvre
  for (let essai = 0; ; essai++) {
    if (isMobile && !(await menu.isVisible())) await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    try { await selecteur.click({ timeout: 4_000 }); break } catch (e) { if (essai >= 2) throw e }
  }
  await expect(menu.getByText(MAGASINS[1], { exact: true })).toHaveCount(0)
  const dialogue = page.getByRole('dialog', { name: 'Changer de magasin' })
  await dialogue.getByLabel('Nom du magasin').fill(MAGASINS[1].slice(0, 4))
  await expect(dialogue.getByRole('button', { name: MAGASINS[0], exact: true })).toHaveCount(0)
  await dialogue.getByRole('button', { name: MAGASINS[1] }).click()
  // Même étape, autre magasin
  await expect(page).toHaveURL(new RegExp(`/magasins/${encodeURIComponent(MAGASINS[1])}/resultat$`))
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})
