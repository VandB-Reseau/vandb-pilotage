import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { ouvrir, plusLoin, seConnecter, textesTropPetits, zonesTropPetites, type TicketsSimules, type VenteSimulee, allerVers } from './supabase-simule'

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
const tickets: TicketsSimules[] = [
  { store_name: MAGASINS[0], mois: mois(N, 1), univers: 'cave', tickets: 2_000 }, { store_name: MAGASINS[0], mois: mois(N - 1, 1), univers: 'cave', tickets: 1_600 },
]
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
  await ouvrir(page, 'Suivi du budget')
  // Lot 41 : la page « Où en est le magasin » réunit la synthèse et le suivi ; les chiffres clés sont ceux de la synthèse
  // Lot 38 (D3) : la conclusion d'abord. Janvier seul a sa marge : 50 000 € pour 48 000 € à 57,39 % ;
  // effet du CA 2 000 × 0,5739 = +1,1 k€, effet du taux 26 000 − 50 000 × 0,5739 = −2,7 k€
  await expect(page.getByLabel('Conclusion')).toHaveText(/^À fin février, CA [-−]2,1\s%\ssur le budget \([-−]2\sk€\), taux de marge [-−]10,2\spt\. Sur la marge, le taux pèse le plus : [-−]2,7\sk€, contre \+1,1\sk€ pour le CA\.$/)

  // Le détail mois par mois est replié
  const tableau = page.getByRole('table', { name: `Réel face au budget ${N} mois par mois` })
  await expect(tableau).toBeHidden()
  await page.getByRole('button', { name: 'Mois par mois', expanded: false }).click()
  const ligne = (nom: string) => tableau.getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })
  // Refonte T2 : une case = le réel, sa pastille, le budget dessous (janvier au-dessus du budget, février à −8,3 %)
  await expect(ligne('CA HT')).toContainText(/50\s000\s*prévu 48\s000, au prévu ou mieux.*44\s000\s*prévu 48\s000, nettement en dessous du prévu.*94\s000\s*prévu 96\s000/)
  await expect(ligne('Écart de CA')).toContainText(/\+2\s000.*[-−]4\s000.*[-−]2\s000\s€/)
  // Février : marge incomplète, pas de marge réelle ; janvier : 26 000 face à 27 547,5 (−5,6 % : au-delà du seuil de 5 %)
  await expect(ligne('Marge')).toContainText(/26\s000\s*prévu 27\s54[78], nettement en dessous du prévu/)
  // CA et marge : lignes clés, sur fond teinté (lot 38)
  await expect(ligne('CA HT')).toHaveClass(/ligne-cle/)
  await expect(ligne('Marge')).toHaveClass(/ligne-cle/)
  // Légende derrière l'icône (i)
  await page.getByRole('button', { name: 'Légende des pastilles' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Légende des pastilles' })).toContainText('jusqu’à 5 % en dessous')
  await page.keyboard.press('Escape')
  // R4 : jauge du CA face au budget
  await expect(page.getByRole('meter', { name: 'CA réel face au budget à fin février' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-suivi-budget.png`, fullPage: true })

  // R2 : vue cumulée, l'atterrissage chiffré face au budget de l'année
  await plusLoin(page)
  await page.getByRole('region', { name: 'Chiffre d’affaires' }).getByRole('button', { name: 'Cumulé' }).click()
  await expect(page.getByRole('region', { name: 'Chiffre d’affaires' })).toContainText(/Atterrissage \d{4} : .* face au budget de 640\sk€/)
})

test('fiche magasin : sans budget de l’année, le suivi le dit', async ({ page }) => {
  await seConnecter(page, { reel })
  await page.getByText(MAGASINS[2], { exact: true }).last().click()
  await ouvrir(page, 'Suivi du budget')
  await expect(page.getByText(`Pas de budget ${N} à suivre`)).toBeVisible()
})

test('vue réseau : classement, total, tri, filtre par Coach et retour', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, tickets, coachs })
  await allerVers(page, 'Réel du réseau')
  await expect(page.getByRole('heading', { level: 1, name: 'Réseau' })).toBeVisible()
  const chiffres = page.getByRole('region', { name: `Réseau ${N} en chiffres` })
  await expect(chiffres).toContainText(/124\sk€/)
  await expect(chiffres).toContainText('2 magasins sous le budget sur 2')

  const tableau = page.getByRole('table', { name: `Réel ${N} par magasin` })
  const lignes = tableau.getByRole('row')
  await expect(lignes.nth(1)).toContainText('Total du réseau')
  await expect(lignes.nth(1)).toContainText('2 magasins')
  await expect(lignes.nth(2)).toContainText('Médiane du réseau')
  // Trié par CA : Brionne-sur-Lac (94 000 €) en tête, puis Valcourt, puis le magasin sans réel
  await expect(lignes.nth(3)).toContainText(MAGASINS[0])
  await expect(lignes.nth(3)).toContainText(/\+17,5\s%/)              // 94 000 / 80 000 − 1
  await expect(lignes.nth(3)).toContainText(/[-−]2,1\s%/)
  await expect(lignes.nth(4)).toContainText(/[-−]33,3\s%/)             // 30 000 / 45 000 − 1 (budget sans évolution)
  // Vue « Clients » (03/11/2026) : paniers et tickets
  const vues = page.getByRole('group', { name: 'Vue du classement' })
  await vues.getByRole('button', { name: 'Clients' }).click()
  expect(page.url()).toContain('vue=clients')
  await expect(lignes.nth(3)).toContainText(/18,00\s€/)                // panier Cave : 36 000 € TTC / 2 000 tickets (janvier), le Bar à part
  await expect(lignes.nth(3)).toContainText(/\+25,0\s%/)              // tickets Cave : 2 000 / 1 600 l'an dernier − 1
  await vues.getByRole('button', { name: 'Ventes' }).click()
  await expect(lignes.nth(5)).toContainText(MAGASINS[2])
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-reseau.png`, fullPage: true })

  // Tri par écart au budget, du plus bas au plus haut : le magasin sans budget reste en bas
  await tableau.getByRole('button', { name: 'Écart au budget' }).click()
  await tableau.getByRole('button', { name: 'Écart au budget' }).click()
  await expect(lignes.nth(3)).toContainText(MAGASINS[1])
  await expect(lignes.nth(5)).toContainText(MAGASINS[2])

  await page.getByLabel('Coach', { exact: true }).click()
  await page.getByRole('option', { name: /^Coach Nord/ }).click()
  await expect(lignes).toHaveCount(4)
  await expect(lignes.nth(1)).toContainText('Total de la sélection')
  await tableau.getByRole('link', { name: MAGASINS[0] }).click()
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[0] })).toBeVisible()
  await page.locator('main').getByRole('link', { name: 'Réseau' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Réseau' })).toBeVisible()
  await expect(lignes).toHaveCount(4)
})

test('vue réseau : le Coach y accède, sans réel elle le dit', async ({ page }) => {
  await seConnecter(page, { role: 'coach' })
  await allerVers(page, 'Réel du réseau')
  await expect(page.getByText(`Pas encore de réel ${N}`)).toBeVisible()
  await expect(page.getByLabel('Coach', { exact: true })).toHaveCount(0)
})

test('vue réseau : jamais montrée au franchisé', async ({ page }) => {
  await seConnecter(page, { role: 'franchise' })
  await expect(page.getByRole('link', { name: 'Réseau' })).toHaveCount(0)
  await page.goto(`${page.url().split('#')[0]}#/reseau`)
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
})
