import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { allerVers, ongletEspace, ongletParametres, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Passage d'année (Joseph, 03/11/2026, options A et 2 de la maquette) : le menu a deux portes, « Suivi <année> » et
// « Budgets <année> » ; le Directeur ouvre la campagne, démarre le suivi et clôt l'année dans Paramètres.
// Le calendrier ne change plus rien : on se place exprès en mars 2027, la base dit encore « suivi 2026, campagne 2027 ».
// Données fictives.
const valide: MagasinSimule = { magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-12-10T09:00:00Z' }
const enDiscussion: MagasinSimule = { magasin: MAGASINS[1], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-12-10T09:00:00Z' }
const depart = [{ annee: 2026, etat: 'suivi' as const, suivi_le: '2026-01-02T08:00:00Z' }, { annee: 2027, etat: 'campagne' as const, campagne_le: '2026-11-03T08:00:00Z' }]
const menu = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Menu principal' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2027, 2, 15, 10))
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('menu : Suivi et Budgets avec l’année de la base, pas celle du calendrier ; la liste des budgets mène au budget', async ({ page, isMobile }) => {
  await seConnecter(page, { magasins: [valide, enDiscussion], annees: depart })
  await expect(page.getByRole('heading', { level: 1, name: 'Budgets 2027' })).toBeVisible()
  await expect(page.getByText('Campagne 2027 ouverte')).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  await expect(menu(page).getByRole('link', { name: 'Suivi 2026' })).toBeVisible()
  await expect(menu(page).getByRole('link', { name: 'Budgets 2027' })).toBeVisible()
  if (isMobile) await page.keyboard.press('Escape')
  // Pendant la campagne, un magasin de la liste s'ouvre sur son budget ; ses onglets disent Suivi 2026 et Budget 2027
  await page.locator('main').getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page).toHaveURL(/\/budget$/)
  await expect(ongletEspace(page, 'Suivi 2026')).toBeVisible()
  await expect(ongletEspace(page, 'Budget 2027')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' }).getByRole('link', { name: 'Budgets 2027' })).toBeVisible()
  // La porte « Suivi » ouvre le suivi du réseau de l'année suivie
  await allerVers(page, 'Suivi 2026')
  await expect(page.getByRole('heading', { level: 1, name: 'Suivi 2026' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Directeur : démarrer le suivi 2027, clore 2026, ouvrir la campagne 2028', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, { magasins: [valide, enDiscussion], annees: depart })
  await allerVers(page, 'Paramètres réseau')
  await ongletParametres(page, 'Années')
  const carte = page.getByRole('region', { name: 'Années du pilotage' })
  await expect(carte.getByText('Suivi 2026 · campagne 2027 ouverte')).toBeVisible()
  await expect(carte.getByRole('row')).toHaveText([/Année/, /^2027Campagne des budgets03\/11\/2026$/, /^2026Suivie02\/01\/2026$/])

  // 1. Démarrer le suivi 2027, après confirmation
  await carte.getByRole('button', { name: 'Démarrer le suivi 2027' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Démarrer le suivi 2027 ?' })
  await expect(dialogue).toContainText('Les frais 2026 des magasins sont gardés en archive')
  await dialogue.getByRole('button', { name: 'Démarrer le suivi 2027' }).click()
  await expect(carte.getByText('Suivi 2027 démarré.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/demarrer_suivi').map((e) => e.corps)).toEqual([{ p_annee: 2027 }])
  await expect(carte.getByText('Suivi 2027 · 2026 à clore')).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  await expect(menu(page).getByRole('link', { name: 'Suivi 2027' })).toBeVisible()
  await expect(menu(page).getByRole('link', { name: 'Budgets 2027' })).toBeVisible()
  if (isMobile) await page.keyboard.press('Escape')

  // 2. Clore 2026, puis 3. ouvrir la campagne 2028
  await carte.getByRole('button', { name: 'Clore 2026' }).click()
  await page.getByRole('dialog', { name: 'Clore 2026 ?' }).getByRole('button', { name: 'Clore 2026' }).click()
  await expect(carte.getByText('2026 est close.')).toBeVisible()
  await carte.getByRole('button', { name: 'Ouvrir la campagne 2028' }).click()
  await page.getByRole('dialog', { name: 'Ouvrir la campagne des budgets 2028 ?' }).getByRole('button', { name: 'Ouvrir la campagne 2028' }).click()
  await expect(carte.getByText('Campagne 2028 ouverte : l’onglet Budget 2028 est visible de tous.')).toBeVisible()
  await expect(carte.getByRole('row')).toHaveText([/Année/, /^2028Campagne des budgets/, /^2027Suivie/, /^2026Close/])
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  await expect(menu(page).getByRole('link', { name: 'Budgets 2028' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('suivi 2027 démarré : budget 2027 provisoire signalé, 2026 à clore consultable et saisissable, pas de proposition', async ({ page }) => {
  await seConnecter(page, {
    magasins: [enDiscussion], annees: [{ annee: 2026, etat: 'suivi' }, { annee: 2027, etat: 'suivi' }],
    reel: [{ store_name: MAGASINS[1], mois: '2027-01-01', univers: 'cave', famille: 'Bière', ca_ht: 50000, ca_ttc: 60000, marge_ht: 18000 },
      { store_name: MAGASINS[1], mois: '2027-02-01', univers: 'cave', famille: 'Bière', ca_ht: 48000, ca_ttc: 57600, marge_ht: 17000 }],
  })
  await page.locator('main').getByText(MAGASINS[1], { exact: true }).last().click()
  await expect(page).toHaveURL(/\/synthese$/)
  await expect(ongletEspace(page, 'Suivi 2027')).toHaveAttribute('aria-selected', 'true')
  await expect(ongletEspace(page, 'Budget 2027')).toBeVisible()
  await expect(page.getByText('Budget 2027 provisoire : pas encore validé, le suivi le compare à sa dernière version.').first()).toBeVisible()
  // L'année à clore reste consultable dans le Suivi
  await expect(page.locator('main').getByRole('region', { name: 'Suivi 2026' })).toContainText('À clore')
  // Hors campagne, l'atterrissage ne propose pas de budget
  await page.locator('main').getByRole('button', { name: /^Atterrissage 2027/ }).click()
  await expect(page.locator('main').getByRole('button', { name: /^(Proposer|Mettre à jour la proposition)/ })).toHaveCount(0)
  // Saisies : 2027 et 2026 encore à clore
  await ongletEspace(page, 'Saisies').click()
  await expect(page.getByRole('group', { name: 'Année du réel' }).getByRole('button')).toHaveText(['2027', '2026'])
})

test('Responsable Régional : voit les années, sans bouton pour les changer', async ({ page }) => {
  await seConnecter(page, { role: 'rr', magasins: [valide], annees: depart })
  await expect(page.getByRole('heading', { level: 1, name: 'Budgets 2027' })).toBeVisible()
  await allerVers(page, 'Paramètres réseau')
  await ongletParametres(page, 'Années')
  const carte = page.getByRole('region', { name: 'Années du pilotage' })
  await expect(carte.getByRole('row')).toHaveCount(3)
  await expect(carte.getByRole('button')).toHaveCount(0)
})
