import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { allerVers, ouvrir, partieAffichee, partiesAffichees, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Lot 36 (Joseph, 02/11/2026) : trois espaces séparés, Données (ce qui entre), Budget (de l'atterrissage de l'année en
// cours aux hypothèses de l'an prochain), Suivi (réel face au budget). Chaque partie a son adresse. Données fictives.
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('trois espaces : le magasin ouvert reste le même, chaque espace a ses pages', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page).toHaveURL(/\/synthese$/)

  await ouvrir(page, 'Point de départ')
  await expect(page).toHaveURL(new RegExp(`/magasins/${encodeURIComponent(MAGASINS[0])}/depart$`))
  await expect(partiesAffichees(page)).toHaveCount(4)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-espace-budget.png`, fullPage: true })

  await ouvrir(page, 'Réel')
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[0] })).toBeVisible()
  await expect(partiesAffichees(page)).toHaveText(isMobile ? [/^Réel du mois/, /^Comptes du quadrimestre/, /^Frais/] : [])
  await page.screenshot({ path: `captures/${info.project.name}-espace-donnees.png`, fullPage: true })

  if (!isMobile) {
    // Le menu de gauche montre les pages de l'espace, pour le magasin ouvert, et les pages du réseau de cet espace
    const menu = page.getByRole('navigation', { name: 'Menu principal' })
    await expect(menu.getByRole('link')).toHaveText([/^Imports de caisse/, /^Réel du mois/, /^Comptes du quadrimestre/, /^Frais \d{4}/, /^Paramètres réseau/])
    await page.getByRole('group', { name: 'Espaces' }).getByRole('link', { name: 'Suivi' }).click()
    await expect(menu.getByRole('link')).toHaveText([/^Réel du réseau/, /^Où en est le magasin/, /^Trésorerie/, /^Paramètres réseau/])
    await expect(page).toHaveURL(/\/synthese$/)
  }
})

test('une adresse rouverte affiche la même partie ; un ancien lien est redirigé', async ({ page }) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Équipe')
  await expect(page).toHaveURL(/\/equipe$/)
  await page.reload()
  await partieAffichee(page, /^1 · Hypothèses/)
  await expect(page.getByRole('heading', { level: 2, name: /^Équipe \d{4}/ })).toBeVisible()
  // Ancienne adresse sans partie : la synthèse
  await page.goto(`/#/magasins/${encodeURIComponent(MAGASINS[0])}`)
  await expect(page).toHaveURL(/\/synthese$/)
})

test('d’une étape du budget à l’autre, les ajustements en cours restent sans question ; quitter le budget demande confirmation', async ({ page, isMobile }) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose] })
  await ouvrir(page, 'Hypothèses')
  await page.getByLabel('Évolution du nombre de tickets : Cave').fill('5')
  const barre = page.getByRole('region', { name: 'Changements non enregistrés' })
  await expect(barre).toContainText('1 changement')
  await ouvrir(page, 'Résultat et trésorerie')
  const garde = page.getByRole('dialog', { name: 'Modifications non enregistrées' })
  await expect(garde).toHaveCount(0)
  await expect(barre).toContainText('1 changement')
  // Vers l'espace Suivi : la garde demande confirmation, puis les ajustements non enregistrés sont abandonnés
  await (isMobile ? page.getByRole('navigation', { name: 'Espaces du pilotage' }) : page.getByRole('group', { name: 'Espaces' })).getByRole('link', { name: 'Suivi' }).click()
  await expect(garde).toBeVisible()
  await garde.getByRole('button', { name: 'Quitter sans enregistrer' }).click()
  await expect(page).toHaveURL(/\/synthese$/)
  await ouvrir(page, 'Hypothèses')
  await expect(page.getByLabel('Évolution du nombre de tickets : Cave')).toHaveValue('')
})

test('téléphone : les trois espaces en barre basse, le menu derrière l’icône', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'téléphone seulement')
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('navigation', { name: 'Espaces du pilotage' }).getByRole('link')).toHaveText(['Données', 'Budget', 'Suivi'])
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  await expect(menu.getByRole('link', { name: 'Où en est le magasin' })).toBeVisible()
  expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-menu.png` })
  await menu.getByRole('link', { name: 'Trésorerie' }).click()
  await expect(menu).toBeHidden()
  await expect(page).toHaveURL(/\/tresorerie$/)
  await allerVers(page, 'Réel du réseau')
  await expect(page.getByRole('heading', { level: 1, name: 'Réseau' })).toBeVisible()
})
