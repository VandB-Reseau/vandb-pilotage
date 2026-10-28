import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type TicketsSimules, type VenteSimulee } from './supabase-simule'

// Réel face au budget sur la fiche magasin, et vue réseau. Données fictives uniquement : dépôt public.
// Budget du magasin fictif (tests/donnees-fictives.ts) : 640 000 € de CA, 48 000 € en janvier et en février, marge 57,4 %.

const N = new Date().getFullYear()
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const vente = (magasin: string, a: number, m: number, univers: string, famille: string, ca: number, marge: number | null): VenteSimulee =>
  ({ store_name: magasin, mois: mois(a, m), univers, famille, ca_ht: ca, ca_ttc: ca * 1.2, marge_ht: marge })
// Janvier : 50 000 € (marge complète 26 000 €) ; février : 44 000 €, marge du Fût inconnue
const reel: VenteSimulee[] = [
  vente(MAGASINS[0], N, 1, 'cave', 'Bière', 30_000, 11_000), vente(MAGASINS[0], N, 1, 'bar', 'Fût', 20_000, 15_000),
  vente(MAGASINS[0], N, 2, 'cave', 'Bière', 20_000, 7_000), vente(MAGASINS[0], N, 2, 'bar', 'Fût', 24_000, null),
  vente(MAGASINS[0], N - 1, 1, 'cave', 'Bière', 40_000, null), vente(MAGASINS[0], N - 1, 2, 'cave', 'Bière', 40_000, null),
  vente(MAGASINS[1], N, 1, 'cave', 'Vin', 30_000, 15_000),
]
const tickets: TicketsSimules[] = [{ store_name: MAGASINS[0], mois: mois(N, 1), univers: 'cave', tickets: 2_000 }]
const coachs = { [MAGASINS[0]]: 'Coach Nord', [MAGASINS[1]]: 'Coach Sud', [MAGASINS[2]]: 'Coach Sud' }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('fiche magasin : le réel face au budget, mois par mois', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'valide', hypotheses: (await import('./donnees-fictives')).magasinFictif, maj_le: null }], reel, tickets })
  await page.getByRole('tab', { name: `Suivi du budget ${N}` }).click()
  const cartes = page.getByRole('region', { name: 'Réel face au budget à fin février' })
  await expect(cartes).toContainText(/94\sk€/)
  await expect(cartes).toContainText(/[-−]2,1\s%\ssur le budget/)
  await expect(cartes).toContainText('1 mois sous le budget sur 2')
  await expect(cartes).toContainText(/47,1\s%/)                       // 33 000 / 70 000 : marges connues seulement
  await expect(cartes).toContainText(/[-−]10,2\spt sur le budget/)

  const tableau = page.getByRole('table', { name: `Réel face au budget ${N} mois par mois` })
  const ligne = (nom: string) => tableau.getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })
  await expect(ligne('CA HT réel')).toContainText(/50\s000.*44\s000.*94\s000\s€/)
  await expect(ligne('Écart de CA')).toContainText(/\+2\s000.*[-−]4\s000.*[-−]2\s000\s€/)
  // Février : marge incomplète, pas d'écart de marge ; janvier : 26 000 − 27 547,5
  await expect(ligne('Écart de marge')).toContainText(/[-−]1\s54[78]/)  // −1 547,5 arrondi
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-suivi-budget.png`, fullPage: true })

  await page.locator('[data-mois="2"]').hover({ force: true })
  const bulle = page.getByRole('tooltip')
  await expect(bulle).toContainText(/Réel\s*44\s000\s€/)
  await expect(bulle).toContainText(/Budget\s*48\s000\s€/)
})

test('fiche magasin : sans budget de l’année, le suivi le dit', async ({ page }) => {
  await seConnecter(page, { reel })
  await page.getByText(MAGASINS[2], { exact: true }).click()
  await page.getByRole('tab', { name: `Suivi du budget ${N}` }).click()
  await expect(page.getByText(`Pas de budget ${N} à suivre`)).toBeVisible()
})

test('vue réseau : classement, total, tri, filtre par Coach et retour', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, tickets, coachs })
  await page.getByRole('link', { name: 'Réseau' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Réseau' })).toBeVisible()
  const chiffres = page.getByRole('region', { name: `Réseau ${N} en chiffres` })
  await expect(chiffres).toContainText(/124\sk€/)
  await expect(chiffres).toContainText('2 magasins sous le budget sur 2')

  const tableau = page.getByRole('table', { name: `Réel ${N} par magasin` })
  const lignes = tableau.getByRole('row')
  await expect(lignes.nth(1)).toContainText('Total du réseau')
  await expect(lignes.nth(1)).toContainText('2 magasins')
  // Trié par CA : Brionne-sur-Lac (94 000 €) en tête, puis Valcourt, puis le magasin sans réel
  await expect(lignes.nth(2)).toContainText(MAGASINS[0])
  await expect(lignes.nth(2)).toContainText(/\+17,5\s%/)              // 94 000 / 80 000 − 1
  await expect(lignes.nth(2)).toContainText(/[-−]2,1\s%/)
  await expect(lignes.nth(2)).toContainText(/30,00\s€/)                // panier : 60 000 € TTC / 2 000 tickets (janvier)
  await expect(lignes.nth(3)).toContainText(/[-−]33,3\s%/)             // 30 000 / 45 000 − 1 (budget sans évolution)
  await expect(lignes.nth(4)).toContainText(MAGASINS[2])
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-reseau.png`, fullPage: true })

  // Tri par écart au budget, du plus bas au plus haut : le magasin sans budget reste en bas
  await tableau.getByRole('button', { name: 'Écart au budget' }).click()
  await tableau.getByRole('button', { name: 'Écart au budget' }).click()
  await expect(lignes.nth(2)).toContainText(MAGASINS[1])
  await expect(lignes.nth(4)).toContainText(MAGASINS[2])

  await page.getByLabel('Coach').click()
  await page.getByRole('option', { name: 'Coach Nord' }).click()
  await expect(lignes).toHaveCount(3)
  await expect(lignes.nth(1)).toContainText('Total de la sélection')
  await tableau.getByRole('link', { name: MAGASINS[0] }).click()
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[0] })).toBeVisible()
  await page.locator('main').getByRole('link', { name: 'Réseau' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Réseau' })).toBeVisible()
  await expect(lignes).toHaveCount(3)
})

test('vue réseau : le Coach y accède, sans réel elle le dit', async ({ page }) => {
  await seConnecter(page, { role: 'coach' })
  await page.getByRole('link', { name: 'Réseau' }).first().click()
  await expect(page.getByText(`Pas encore de réel ${N}`)).toBeVisible()
  await expect(page.getByLabel('Coach')).toHaveCount(0)
})

test('vue réseau : jamais montrée au franchisé', async ({ page }) => {
  await seConnecter(page, { role: 'franchise' })
  await expect(page.getByRole('link', { name: 'Réseau' })).toHaveCount(0)
  await page.goto(`${page.url().split('#')[0]}#/reseau`)
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
})
