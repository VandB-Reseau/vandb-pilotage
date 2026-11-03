import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { allerVers, ongletEspace, ouvrir, ouvrirSection, partiesAffichees, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Option A de la maquette de navigation (Joseph, 03/11/2026) : la fiche du magasin a trois onglets, « Suivi <année> »
// (une seule page, atterrissage, trésorerie et stock en sections repliées), « Budget <année suivante> » (les étapes en
// frise) et « Saisies » ; un fil d'Ariane remplace le retour et « Changer de magasin » ; le menu liste ce qui porte sur
// tout le réseau, les réglages sous « Paramètres ». Données fictives.
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
const annee = new Date().getFullYear()

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('fiche : trois onglets Suivi, Budget, Saisies ; fil d’Ariane à la place du retour et du changement de magasin', async ({ page, isMobile }, info) => {
  const autre: MagasinSimule = { ...propose, magasin: MAGASINS[1] }
  await seConnecter(page, { magasins: [propose, autre] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page).toHaveURL(/\/synthese$/)
  const pages = page.getByRole('navigation', { name: 'Pages du magasin' })
  await expect(pages.getByRole('tablist', { name: 'Espaces du magasin' }).getByRole('tab')).toHaveText([new RegExp(`^Suivi ${annee}`), new RegExp(`^Budget ${annee + 1}`), /^Saisies/])
  // Le Suivi tient sur une page : pas de seconde rangée d'onglets, les sections sont repliées
  await expect(pages.getByRole('tablist')).toHaveCount(1)
  for (const nom of [`Atterrissage ${annee}`, 'Trésorerie', 'Stock']) {
    await expect(page.locator('main').getByRole('region', { name: nom, exact: true }).getByRole('button', { name: nom, exact: true })).toHaveAttribute('aria-expanded', 'false')
  }
  // Fil d'Ariane ; plus de « Changer de magasin » ni de bouton retour
  const ariane = page.getByRole('navigation', { name: 'Fil d’Ariane' })
  await expect(ariane.getByRole('link', { name: /^Budgets \d{4}$/ })).toBeVisible()
  await expect(ariane.getByText(MAGASINS[0], { exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: /Changer de magasin/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-navigation-suivi.png`, fullPage: true })

  // Budget : les étapes en frise, chacune avec son état
  await ouvrir(page, 'Construire')
  const frise = pages.getByRole('tablist', { name: `Étapes du budget ${annee + 1}` })
  await expect(frise.getByRole('tab')).toHaveText([/^1 · Construire/, /^2 · Visualiser/, /^3 · Envoyer et valider/])
  await expect(frise.getByRole('tab', { name: /^1 · Construire/ })).toHaveAttribute('aria-current', 'step')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-navigation-budget.png` })

  // Saisies : le réel du mois, le stock, les comptes du quadrimestre, les frais
  await ongletEspace(page, 'Saisies').click()
  await expect(page).toHaveURL(/\/reel$/)
  await expect(partiesAffichees(page)).toHaveText([/^Réel du mois/, /^Stock de fin de mois/, /^Comptes du quadrimestre/, /^Frais \d{4}/])
  await partiesAffichees(page).filter({ hasText: /^Stock de fin de mois/ }).click()
  await expect(page).toHaveURL(/\/saisieStock$/)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-navigation-saisies.png` })

  // Magasin suivant dans la même partie, puis retour à la liste par le fil d'Ariane
  await page.getByRole('link', { name: `Magasin suivant : ${MAGASINS[1]}` }).click()
  await expect(page).toHaveURL(new RegExp(`/magasins/${encodeURIComponent(MAGASINS[1])}/saisieStock$`))
  await ariane.getByRole('link', { name: /^Budgets \d{4}$/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Budgets \d{4}$/ })).toBeVisible()
})

test('les anciennes adresses de l’atterrissage, de la trésorerie et du stock ouvrent leur section du Suivi', async ({ page }) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.goto(`/#/magasins/${encodeURIComponent(MAGASINS[0])}/tresorerie`)
  await expect(page).toHaveURL(/\/synthese$/)
  const tresorerie = page.locator('main').getByRole('region', { name: 'Trésorerie', exact: true })
  await expect(tresorerie.getByRole('button', { name: 'Trésorerie', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await ouvrirSection(page, new RegExp(`^Atterrissage ${annee}$`))
  await expect(page.locator('main').getByRole('region', { name: `Atterrissage ${annee}`, exact: true }).getByRole('button', { name: `Atterrissage ${annee}`, exact: true })).toHaveAttribute('aria-expanded', 'true')
})

test('menu : ce qui porte sur le réseau en haut, les réglages du Directeur sous « Paramètres »', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: [propose] })
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  await expect(menu.getByRole('link')).toHaveText([/^Suivi \d{4}/, /^Budgets \d{4}/, /^Hypothèses du réseau/, /^Imports de caisse/, /^Paramètres réseau/])
  await expect(menu.getByText('Paramètres', { exact: true })).toBeVisible()
  for (const ancien of ['Budgets', 'Suivi', 'Données', 'Réglages', 'Magasins', 'Réel du réseau']) await expect(menu.getByText(ancien, { exact: true })).toHaveCount(0)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-navigation-menu.png` })
  if (isMobile) await page.keyboard.press('Escape')
  await allerVers(page, 'Suivi ')
  await expect(page.getByRole('heading', { level: 1, name: /^Suivi \d{4}$/ })).toBeVisible()
})

test('franchisé : « Mes magasins » seul dans le menu', async ({ page, isMobile }) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose, { ...propose, magasin: MAGASINS[1] }] })
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link')).toHaveText([/^Mes magasins/])
})
