import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type MagasinSimule, type PersonneSimulee } from './supabase-simule'

// Ergonomie : saisie jamais perdue, filtres de l'accueil, magasin précédent et suivant, pastilles, saisie rapide.
// Données fictives uniquement : dépôt public.

const loyer = (magasin: string): FraisSimule => ({ store_name: magasin, code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, taux_ca: null })
const vendeur = (id: number, magasin: string): PersonneSimulee => ({ id, store_name: magasin, poste: 'Vendeur 1', categorie: 'employe', heures_hebdo: 35, brut_mensuel: 1900, primes: [], entree: null, sortie: null })
// Sept magasins : la recherche apparaît au-delà de cinq
const sept: MagasinSimule[] = [
  { magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, base: magasinFictif, maj_le: '2026-10-20T09:30:00Z' },
  { magasin: MAGASINS[1], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, maj_le: '2026-10-22T16:05:00Z' },
  ...[MAGASINS[2], 'Port-Navalo', 'Les Ormes', 'Val-d’Azur', 'Montclair'].map((magasin) => ({ magasin, statut: null, hypotheses: null, maj_le: null })),
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('une saisie en cours n’est jamais perdue sans confirmation', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'coach' })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Frais/ }).click()
  await page.getByRole('button', { name: 'Partir des lignes courantes' }).click()
  await page.getByLabel('Locations immobilières', { exact: true }).fill('48000')

  // Changer d'onglet : on reste, la saisie est intacte
  await page.getByRole('tab', { name: /^Équipe/ }).click()
  const garde = page.getByRole('dialog', { name: 'Modifications non enregistrées' })
  await expect(garde).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-garde-saisie.png` })
  await garde.getByRole('button', { name: 'Rester' }).click()
  await expect(page.getByLabel('Locations immobilières', { exact: true })).toHaveValue('48 000')

  // Revenir à la liste : on quitte sans enregistrer
  await page.locator('main').getByRole('link', { name: 'Magasins' }).click()
  await garde.getByRole('button', { name: 'Quitter sans enregistrer' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()

  // Sans modification, aucune question
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Équipe/ }).click()
  await expect(garde).toHaveCount(0)
})

test('l’accueil filtre les magasins, la recherche ignore les accents, le retour garde le filtre', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: sept, frais: [loyer(MAGASINS[0]), loyer('Port-Navalo')], equipe: [vendeur(1, MAGASINS[0])] })
  const filtres = page.getByRole('group', { name: 'Filtres' })
  const tableau = page.getByRole('table', { name: /Budgets .* par magasin/ })
  const cartes = page.locator('main').getByRole('heading', { level: 2 })
  const lignes = isMobile ? cartes : tableau.getByRole('row').filter({ has: page.getByRole('link') })
  await expect(filtres.getByRole('button', { name: 'Tous · 7' })).toHaveAttribute('aria-pressed', 'true')
  await expect(filtres.getByRole('button', { name: 'Sans budget · 5' })).toBeVisible()
  await expect(filtres.getByRole('button', { name: 'Équipe à renseigner · 6' })).toBeVisible()
  await expect(filtres.getByRole('button', { name: /Proposés/ })).toHaveCount(0)

  await filtres.getByRole('button', { name: 'Frais à renseigner · 5' }).click()
  await expect(lignes).toHaveCount(5)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil-filtres.png`, fullPage: true })

  await page.getByLabel('Rechercher un magasin').fill('val d azur')
  await expect(lignes).toHaveCount(0)
  await page.getByLabel('Rechercher un magasin').fill('azur')
  await expect(lignes).toHaveCount(1)
  await page.getByText('Val-d’Azur', { exact: true }).click()
  await page.locator('main').getByRole('link', { name: 'Magasins' }).click()
  await expect(page.getByLabel('Rechercher un magasin')).toHaveValue('azur')
  await expect(filtres.getByRole('button', { name: 'Frais à renseigner · 5' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByLabel('Rechercher un magasin').fill('zzz')
  await expect(page.getByText('Aucun magasin ne correspond')).toBeVisible()
})

test('d’un magasin au suivant, dans la liste filtrée, en restant sur le même onglet', async ({ page }) => {
  await seConnecter(page, { magasins: sept, frais: [loyer(MAGASINS[0])] })
  await page.getByRole('group', { name: 'Filtres' }).getByRole('button', { name: /Sans budget/ }).click()
  await page.getByText('Port-Navalo', { exact: true }).click()
  await page.getByRole('tab', { name: /^Frais/ }).click()
  await page.getByRole('link', { name: 'Magasin suivant : Les Ormes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Les Ormes' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Frais/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Pas encore de frais')).toBeVisible()
  // Le précédent de Port-Navalo, dans la liste filtrée, est Saint-Aubin-des-Prés (Valcourt, en discussion, n'y est pas)
  await page.getByRole('link', { name: 'Magasin précédent : Port-Navalo' }).click()
  await expect(page.getByRole('link', { name: `Magasin précédent : ${MAGASINS[2]}` })).toBeVisible()
})

test('les onglets signalent ce qui manque', async ({ page }) => {
  await seConnecter(page, { magasins: sept, frais: [loyer(MAGASINS[0])] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('tab', { name: 'Équipe (à renseigner)' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Frais', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Budget \d+$/ })).toBeVisible()
  await page.getByRole('link', { name: `Magasin suivant : ${MAGASINS[1]}` }).click()
  await page.getByRole('link', { name: `Magasin suivant : ${MAGASINS[2]}` }).click()
  // Directeur : budget à proposer
  await expect(page.getByRole('tab', { name: /^Budget \d+ \(à proposer\)$/ })).toBeVisible()
})

test('un franchisé avec un seul magasin arrive sur sa fiche', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: [sept[0]] })
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[0] })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Magasins' }).and(page.locator('main a'))).toHaveCount(0)
})

test('saisie rapide : Entrée passe au montant suivant, les milliers s’affichent', async ({ page }) => {
  await seConnecter(page, { role: 'franchise' })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Frais/ }).click()
  await page.getByRole('button', { name: 'Partir des lignes courantes' }).click()
  const loyerChamp = page.getByLabel('Locations immobilières', { exact: true })
  await loyerChamp.fill('60000')
  await loyerChamp.press('Enter')
  await expect(page.getByLabel('Charges locatives', { exact: true })).toBeFocused()
  await expect(loyerChamp).toHaveValue('60 000')
  await page.keyboard.type('2400,5')
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Charges locatives', { exact: true })).toHaveValue('2 400,5')
  await expect(page.getByRole('region', { name: 'Frais en chiffres' })).toContainText(/62\sk€/)
})
