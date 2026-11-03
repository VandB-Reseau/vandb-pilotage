import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { allerVers, ongletParametres, ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type StockSimule, type VenteSimulee } from './supabase-simule'

// Valeur du stock en fin de mois (Joseph, 03/11/2026) : cible de 2,5 mois d'achats des ventes à venir pour la Cave et
// 1 mois pour le Bar, saisie du franchisé, réglages dans les Paramètres réseau. Données fictives : dépôt public.

const N = new Date().getFullYear()
const magasin: MagasinSimule = { magasin: MAGASINS[0], statut: null, hypotheses: null, maj_le: null }
// Mois tous identiques, l'an dernier comme cette année (janvier à septembre) : Cave 50 000 € de CA HT à 40 % de marge
// (30 000 € d'achats des ventes), Bar 10 000 € à 75 % (2 500 €). Atterrissage : les mêmes mois jusqu'en décembre.
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const ventes = (a: number, jusqua: number): VenteSimulee[] => Array.from({ length: jusqua }, (_, i) => [
  { store_name: MAGASINS[0], mois: mois(a, i + 1), univers: 'cave' as const, famille: 'Bière', ca_ht: 50_000, ca_ttc: 60_000, marge_ht: 20_000 },
  { store_name: MAGASINS[0], mois: mois(a, i + 1), univers: 'bar' as const, famille: 'Fût', ca_ht: 10_000, ca_ttc: 11_000, marge_ht: 7_500 },
]).flat()
const reel = [...ventes(N - 1, 12), ...ventes(N, 9)]
const ligne = (page: import('@playwright/test').Page, nom: string) =>
  page.getByRole('table', { name: `Stock ${N} par mois` }).getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le franchisé saisit son stock de fin de mois et le voit face à la cible', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [magasin], reel })
  await ouvrir(page, 'Stock')
  // Cible fin septembre : Cave 2,5 × 30 000 = 75 000, Bar 1 × 2 500 = 2 500, soit 77 500 €
  await expect(page.getByRole('region', { name: `Stock ${N} en chiffres` })).toContainText(/Cible fin septembre77\s500\s€Cave 2,5 mois, Bar 1 mois/)
  await expect(ligne(page, 'Cible')).toContainText(/77\s500/)
  await expect(page.getByRole('img', { name: `Stock de fin de mois ${N} face à la cible` })).toBeVisible()

  await page.getByRole('button', { name: 'Saisir le stock d’un mois' }).click()
  await page.getByRole('combobox', { name: 'Mois' }).click()
  await page.getByRole('option', { name: `Fin septembre ${N}` }).click()
  await page.getByLabel('Stock de la Cave').fill('-5')
  await page.getByRole('button', { name: 'Enregistrer le stock' }).click()
  await expect(page.getByText('Saisis des montants en euros, sans signe moins')).toBeVisible()
  await page.getByLabel('Stock de la Cave').fill('60000')
  await page.getByLabel('Stock du Bar').fill('3000')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Enregistrer le stock' }).click()
  await expect(page.getByText(`Stock de fin septembre ${N} enregistré.`)).toBeVisible()
  expect(ecritures.find((e) => e.table === 'stocks' && e.methode === 'POST')?.corps).toEqual({ store_name: MAGASINS[0], annee: N, mois: 9, cave: 60_000, bar: 3_000 })

  // 63 000 € pour 77 500 € : sous la fourchette (69 750 à 85 250) ; 14 500 € à racheter pour revenir à la cible
  const chiffres = page.getByRole('region', { name: `Stock ${N} en chiffres` })
  await expect(chiffres).toContainText('Stock fin septembre')
  await expect(chiffres).toContainText(/63\s000\s€/)
  await expect(chiffres).toContainText('Sous la cible')
  await expect(chiffres).toContainText(/14\s500\s€/)
  await expect(ligne(page, 'Stock total')).toContainText(/63\s000/)
  await expect(ligne(page, 'Écart à la cible')).toContainText(/[-−]\s?14\s500/)
  // Couverture : Cave 60 000 ÷ 30 000 = 2,0 mois ; Bar 3 000 ÷ 2 500 = 1,2 mois
  await expect(ligne(page, 'Couverture Cave')).toContainText('2,0 mois')
  await expect(ligne(page, 'Couverture Bar')).toContainText('1,2 mois')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-stock.png`, fullPage: true })
})

test('le Coach lit le stock saisi par le franchisé', async ({ page }) => {
  const stocks: StockSimule[] = [{ store_name: MAGASINS[0], annee: N, mois: 8, cave: 80_000, bar: 2_500 }]
  await seConnecter(page, { role: 'coach', magasins: [magasin], reel, stocks })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Stock')
  // 82 500 € face à 77 500 € : dans la fourchette
  const chiffres = page.getByRole('region', { name: `Stock ${N} en chiffres` })
  await expect(chiffres).toContainText('Stock fin août')
  await expect(chiffres).toContainText('Dans la cible')
  await expect(ligne(page, 'Stock total')).toContainText(/82\s500/)
})

test('paramètres réseau : le Directeur règle les mois de stock de la Cave et du Bar', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, { role: 'directeur' })
  await allerVers(page, 'Paramètres réseau')
  await ongletParametres(page, 'Trésorerie')
  const section = page.getByRole('region', { name: 'Trésorerie' })
  await expect(page.getByLabel('Stock cible de la Cave en mois')).toHaveValue('2,5')
  await expect(page.getByLabel('Stock cible du Bar en mois')).toHaveValue('1')
  await page.getByLabel('Stock cible de la Cave en mois').fill('3')
  await page.getByLabel('Stock cible du Bar en mois').fill('1,5')
  await page.getByLabel('Écart toléré autour du stock cible').fill('15')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // Plus de 12 mois : refusé
  await page.getByLabel('Stock cible du Bar en mois').fill('13')
  await expect(section.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await page.getByLabel('Stock cible du Bar en mois').fill('1,5')
  await section.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Paramètres de trésorerie \d{4} enregistrés\./)).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { tresorerie: { stock: unknown } } }
  expect(envoi.valeur.tresorerie.stock).toEqual({ mois: { cave: 3, bar: 1.5, exterieur: 0 }, tolerance: 0.15 })
})
