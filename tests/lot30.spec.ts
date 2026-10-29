import { expect, test } from '@playwright/test'
import { calculerBudget } from '../src/moteur/budget'
import { joursHorsDimanche } from '../src/moteur/objectifs'
import { parametresParDefaut } from '../src/moteur/parametres'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, plusLoin, seConnecter, textesTropPetits, zonesTropPetites, type VenteSimulee } from './supabase-simule'

// Lot 30 : fiche en 6 onglets, synthèse en 3 blocs, objectifs du mois pour l'équipe. Données fictives : dépôt public.
const N = new Date().getFullYear()
const M = new Date().getMonth() + 1
const k = Math.max(1, M - 1)
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const reel: VenteSimulee[] = Array.from({ length: k }, (_, i) => ({ store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 20_000, ca_ttc: 24_000, marge_ht: 8_000 }))
const unMagasin = [{ magasin: MAGASINS[0], statut: 'valide' as const, hypotheses: magasinFictif, maj_le: null }]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('fiche : l’année en cours en 2 onglets, le réel et les quadrimestres sur la même page', async ({ page }) => {
  await seConnecter(page, { reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Réel')
  await expect(page.getByRole('tablist', { name: /^Parties de l’année/ }).getByRole('tab')).toHaveText([/^Réel/, /^Équipe et frais/, 'Où on va'])
  await expect(page.getByRole('heading', { name: 'Quadrimestres comptables' })).toBeVisible()
  await ouvrir(page, 'Où on va')
  await expect(page.locator('#partie-atterrissage')).toBeVisible()
})

test('synthèse en 3 blocs : les chiffres, quoi faire, et le détail replié', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('region', { name: /^Santé du magasin/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Leviers commerciaux' })).toHaveCount(0)
  const plus = page.getByRole('region', { name: 'Pour aller plus loin' })
  await expect(plus.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  await expect(plus).toContainText('(graphique, leviers, face au réseau)')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-synthese-3-blocs.png`, fullPage: true })
  await plusLoin(page)
  await expect(page.getByRole('region', { name: 'Leviers commerciaux' })).toBeVisible()
  // Le choix reste d'un magasin à l'autre
  await page.getByRole('link', { name: `Magasin suivant : ${MAGASINS[1]}` }).click()
  await expect(page.getByRole('region', { name: 'Pour aller plus loin' }).getByRole('button', { name: /^Pour aller plus loin/ })).toHaveAttribute('aria-expanded', 'true')
})

test('objectifs du mois : clients par jour et panier visés pour la Cave, à imprimer pour l’équipe', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: unMagasin, reel })
  await page.getByRole('button', { name: 'Objectifs du mois' }).click()
  const fiche = page.getByRole('dialog', { name: /^Objectifs de/ })
  // CA Cave du budget du mois × (1 + TVA) ÷ panier visé 24 € ÷ jours hors dimanches
  const b = calculerBudget(magasinFictif, parametresParDefaut)
  const jours = joursHorsDimanche(N, M)
  const clients = Math.round(b.mois[M - 1].univers!.cave.ca * (1 + parametresParDefaut.tvaPanier.cave) / 24 / jours)
  await expect(fiche.getByLabel('Jours d’ouverture')).toHaveValue(String(jours))
  const tableau = fiche.getByRole('table')
  await expect(tableau.getByRole('columnheader')).toHaveText(['', 'Cave'])
  await expect(tableau.getByRole('row', { name: /^Clients par jour/ })).toContainText(clients.toLocaleString('fr-FR'))
  await expect(tableau.getByRole('row', { name: /^Panier moyen TTC/ })).toContainText(/24,00\s€/)
  await expect(fiche.getByRole('list', { name: 'Un euro de plus par client' })).toContainText('Cave : +')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-objectifs-mois.png` })
  // Un jour d'ouverture de moins : plus de clients par jour
  await fiche.getByLabel('Jours d’ouverture').fill(String(jours - 1))
  const plus = Math.round(b.mois[M - 1].univers!.cave.ca * (1 + parametresParDefaut.tvaPanier.cave) / 24 / (jours - 1))
  await expect(tableau.getByRole('row', { name: /^Clients par jour/ })).toContainText(plus.toLocaleString('fr-FR'))
  await fiche.getByRole('button', { name: 'Fermer' }).click()
  await expect(fiche).toHaveCount(0)
})
