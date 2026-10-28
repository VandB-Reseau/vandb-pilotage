import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits, zonesTropPetites } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})

test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('un mauvais mot de passe affiche un message clair', async ({ page }) => {
  await simulerSupabase(page)
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill('faux')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible()
})

test('le Directeur voit tous les magasins, l’avancement des budgets et les chiffres calculés', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
  const filtres = page.getByRole('group', { name: 'Filtres' })
  await expect(filtres.getByRole('button', { name: 'Validés · 1' })).toBeVisible()
  await expect(filtres.getByRole('button', { name: 'En discussion · 1' })).toBeVisible()
  await expect(filtres.getByRole('button', { name: 'Sans budget · 1' })).toBeVisible()
  for (const m of MAGASINS) await expect(page.getByText(m, { exact: true })).toBeVisible()
  // Magasin fictif : 640 000 € de CA et 54 780 € d'EBE (calcul vérifié à la main dans les tests du moteur)
  await expect(page.getByText(/640\sk€/).first()).toBeVisible()
  await expect(page.getByText(/55\sk€/).first()).toBeVisible()
  await expect(page.getByText('Validé', { exact: true })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-magasins.png`, fullPage: true })
})

test('la fiche d’un magasin montre le compte de résultat et le budget mois par mois', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[0] })).toBeVisible()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const resultat = page.getByRole('table', { name: 'Budget 2027 mois par mois' })
  await expect(resultat.getByRole('row', { name: /Excédent brut d’exploitation/ })).toContainText(/54\s780\s€/)
  await expect(resultat.getByRole('row', { name: /Impôt sur les sociétés/ })).toContainText(/4\s437\s€/)
  await expect(resultat.getByRole('row', { name: /^Résultat net/ })).toContainText(/25\s143\s€/)
  // 12 mois, total et part du CA ; les charges externes se détaillent ligne par ligne
  await expect(resultat.getByRole('columnheader')).toHaveCount(15)
  await expect(resultat.getByRole('row', { name: /^Locations immobilières/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Charges externes : détailler' }).click()
  await expect(resultat.getByRole('row', { name: /^Locations immobilières/ })).toContainText(/5\s000/)
  await expect(resultat.getByRole('row', { name: /^Royalties/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche.png`, fullPage: true })
  await page.getByRole('link', { name: 'Magasins' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
})

test('un magasin sans budget l’explique', async ({ page }) => {
  await seConnecter(page)
  await page.getByText(MAGASINS[2], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await expect(page.getByText('Pas encore de budget', { exact: false })).toBeVisible()
})

test('les paramètres réseau : redevance 2 % et publicité 1 % pour le Directeur seulement', async ({ page }) => {
  await seConnecter(page)
  await page.getByRole('link', { name: /Paramètres/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Paramètres réseau' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Redevance franchise/ })).toContainText('2,0 %')
  await expect(page.getByRole('row', { name: /Publicité franchise/ })).toContainText('1,0 %')
})

test('un Coach n’a pas les paramètres réseau', async ({ page }) => {
  await seConnecter(page, { role: 'coach', magasins: [{ magasin: MAGASINS[1], statut: 'propose', hypotheses: null, maj_le: null }] })
  await expect(page.getByText(MAGASINS[1], { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('link', { name: /Paramètres/ })).toHaveCount(0)
  await page.goto('./#/parametres')
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
})

test('un franchisé sans magasin rattaché, un compte pas encore ouvert : des messages clairs', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: [] })
  await expect(page.getByText('Aucun magasin rattaché à ton compte')).toBeVisible()
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await seConnecter(page, { role: 'aucun' })
  await expect(page.getByText('Ton accès n’est pas encore ouvert')).toBeVisible()
})

test('si la base ne répond pas, un message humain propose de réessayer', async ({ page }) => {
  await seConnecter(page, { panne: true })
  await expect(page.getByText(/ne se chargent pas pour le moment/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  await expect(page.getByText(/500|indisponible|error/i)).toHaveCount(0)
})
